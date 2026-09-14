/**
 * Canvas Sync Engine — Near-Real-Time Adaptive Synchronization
 *
 * Orchestrates fetching data from Canvas REST API with:
 * 1. Target interval ~60 seconds
 * 2. Rate-limit telemetry tracking (X-Rate-Limit-Remaining, X-Request-Cost, HTTP status)
 * 3. Adaptive backoff on HTTP 429 and rate pressure
 * 4. Concurrency control & distributed lease locks (prevents overlapping syncs)
 * 5. Smart change detection (new tasks, date changes, availability, submissions)
 * 6. Detection latency measurement (Canvas event timestamp -> detection timestamp)
 * 7. Event-driven immediate Web Push notification dispatch (zero extra scheduler delay)
 * 8. Controlled concurrency (2-4 parallel course requests, only current active semester courses)
 */

import { prisma } from '../db';
import {
  getCourses,
  getActiveCourses,
  getAssignments,
  getQuizzes,
  getQuizSubmissions,
  getCurrentUser,
  getLatestCanvasTelemetry,
  resetCycleTelemetry,
} from '../canvas/api';
import {
  canInitiateSync,
  recordAdaptiveSyncSuccess,
  recordAdaptiveSyncFailure,
  getOrCreateSyncState,
  TARGET_INTERVAL_SECONDS,
} from './adaptive';
import { processDueNotifications } from '../notifications/scheduler';
import { computeTaskStatus, isTaskLocked } from '../tasks/availability';
import { extractSemester } from '../semester';
import { logger } from '../logger';
import type { CanvasAssignment, CanvasQuiz, CanvasQuizSubmission } from '../canvas/types';

// ─── Types ─────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  coursesCount: number;
  tasksCount: number;
  newTasks: number;
  updatedTasks: number;
  notificationsCount?: number;
  error?: string;
  durationMs: number;
  rateLimitRemaining?: number | null;
  lastRequestCost?: number | null;
  targetIntervalSeconds?: number;
  currentIntervalSeconds?: number;
  backoffRemainingSec?: number;
  detectionLatencyMs?: number | null;
}

// ─── Main Sync ─────────────────────────────────────────────────────────

export async function syncAll(triggeredBy: string = 'manual'): Promise<SyncResult> {
  const startTime = Date.now();
  const now = new Date();
  let coursesCount = 0;
  let tasksCount = 0;
  let newTasks = 0;
  let updatedTasks = 0;
  const detectedLatencies: number[] = [];

  // 1. Adaptive Rate-Limit Check: verify if system is currently throttled / backing off
  const canSync = await canInitiateSync(now);
  if (!canSync.allowed) {
    logger.warn('Canvas sync postponed due to adaptive rate-limit backoff', {
      backoffRemainingSec: canSync.backoffRemainingSec,
      reason: canSync.reason,
      triggeredBy,
    });
    return {
      success: false,
      coursesCount: 0,
      tasksCount: 0,
      newTasks: 0,
      updatedTasks: 0,
      error: canSync.reason || 'Canvas is temporarily rate-limited. Automatic retry is scheduled.',
      durationMs: Date.now() - startTime,
      backoffRemainingSec: canSync.backoffRemainingSec,
    };
  }

  // 2. Concurrency Lock: check for another active sync started within the last 45 seconds
  const lockExpiryThreshold = new Date(Date.now() - 45 * 1000);
  const activeRunningSync = await prisma.syncRun.findFirst({
    where: {
      status: 'running',
      startedAt: { gte: lockExpiryThreshold },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (activeRunningSync) {
    logger.warn('Skipping sync: another sync run is currently active', {
      activeSyncId: activeRunningSync.id,
      startedAt: activeRunningSync.startedAt.toISOString(),
      triggeredBy,
    });
    return {
      success: true,
      coursesCount: 0,
      tasksCount: 0,
      newTasks: 0,
      updatedTasks: 0,
      error: 'Sync already in progress (concurrency lock active)',
      durationMs: Date.now() - startTime,
    };
  }

  // Clean up any stale running sync runs older than 45s (e.g. from serverless recycle/timeout)
  await prisma.syncRun.updateMany({
    where: {
      status: 'running',
      startedAt: { lt: lockExpiryThreshold },
    },
    data: {
      status: 'failed',
      completedAt: now,
      errorMessage: 'Sync execution lease expired or worker was recycled',
    },
  });

  // Get current sync state parameters
  const syncState = await getOrCreateSyncState();

  // Create new sync run record with telemetry fields
  const syncRun = await prisma.syncRun.create({
    data: {
      status: 'running',
      triggeredBy,
      targetIntervalSeconds: syncState.targetIntervalSeconds,
      currentIntervalSeconds: syncState.currentIntervalSeconds,
    },
  });

  // Reset in-memory cycle telemetry
  resetCycleTelemetry();

  logger.info('Near-real-time Canvas synchronization cycle started', {
    syncRunId: syncRun.id,
    triggeredBy,
    currentInterval: syncState.currentIntervalSeconds,
  });

  try {
    // 3. Sync user profile
    await syncUser();

    // 4. Sync courses: Focus on current active semester courses (15 courses) for rapid ~60s cycles
    // This cuts Canvas requests in half and easily fits within serverless execution bounds.
    const courses = await syncCourses(true);
    coursesCount = courses.length;

    // 5. Sync assignments and quizzes with controlled concurrency (batches of 4 courses)
    const BATCH_SIZE = 4;
    for (let i = 0; i < courses.length; i += BATCH_SIZE) {
      const batch = courses.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((course: { id: string; canvasCourseId: number }) =>
          syncCourseContent(course.id, course.canvasCourseId, detectedLatencies),
        ),
      );
      for (const res of results) {
        tasksCount += res.total;
        newTasks += res.new;
        updatedTasks += res.updated;
      }
    }

    // 6. Recalculate statuses for all tasks based on current time
    const recalculated = await recalculateAllTaskStatuses(now);

    // 7. EVENT-DRIVEN NOTIFICATION PIPELINE:
    // Immediately dispatch any newly created notifications AND any due reminders via Web Push.
    // Zero second delay: Changes detected this cycle are pushed to the user's phone right away.
    const notifResult = await processDueNotifications(now).catch((err) => {
      logger.error('Failed to dispatch notifications immediately after sync', { error: String(err) });
      return { scheduled: 0, sent: 0, skippedQuietHours: 0, failed: 0 };
    });

    // 8. Capture Cycle Telemetry
    const telemetry = getLatestCanvasTelemetry();
    const durationMs = Date.now() - startTime;

    // Compute average detection latency for this cycle if events were caught
    let cycleDetectionLatencyMs: number | null = null;
    if (detectedLatencies.length > 0) {
      cycleDetectionLatencyMs = Math.round(
        detectedLatencies.reduce((sum, val) => sum + val, 0) / detectedLatencies.length,
      );
    }

    // Record adaptive success and update controller
    const updatedState = await recordAdaptiveSyncSuccess({
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      requestCost: telemetry.lastRequestCost,
      detectionLatencyMs: cycleDetectionLatencyMs,
      now,
    });

    // Finalize SyncRun in database
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        coursesCount,
        tasksCount,
        newTasks,
        updatedTasks,
        notificationsCount: notifResult.sent,
        rateLimitRemaining: telemetry.lastRateLimitRemaining,
        requestCost: telemetry.lastRequestCost,
        httpStatus: telemetry.lastHttpStatus || 200,
        targetIntervalSeconds: updatedState.targetIntervalSeconds,
        currentIntervalSeconds: updatedState.currentIntervalSeconds,
        detectionLatencyMs: cycleDetectionLatencyMs,
      },
    });

    logger.info('Near-real-time Canvas synchronization completed successfully', {
      syncRunId: syncRun.id,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      notificationsSent: notifResult.sent,
      recalculatedStatuses: recalculated,
      durationMs,
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      detectionLatencyMs: cycleDetectionLatencyMs,
      nextIntervalSec: updatedState.currentIntervalSeconds,
    });

    return {
      success: true,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      notificationsCount: notifResult.sent,
      durationMs,
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      lastRequestCost: telemetry.lastRequestCost,
      targetIntervalSeconds: updatedState.targetIntervalSeconds,
      currentIntervalSeconds: updatedState.currentIntervalSeconds,
      detectionLatencyMs: cycleDetectionLatencyMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
    const telemetry = getLatestCanvasTelemetry();

    const is429 = telemetry.lastHttpStatus === 429 || errorMessage.includes('429');
    let errorType = 'network';
    if (is429) errorType = '429';
    else if (telemetry.lastHttpStatus === 401 || errorMessage.includes('401')) errorType = '401';
    else if (telemetry.lastHttpStatus === 403 || errorMessage.includes('403')) errorType = '403';
    else if (errorMessage.toLowerCase().includes('timeout')) errorType = 'timeout';

    // Record failure in adaptive controller (triggers backoff if 429)
    const { state: failedState, evaluation } = await recordAdaptiveSyncFailure({
      is429,
      retryAfterSec: telemetry.lastRetryAfter,
      errorType,
      errorMessage,
      now,
    });

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: is429 ? 'rate_limited' : 'failed',
        completedAt: new Date(),
        durationMs,
        errorMessage,
        errorType,
        rateLimitRemaining: telemetry.lastRateLimitRemaining,
        requestCost: telemetry.lastRequestCost,
        httpStatus: telemetry.lastHttpStatus || (is429 ? 429 : 500),
        backoffSeconds: evaluation.backoffSeconds,
        targetIntervalSeconds: failedState.targetIntervalSeconds,
        currentIntervalSeconds: failedState.currentIntervalSeconds,
      },
    });

    logger.error('Canvas synchronization failed or rate-limited', {
      syncRunId: syncRun.id,
      error: errorMessage,
      errorType,
      is429,
      backoffSeconds: evaluation.backoffSeconds,
      durationMs,
    });

    return {
      success: false,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      error: errorMessage,
      durationMs,
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      lastRequestCost: telemetry.lastRequestCost,
      targetIntervalSeconds: failedState.targetIntervalSeconds,
      currentIntervalSeconds: failedState.currentIntervalSeconds,
      backoffRemainingSec: evaluation.backoffSeconds,
    };
  }
}

// ─── User Sync ─────────────────────────────────────────────────────────

async function syncUser() {
  const canvasUser = await getCurrentUser();

  await prisma.user.upsert({
    where: { canvasUserId: canvasUser.id },
    update: {
      name: canvasUser.name,
      email: canvasUser.email || null,
      avatarUrl: canvasUser.avatar_url || null,
    },
    create: {
      canvasUserId: canvasUser.id,
      name: canvasUser.name,
      email: canvasUser.email || null,
      avatarUrl: canvasUser.avatar_url || null,
    },
  });
}

// ─── Course Sync ───────────────────────────────────────────────────────

async function syncCourses(onlyActive: boolean = false) {
  const canvasCourses = onlyActive ? await getActiveCourses() : await getCourses();

  const courses = await Promise.all(
    canvasCourses.map(async (cc) => {
      const semester = extractSemester(cc.course_code, cc.name);
      return prisma.course.upsert({
        where: { canvasCourseId: cc.id },
        update: {
          name: cc.name,
          code: cc.course_code || null,
          semester,
          workflowState: cc.workflow_state,
          timezone: cc.time_zone || null,
          lastSyncedAt: new Date(),
        },
        create: {
          canvasCourseId: cc.id,
          name: cc.name,
          code: cc.course_code || null,
          semester,
          workflowState: cc.workflow_state,
          timezone: cc.time_zone || null,
          lastSyncedAt: new Date(),
        },
      });
    }),
  );

  return courses;
}

// ─── Course Content Sync ───────────────────────────────────────────────

async function syncCourseContent(
  courseDbId: string,
  canvasCourseId: number,
  detectedLatencies: number[],
): Promise<{ total: number; new: number; updated: number }> {
  let total = 0;
  let newCount = 0;
  let updatedCount = 0;

  // Fetch assignments, quizzes, and existing course tasks in parallel
  const [assignments, quizzes, existingTasks] = await Promise.all([
    getAssignments(canvasCourseId).catch((err) => {
      logger.warn('Failed to fetch assignments for course', { canvasCourseId, error: String(err) });
      return [] as CanvasAssignment[];
    }),
    getQuizzes(canvasCourseId).catch((err) => {
      logger.warn('Failed to fetch quizzes for course', { canvasCourseId, error: String(err) });
      return [] as CanvasQuiz[];
    }),
    prisma.task.findMany({
      where: { courseId: courseDbId },
    }).catch(() => []),
  ]);

  const existingMap = new Map<string, any>(
    (existingTasks as Array<{ canvasTaskId: string; [key: string]: any }>).map((t) => [t.canvasTaskId, t]),
  );

  // Index assignments by quiz_id and by id for quick linking to quizzes
  const assignmentByQuizId = new Map<number, CanvasAssignment>();
  const assignmentById = new Map<number, CanvasAssignment>();
  for (const a of assignments) {
    if (a.quiz_id) {
      assignmentByQuizId.set(a.quiz_id, a);
    }
    assignmentById.set(a.id, a);
  }

  const activeCanvasTaskIds = new Set<string>();

  // Process assignments
  for (const assignment of assignments) {
    // Skip assignments that are quiz assignments (handled as quizzes with full submission data)
    if (assignment.is_quiz_assignment && assignment.quiz_id) continue;

    const canvasTaskId = `assignment_${assignment.id}`;
    activeCanvasTaskIds.add(canvasTaskId);
    const existing = existingMap.get(canvasTaskId) || null;
    const result = await upsertAssignment(courseDbId, assignment, existing, detectedLatencies);
    total++;
    if (result === 'created') newCount++;
    if (result === 'updated') updatedCount++;
  }

  // Process quizzes with matched assignment submission or fallback to quiz submissions endpoint
  for (const quiz of quizzes) {
    const canvasTaskId = `quiz_${quiz.id}`;
    activeCanvasTaskIds.add(canvasTaskId);

    const matchingAssignment =
      assignmentByQuizId.get(quiz.id) ||
      (quiz.assignment_id ? assignmentById.get(quiz.assignment_id) : undefined);

    let quizSubmission: CanvasQuizSubmission | null = quiz.submission || null;

    if (!quizSubmission && matchingAssignment?.submission) {
      const asub = matchingAssignment.submission;
      quizSubmission = {
        id: asub.id,
        quiz_id: quiz.id,
        user_id: asub.user_id,
        attempt: asub.attempt ?? undefined,
        score: asub.score ?? null,
        kept_score: asub.score ?? null,
        workflow_state: asub.workflow_state,
        finished_at: asub.submitted_at || null,
      };
    }

    const existing = existingMap.get(canvasTaskId) || null;

    // Only query direct quiz submissions if:
    // 1. Not already matched by assignment submission
    // 2. We don't already know the task is submitted/graded in our DB
    // 3. The quiz is currently unlocked and published
    if (
      !matchingAssignment &&
      !quizSubmission &&
      quiz.published &&
      !quiz.locked_for_user &&
      (!existing || !existing.isSubmitted) &&
      (quiz.points_possible || 0) > 0
    ) {
      try {
        const directSubmissions = await getQuizSubmissions(canvasCourseId, quiz.id);
        if (directSubmissions.length > 0) {
          const latest = directSubmissions.sort(
            (a, b) => (b.attempt || 0) - (a.attempt || 0),
          )[0];
          if (latest) {
            quizSubmission = latest;
          }
        }
      } catch {
        // Fallback silently if not accessible
      }
    }

    const result = await upsertQuiz(courseDbId, quiz, quizSubmission, matchingAssignment, existing, detectedLatencies);
    total++;
    if (result === 'created') newCount++;
    if (result === 'updated') updatedCount++;
  }

  // Canvas is source of truth: mark tasks no longer returned by Canvas as unpublished (soft-state)
  await prisma.task.updateMany({
    where: {
      courseId: courseDbId,
      canvasTaskId: { notIn: Array.from(activeCanvasTaskIds) },
      published: true,
    },
    data: {
      published: false,
      lastSyncedAt: new Date(),
    },
  });

  return { total, new: newCount, updated: updatedCount };
}

// ─── Assignment Upsert ─────────────────────────────────────────────────

async function upsertAssignment(
  courseDbId: string,
  assignment: CanvasAssignment,
  existingTask: any | null,
  detectedLatencies: number[],
): Promise<'created' | 'updated' | 'unchanged'> {
  const canvasTaskId = `assignment_${assignment.id}`;
  const submission = assignment.submission;
  const now = new Date();

  const isSubmitted = !!(
    submission &&
    submission.workflow_state !== 'unsubmitted' &&
    (
      submission.submitted_at != null ||
      (typeof submission.attempt === 'number' && submission.attempt > 0) ||
      submission.score != null ||
      submission.grade != null ||
      submission.workflow_state === 'submitted' ||
      submission.workflow_state === 'graded' ||
      submission.workflow_state === 'complete'
    )
  );

  const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
  const availableAt = assignment.unlock_at ? new Date(assignment.unlock_at) : null;
  const lockAt = assignment.lock_at ? new Date(assignment.lock_at) : null;
  const isLocked = isTaskLocked(assignment.locked_for_user || false, lockAt, now);

  const status = computeTaskStatus(
    {
      dueAt,
      availableAt,
      lockAt,
      isLocked,
      isSubmitted,
      submissionWorkflowState: submission?.workflow_state,
    },
    now,
  );

  const taskData = {
    courseId: courseDbId,
    sourceType: 'assignment',
    title: assignment.name,
    description: assignment.description || null,
    htmlUrl: assignment.html_url || null,
    availableAt,
    dueAt,
    lockAt,
    isLocked,
    lockExplanation: assignment.lock_explanation || null,
    pointsPossible: assignment.points_possible ?? null,
    submissionTypes: assignment.submission_types || [],
    published: assignment.published !== false,
    status,
    isSubmitted,
    submittedAt: submission?.submitted_at
      ? new Date(submission.submitted_at)
      : null,
    submissionState: submission?.workflow_state || null,
    grade: submission?.grade || null,
    score: submission?.score ?? null,
    attempt: submission?.attempt ?? null,
    lastSyncedAt: new Date(),
  };

  const existing =
    existingTask !== undefined
      ? existingTask
      : await prisma.task.findUnique({
          where: { canvasTaskId },
        });

  if (existing) {
    const titleChanged = existing.title !== taskData.title;
    const dueChanged = existing.dueAt?.getTime() !== taskData.dueAt?.getTime();
    const availableChanged = existing.availableAt?.getTime() !== taskData.availableAt?.getTime();
    const lockChanged = existing.lockAt?.getTime() !== taskData.lockAt?.getTime() || existing.isLocked !== taskData.isLocked;
    const submissionChanged = existing.isSubmitted !== taskData.isSubmitted;
    const statusChanged = existing.status !== taskData.status;
    const publishedChanged = existing.published !== taskData.published;
    const gradeChanged = existing.grade !== taskData.grade || existing.score !== taskData.score;

    const changed =
      titleChanged ||
      dueChanged ||
      availableChanged ||
      lockChanged ||
      submissionChanged ||
      statusChanged ||
      publishedChanged ||
      gradeChanged;

    if (changed) {
      // Calculate detection latency from assignment.updated_at if available
      if (assignment.updated_at) {
        const eventTimestamp = new Date(assignment.updated_at).getTime();
        const latency = now.getTime() - eventTimestamp;
        if (latency >= 0 && latency < 24 * 60 * 60 * 1000) {
          detectedLatencies.push(latency);
        }
      }

      // Event-driven immediate notifications for meaningful changes
      if (dueChanged && taskData.dueAt) {
        await createNotificationIfNeeded(
          existing.id,
          'changed',
          now,
          `${existing.id}_due_${taskData.dueAt.getTime()}`,
        );
      }

      // Unlocked event: task became available
      if (
        (statusChanged && taskData.status === 'available' && existing.status !== 'available') ||
        (availableChanged && taskData.availableAt && taskData.availableAt <= now && existing.status === 'upcoming')
      ) {
        await createNotificationIfNeeded(
          existing.id,
          'available',
          now,
          `${existing.id}_available_${now.toISOString().slice(0, 10)}`,
        );
      }

      // Grade/score updated
      if (gradeChanged && (taskData.score != null || taskData.grade != null)) {
        await createNotificationIfNeeded(
          existing.id,
          'graded',
          now,
          `${existing.id}_graded_${taskData.score ?? taskData.grade}`,
        );
      }

      await prisma.task.update({
        where: { canvasTaskId },
        data: taskData,
      });
      return 'updated';
    }

    return 'unchanged';
  }

  // New task detected
  const created = await prisma.task.create({
    data: {
      canvasTaskId,
      ...taskData,
    },
  });

  // Calculate detection latency from assignment.created_at
  if (assignment.created_at) {
    const eventTimestamp = new Date(assignment.created_at).getTime();
    const latency = now.getTime() - eventTimestamp;
    if (latency >= 0 && latency < 24 * 60 * 60 * 1000) {
      detectedLatencies.push(latency);
    }
  }

  // Immediately schedule notification for new task
  await createNotificationIfNeeded(
    created.id,
    'new_task',
    now,
    `${created.id}_new_task`,
  );

  return 'created';
}

// ─── Quiz Upsert ───────────────────────────────────────────────────────

async function upsertQuiz(
  courseDbId: string,
  quiz: CanvasQuiz,
  quizSubmission: CanvasQuizSubmission | null | undefined,
  matchingAssignment: CanvasAssignment | null | undefined,
  existingTask: any | null,
  detectedLatencies: number[],
): Promise<'created' | 'updated' | 'unchanged'> {
  const canvasTaskId = `quiz_${quiz.id}`;
  const now = new Date();

  const sub = quizSubmission || quiz.submission;
  const asub = matchingAssignment?.submission;

  const score = sub?.score ?? sub?.kept_score ?? asub?.score ?? null;
  const grade =
    asub?.grade ??
    (score != null && quiz.points_possible != null
      ? `${score}/${quiz.points_possible}`
      : score != null
        ? String(score)
        : null);
  const attempt = sub?.attempt ?? asub?.attempt ?? null;
  const submittedAtRaw = sub?.finished_at || asub?.submitted_at || null;
  const submittedAt = submittedAtRaw ? new Date(submittedAtRaw) : null;
  const submissionState =
    sub?.workflow_state || asub?.workflow_state || (score != null ? 'complete' : null);

  const isSubmitted = !!(
    score != null ||
    submittedAt != null ||
    (typeof attempt === 'number' && attempt > 0) ||
    (submissionState &&
      ['submitted', 'graded', 'complete', 'pending_review'].includes(submissionState))
  );

  const dueAt = quiz.due_at ? new Date(quiz.due_at) : null;
  const availableAt = quiz.unlock_at ? new Date(quiz.unlock_at) : null;
  const lockAt = quiz.lock_at ? new Date(quiz.lock_at) : null;
  const isLocked = isTaskLocked(quiz.locked_for_user || false, lockAt, now);

  const status = computeTaskStatus(
    {
      dueAt,
      availableAt,
      lockAt,
      isLocked,
      isSubmitted,
      submissionWorkflowState: submissionState,
    },
    now,
  );

  const taskData = {
    courseId: courseDbId,
    sourceType: 'quiz',
    title: quiz.title,
    description: quiz.description || null,
    htmlUrl: quiz.html_url || null,
    availableAt,
    dueAt,
    lockAt,
    isLocked,
    lockExplanation: quiz.lock_explanation || null,
    pointsPossible: quiz.points_possible ?? null,
    submissionTypes: [],
    published: quiz.published !== false,
    status,
    isSubmitted,
    submittedAt,
    submissionState,
    grade,
    score,
    attempt,
    quizTimeLimit: quiz.time_limit ?? null,
    quizAllowedAttempts: quiz.allowed_attempts ?? null,
    lastSyncedAt: new Date(),
  };

  const existing =
    existingTask !== undefined
      ? existingTask
      : await prisma.task.findUnique({
          where: { canvasTaskId },
        });

  if (existing) {
    const titleChanged = existing.title !== taskData.title;
    const dueChanged = existing.dueAt?.getTime() !== taskData.dueAt?.getTime();
    const availableChanged = existing.availableAt?.getTime() !== taskData.availableAt?.getTime();
    const lockChanged = existing.lockAt?.getTime() !== taskData.lockAt?.getTime() || existing.isLocked !== taskData.isLocked;
    const submissionChanged = existing.isSubmitted !== taskData.isSubmitted;
    const statusChanged = existing.status !== taskData.status;
    const publishedChanged = existing.published !== taskData.published;
    const gradeChanged = existing.score !== taskData.score || existing.grade !== taskData.grade || existing.attempt !== taskData.attempt;

    const changed =
      titleChanged ||
      dueChanged ||
      availableChanged ||
      lockChanged ||
      submissionChanged ||
      statusChanged ||
      publishedChanged ||
      gradeChanged;

    if (changed) {
      // Calculate detection latency from quiz.updated_at if available
      if (quiz.updated_at) {
        const eventTimestamp = new Date(quiz.updated_at).getTime();
        const latency = now.getTime() - eventTimestamp;
        if (latency >= 0 && latency < 24 * 60 * 60 * 1000) {
          detectedLatencies.push(latency);
        }
      }

      // Event-driven immediate notifications for meaningful quiz changes
      if (dueChanged && taskData.dueAt) {
        await createNotificationIfNeeded(
          existing.id,
          'changed',
          now,
          `${existing.id}_due_${taskData.dueAt.getTime()}`,
        );
      }

      // Unlocked event: quiz became available
      if (
        (statusChanged && taskData.status === 'available' && existing.status !== 'available') ||
        (availableChanged && taskData.availableAt && taskData.availableAt <= now && existing.status === 'upcoming')
      ) {
        await createNotificationIfNeeded(
          existing.id,
          'available',
          now,
          `${existing.id}_available_${now.toISOString().slice(0, 10)}`,
        );
      }

      // Grade/score updated
      if (gradeChanged && (taskData.score != null || taskData.grade != null)) {
        await createNotificationIfNeeded(
          existing.id,
          'graded',
          now,
          `${existing.id}_graded_${taskData.score ?? taskData.grade}`,
        );
      }

      await prisma.task.update({
        where: { canvasTaskId },
        data: taskData,
      });
      return 'updated';
    }

    return 'unchanged';
  }

  // New quiz detected
  const created = await prisma.task.create({
    data: {
      canvasTaskId,
      ...taskData,
    },
  });

  // Immediately schedule notification for new quiz
  await createNotificationIfNeeded(
    created.id,
    'new_task',
    now,
    `${created.id}_new_quiz`,
  );

  return 'created';
}

// ─── Task Status Recalculation ─────────────────────────────────────────

export async function recalculateAllTaskStatuses(now: Date = new Date()): Promise<number> {
  const activeTasks = await prisma.task.findMany({
    where: { published: true },
    select: {
      id: true,
      dueAt: true,
      availableAt: true,
      lockAt: true,
      isLocked: true,
      isSubmitted: true,
      submissionState: true,
      score: true,
      grade: true,
      submittedAt: true,
      status: true,
    },
  });

  const updates: Array<{ id: string; status: string; isSubmitted: boolean }> = [];
  for (const task of activeTasks) {
    const effectiveSubmitted =
      task.isSubmitted ||
      task.score != null ||
      task.grade != null ||
      task.submittedAt != null;

    const currentComputed = computeTaskStatus(
      {
        dueAt: task.dueAt,
        availableAt: task.availableAt,
        lockAt: task.lockAt,
        isLocked: isTaskLocked(task.isLocked, task.lockAt, now),
        isSubmitted: effectiveSubmitted,
        submissionWorkflowState: task.submissionState,
      },
      now,
    );

    if (currentComputed !== task.status || effectiveSubmitted !== task.isSubmitted) {
      updates.push({
        id: task.id,
        status: currentComputed,
        isSubmitted: effectiveSubmitted,
      });
    }
  }

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        prisma.task.update({
          where: { id: u.id },
          data: {
            status: u.status,
            isSubmitted: u.isSubmitted,
          },
        }),
      ),
    );
  }

  return updates.length;
}

// ─── Notification Helper with Idempotency Key ──────────────────────────

async function createNotificationIfNeeded(
  taskId: string,
  type: string,
  scheduledFor: Date,
  idempotencyKey?: string,
) {
  try {
    await prisma.notification.create({
      data: {
        taskId,
        type,
        scheduledFor,
        state: 'pending',
        idempotencyKey: idempotencyKey || `${taskId}_${type}_${scheduledFor.getTime()}`,
      },
    });
  } catch {
    // Unique constraint violation or idempotency collision — notification already scheduled, skip safely
  }
}

// ─── Last Sync Info ────────────────────────────────────────────────────

export async function getLastSyncInfo() {
  const lastSync = await prisma.syncRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });

  const syncState = await prisma.syncState.findUnique({
    where: { id: 'global' },
  });

  const recentRuns = await prisma.syncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 8,
  });

  return {
    lastSync,
    syncState,
    recentRuns,
  };
}
