/**
 * CanvasFlow Near-Real-Time Multi-Tenant Synchronization Engine
 *
 * Core synchronization pipeline:
 * 1. Adaptive rate-limit evaluation and concurrency locks
 * 2. Multi-tenant execution: runs per-user or round-robin for all active Canvas connections
 * 3. Courses, Assignments, and Quizzes synchronization
 * 4. Submission & grade tracking
 * 5. Event-driven immediate push notifications
 * 6. Telemetry collection and adaptive interval adjustments
 */

import { prisma } from '@/lib/db';
import {
  getCourses,
  getActiveCourses,
  getAssignments,
  getQuizzes,
  getQuizSubmissions,
  getCurrentUser,
  getLatestCanvasTelemetry,
  resetCycleTelemetry,
  type CanvasContext,
} from '@/lib/canvas/api';
import type {
  CanvasAssignment,
  CanvasQuiz,
  CanvasQuizSubmission,
} from '@/lib/canvas/types';
import { computeTaskStatus, isTaskLocked } from '@/lib/tasks/availability';
import { extractSemester, sortSemesters } from '@/lib/semester';
import { logger } from '@/lib/logger';
import { processDueNotifications } from '@/lib/notifications/scheduler';
import {
  canInitiateSync,
  recordAdaptiveSyncSuccess,
  recordAdaptiveSyncFailure,
  getOrCreateSyncState,
} from './adaptive';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { getUserCanvasContext } from '@/lib/auth-helpers';

export interface SyncResult {
  success: boolean;
  coursesCount: number;
  tasksCount: number;
  newTasks: number;
  updatedTasks: number;
  notificationsCount: number;
  durationMs: number;
  rateLimitRemaining?: number;
  currentIntervalSec?: number;
  detectionLatencyMs?: number | null;
  error?: string;
  backoffRemainingSec?: number;
}

/**
 * Automatically migrate legacy environment CANVAS_TOKEN into CanvasConnection
 * records for active users if no database connections exist yet.
 */
async function autoMigrateLegacyConnection(): Promise<void> {
  const token = process.env.CANVAS_TOKEN?.trim();
  if (!token) return;

  const baseUrl = (process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu').replace(/\/+$/, '');

  try {
    const { encrypted, iv, tag } = encryptToken(token);

    // Find users who should be linked to this connection
    const targetUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'fariddmahmudlu2008@gmail.com' },
          { email: 'farid@canvasflow.app' },
          { courses: { some: {} } },
        ],
      },
      select: { id: true, email: true, name: true },
    });

    for (const user of targetUsers) {
      await prisma.canvasConnection.upsert({
        where: {
          userId_instanceUrl: {
            userId: user.id,
            instanceUrl: baseUrl,
          },
        },
        create: {
          userId: user.id,
          instanceUrl: baseUrl,
          instanceName: 'ELTE Canvas',
          encryptedToken: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          canvasUserId: 344666,
          canvasUserName: user.name || 'Mahmudlu Farid (SEK2L3)',
          isActive: true,
          lastVerifiedAt: new Date(),
        },
        update: {
          instanceName: 'ELTE Canvas',
          encryptedToken: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          isActive: true,
          lastVerifiedAt: new Date(),
        },
      });
      logger.info('Auto-migrated legacy Canvas token to CanvasConnection', {
        userId: user.id,
        email: user.email,
      });
    }
  } catch (err) {
    logger.error('Failed to auto-migrate legacy Canvas connection', { error: String(err) });
  }
}

// ─── Main Entrypoint ───────────────────────────────────────────────────

/**
 * Execute Canvas synchronization.
 * If userId is provided, syncs that specific user.
 * If no userId is provided (e.g. background cron), round-robins all active users.
 */
export async function syncAll(
  triggeredBy: string = 'manual',
  userId?: string,
): Promise<SyncResult> {
  const startTime = Date.now();

  // If a specific user is targeted, sync that user directly
  if (userId) {
    return syncSingleUser(userId, triggeredBy, startTime);
  }

  // Cron / Multi-user execution: Find all users with active Canvas connections
  let connections = await prisma.canvasConnection.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      instanceUrl: true,
      encryptedToken: true,
      tokenIv: true,
      tokenTag: true,
    },
    orderBy: { updatedAt: 'asc' }, // Fair round-robin: least recently updated first
  });

  if (connections.length === 0 && process.env.CANVAS_TOKEN) {
    await autoMigrateLegacyConnection();
    connections = await prisma.canvasConnection.findMany({
      where: { isActive: true },
      select: {
        id: true,
        userId: true,
        instanceUrl: true,
        encryptedToken: true,
        tokenIv: true,
        tokenTag: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  if (connections.length === 0) {
    // Fallback: check if single-user environment variables exist (legacy / local dev)
    if (process.env.CANVAS_TOKEN) {
      const userWithCourses = await prisma.user.findFirst({
        where: { courses: { some: {} } },
      });
      const primaryUser = userWithCourses || (await prisma.user.findFirst());
      if (primaryUser) {
        return syncSingleUser(primaryUser.id, triggeredBy, startTime);
      }
    }

    return {
      success: true,
      coursesCount: 0,
      tasksCount: 0,
      newTasks: 0,
      updatedTasks: 0,
      notificationsCount: 0,
      durationMs: Date.now() - startTime,
      error: 'No active Canvas connections found to synchronize',
    };
  }

  let aggregatedCourses = 0;
  let aggregatedTasks = 0;
  let aggregatedNewTasks = 0;
  let aggregatedUpdatedTasks = 0;
  let aggregatedNotifications = 0;

  for (const conn of connections) {
    try {
      const token = decryptToken(conn.encryptedToken, conn.tokenIv, conn.tokenTag);
      const userContext: CanvasContext = {
        baseUrl: conn.instanceUrl,
        token,
      };

      const result = await syncSingleUser(conn.userId, triggeredBy, Date.now(), userContext);
      if (result.success) {
        aggregatedCourses += result.coursesCount;
        aggregatedTasks += result.tasksCount;
        aggregatedNewTasks += result.newTasks;
        aggregatedUpdatedTasks += result.updatedTasks;
        aggregatedNotifications += result.notificationsCount;
      }
    } catch (userErr) {
      logger.error('Failed to sync user connection', {
        userId: conn.userId,
        connectionId: conn.id,
        error: String(userErr),
      });
    }
  }

  return {
    success: true,
    coursesCount: aggregatedCourses,
    tasksCount: aggregatedTasks,
    newTasks: aggregatedNewTasks,
    updatedTasks: aggregatedUpdatedTasks,
    notificationsCount: aggregatedNotifications,
    durationMs: Date.now() - startTime,
  };
}

// ─── Single User Sync ──────────────────────────────────────────────────

async function syncSingleUser(
  userId: string,
  triggeredBy: string,
  startTime: number,
  overrideContext?: CanvasContext,
): Promise<SyncResult> {
  const now = new Date();

  // 1. Adaptive Rate-Limit Check
  const canSync = await canInitiateSync(now);
  if (!canSync.allowed) {
    logger.warn('Adaptive Controller held sync cycle: backoff active', {
      userId,
      backoffRemainingSec: canSync.backoffRemainingSec,
      reason: canSync.reason,
    });
    return {
      success: false,
      coursesCount: 0,
      tasksCount: 0,
      newTasks: 0,
      updatedTasks: 0,
      notificationsCount: 0,
      error: canSync.reason || 'Canvas is temporarily rate-limited. Automatic retry is scheduled.',
      durationMs: Date.now() - startTime,
      backoffRemainingSec: canSync.backoffRemainingSec,
    };
  }

  // 2. Concurrency Lock: check for another active sync for this user started within the last 45s
  const lockExpiryThreshold = new Date(Date.now() - 45 * 1000);
  const activeRunningSync = await prisma.syncRun.findFirst({
    where: {
      userId,
      status: 'running',
      startedAt: { gte: lockExpiryThreshold },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (activeRunningSync) {
    logger.warn('Skipping sync: another sync run is currently active for this user', {
      userId,
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
      notificationsCount: 0,
      error: 'Sync already in progress for this account',
      durationMs: Date.now() - startTime,
    };
  }

  // Clean up any stale running sync runs older than 45s
  await prisma.syncRun.updateMany({
    where: {
      userId,
      status: 'running',
      startedAt: { lt: lockExpiryThreshold },
    },
    data: {
      status: 'failed',
      completedAt: now,
      errorMessage: 'Sync execution lease expired or worker was recycled',
    },
  });

  // Resolve user's Canvas credentials
  let canvasContext = overrideContext;
  if (!canvasContext) {
    const connContext = await getUserCanvasContext(userId);
    if (connContext) {
      canvasContext = {
        baseUrl: connContext.baseUrl,
        token: connContext.token,
      };
    } else if (process.env.CANVAS_TOKEN) {
      // Dev / legacy fallback
      canvasContext = {
        baseUrl: process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu',
        token: process.env.CANVAS_TOKEN,
      };
    }
  }

  if (!canvasContext?.token) {
    return {
      success: false,
      coursesCount: 0,
      tasksCount: 0,
      newTasks: 0,
      updatedTasks: 0,
      notificationsCount: 0,
      durationMs: Date.now() - startTime,
      error: 'No active Canvas connection found. Please connect Canvas in Settings.',
    };
  }

  const syncState = await getOrCreateSyncState();

  const syncRun = await prisma.syncRun.create({
    data: {
      userId,
      status: 'running',
      triggeredBy,
      targetIntervalSeconds: syncState.targetIntervalSeconds,
      currentIntervalSeconds: syncState.currentIntervalSeconds,
    },
  });

  resetCycleTelemetry();

  let coursesCount = 0;
  let tasksCount = 0;
  let newTasks = 0;
  let updatedTasks = 0;
  const detectedLatencies: number[] = [];

  try {
    // Sync user profile
    await syncUserProfile(userId, canvasContext);

    // Sync courses for this user (upserts all courses into DB for courses view)
    const courses = await syncCoursesForUser(userId, canvasContext);
    coursesCount = courses.length;

    // Filter courses for near-real-time content synchronization:
    // Prioritize currently active academic semester courses (or available courses).
    const detectedSemesters = courses
      .map((c) => c.semester)
      .filter((s): s is string => Boolean(s));

    let coursesToSync = courses;
    if (detectedSemesters.length > 0) {
      const sorted = sortSemesters(Array.from(new Set(detectedSemesters)));
      const latestSemester = sorted[0];
      coursesToSync = courses.filter((c) => {
        if (c.workflowState !== 'available') return false;
        return !c.semester || c.semester === latestSemester;
      });
    } else {
      coursesToSync = courses.filter((c) => c.workflowState === 'available');
    }

    // Also include any course that has NEVER been synced yet (initial course sync) up to 2 courses per cycle
    const uninitializedCourses = courses.filter(
      (c) => !coursesToSync.some((sc) => sc.id === c.id) && c.lastSyncedAt === null,
    );
    if (uninitializedCourses.length > 0) {
      coursesToSync.push(...uninitializedCourses.slice(0, 2));
    }

    // Sync assignments and quizzes in batches of 6 courses with time-budget safety guard
    const MAX_SYNC_CYCLE_MS = 40000; // 40s safety threshold to prevent Vercel 60s hard timeout
    const BATCH_SIZE = 6;
    for (let i = 0; i < coursesToSync.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_SYNC_CYCLE_MS) {
        logger.warn('Sync cycle approaching serverless time budget; safely wrapping up cycle', {
          userId,
          processedCourses: i,
          totalCourses: coursesToSync.length,
          elapsedMs: Date.now() - startTime,
        });
        break;
      }

      const batch = coursesToSync.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((course) =>
          syncCourseContentForUser(userId, course.id, course.canvasCourseId, detectedLatencies, canvasContext),
        ),
      );
      for (const res of results) {
        tasksCount += res.total;
        newTasks += res.new;
        updatedTasks += res.updated;
      }
    }

    // Recalculate statuses for this user's tasks
    await recalculateUserTaskStatuses(userId, now);

    // Process due notifications for this user
    const notifResult = await processDueNotifications(now, userId).catch((err) => {
      logger.error('Failed to dispatch notifications immediately after sync', { error: String(err) });
      return { scheduled: 0, sent: 0, skippedQuietHours: 0, failed: 0 };
    });

    const telemetry = getLatestCanvasTelemetry();
    const durationMs = Date.now() - startTime;

    let cycleDetectionLatencyMs: number | null = null;
    if (detectedLatencies.length > 0) {
      cycleDetectionLatencyMs = Math.round(
        detectedLatencies.reduce((sum, val) => sum + val, 0) / detectedLatencies.length,
      );
    }

    const updatedState = await recordAdaptiveSyncSuccess({
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      requestCost: telemetry.lastRequestCost,
      detectionLatencyMs: cycleDetectionLatencyMs,
      now,
    });

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

    logger.info('Canvas synchronization completed for user', {
      userId,
      syncRunId: syncRun.id,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      notificationsSent: notifResult.sent,
      durationMs,
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
      currentIntervalSec: updatedState.currentIntervalSeconds,
      detectionLatencyMs: cycleDetectionLatencyMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const telemetry = getLatestCanvasTelemetry();
    const errorMessage = error instanceof Error ? error.message : String(error);

    const is429 =
      telemetry.lastHttpStatus === 429 ||
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('rate limit');

    const errorType = is429
      ? '429'
      : errorMessage.includes('401')
        ? '401'
        : errorMessage.includes('403')
          ? '403'
          : errorMessage.includes('timeout')
            ? 'timeout'
            : 'network';

    await recordAdaptiveSyncFailure({
      is429,
      retryAfterSec: telemetry.lastRetryAfter,
      now,
    });

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: is429 ? 'rate_limited' : 'failed',
        completedAt: new Date(),
        durationMs,
        coursesCount,
        tasksCount,
        newTasks,
        updatedTasks,
        errorMessage,
        errorType,
        httpStatus: telemetry.lastHttpStatus || (is429 ? 429 : 500),
        rateLimitRemaining: telemetry.lastRateLimitRemaining,
        requestCost: telemetry.lastRequestCost,
        backoffSeconds: telemetry.lastRetryAfter || (is429 ? 60 : 0),
      },
    });

    return {
      success: false,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      notificationsCount: 0,
      durationMs,
      rateLimitRemaining: telemetry.lastRateLimitRemaining,
      error: errorMessage,
    };
  }
}

// ─── User Profile Sync ─────────────────────────────────────────────────

async function syncUserProfile(userId: string, context: CanvasContext) {
  try {
    const canvasUser = await getCurrentUser(context);
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: canvasUser.name,
        avatarUrl: canvasUser.avatar_url || undefined,
      },
    });
  } catch (err) {
    logger.warn('Failed to sync user profile from Canvas', { userId, error: String(err) });
  }
}

// ─── Course Sync ───────────────────────────────────────────────────────

async function syncCoursesForUser(userId: string, context: CanvasContext) {
  const canvasCourses = await getCourses(context);

  const courses = await Promise.all(
    canvasCourses.map(async (cc) => {
      const semester = extractSemester(cc.course_code, cc.name);
      return prisma.course.upsert({
        where: {
          userId_canvasCourseId: {
            userId,
            canvasCourseId: cc.id,
          },
        },
        update: {
          name: cc.name,
          code: cc.course_code || null,
          semester,
          workflowState: cc.workflow_state,
          timezone: cc.time_zone || null,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
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

async function syncCourseContentForUser(
  userId: string,
  courseDbId: string,
  canvasCourseId: number,
  detectedLatencies: number[],
  context: CanvasContext,
): Promise<{ total: number; new: number; updated: number }> {
  const [assignments, quizzes] = await Promise.all([
    getAssignments(canvasCourseId, context).catch(() => [] as CanvasAssignment[]),
    getQuizzes(canvasCourseId, context).catch(() => [] as CanvasQuiz[]),
  ]);

  let total = 0;
  let newCount = 0;
  let updatedCount = 0;

  const existingTasks = await prisma.task.findMany({
    where: {
      userId,
      courseId: courseDbId,
    },
  });
  const existingMap = new Map<string, (typeof existingTasks)[0]>();
  for (const t of existingTasks) {
    existingMap.set(t.canvasTaskId, t);
  }

  const activeCanvasTaskIds = new Set<string>();

  // Process Assignments
  for (const assignment of assignments) {
    const canvasTaskId = `assignment_${assignment.id}`;
    activeCanvasTaskIds.add(canvasTaskId);

    const existing = existingMap.get(canvasTaskId) || null;
    const result = await upsertAssignmentForUser(
      userId,
      courseDbId,
      assignment,
      existing,
      detectedLatencies,
    );
    total++;
    if (result === 'created') newCount++;
    if (result === 'updated') updatedCount++;
  }

  // Process Quizzes
  const assignmentMap = new Map<number, CanvasAssignment>();
  for (const a of assignments) {
    if (a.quiz_id) {
      assignmentMap.set(a.quiz_id, a);
    }
  }

  // Pre-fetch direct quiz submissions in parallel for quizzes that require it
  const quizzesNeedingSubmissions = quizzes.filter(
    (quiz) =>
      !assignmentMap.has(quiz.id) &&
      quiz.published &&
      !quiz.locked_for_user &&
      !existingMap.get(`quiz_${quiz.id}`)?.isSubmitted &&
      (quiz.points_possible || 0) > 0,
  );

  const directSubmissionsMap = new Map<number, CanvasQuizSubmission>();
  if (quizzesNeedingSubmissions.length > 0) {
    const subResults = await Promise.all(
      quizzesNeedingSubmissions.map(async (quiz) => {
        try {
          const subs = await getQuizSubmissions(canvasCourseId, quiz.id, context);
          if (subs.length > 0) {
            const latest = subs.sort((a, b) => (b.attempt || 0) - (a.attempt || 0))[0];
            if (latest) return { quizId: quiz.id, sub: latest };
          }
        } catch {
          // Fallback silently
        }
        return { quizId: quiz.id, sub: undefined };
      }),
    );
    for (const r of subResults) {
      if (r.sub) directSubmissionsMap.set(r.quizId, r.sub);
    }
  }

  for (const quiz of quizzes) {
    const canvasTaskId = `quiz_${quiz.id}`;
    activeCanvasTaskIds.add(canvasTaskId);

    const matchingAssignment = assignmentMap.get(quiz.id);
    let quizSubmission: CanvasQuizSubmission | undefined;

    if (matchingAssignment?.submission) {
      const asub = matchingAssignment.submission;
      quizSubmission = {
        id: asub.id,
        quiz_id: quiz.id,
        user_id: asub.user_id,
        submission_id: asub.id,
        attempt: asub.attempt || 1,
        score: asub.score ?? null,
        kept_score: asub.score ?? null,
        workflow_state: asub.workflow_state,
        finished_at: asub.submitted_at || null,
      };
    } else if (directSubmissionsMap.has(quiz.id)) {
      quizSubmission = directSubmissionsMap.get(quiz.id);
    }

    const existing = existingMap.get(canvasTaskId) || null;

    const result = await upsertQuizForUser(
      userId,
      courseDbId,
      quiz,
      quizSubmission,
      matchingAssignment,
      existing,
      detectedLatencies,
    );
    total++;
    if (result === 'created') newCount++;
    if (result === 'updated') updatedCount++;
  }

  // Soft-delete tasks no longer returned by Canvas
  await prisma.task.updateMany({
    where: {
      userId,
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

async function upsertAssignmentForUser(
  userId: string,
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
    userId,
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
    submittedAt: submission?.submitted_at ? new Date(submission.submitted_at) : null,
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
          where: {
            userId_canvasTaskId: {
              userId,
              canvasTaskId,
            },
          },
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
      if (assignment.updated_at) {
        const eventTimestamp = new Date(assignment.updated_at).getTime();
        const latency = now.getTime() - eventTimestamp;
        if (latency >= 0 && latency < 24 * 60 * 60 * 1000) {
          detectedLatencies.push(latency);
        }
      }

      if (dueChanged && taskData.dueAt) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'changed',
          now,
          `${existing.id}_due_${taskData.dueAt.getTime()}`,
        );
      }

      if (
        (statusChanged && taskData.status === 'available' && existing.status !== 'available') ||
        (availableChanged && taskData.availableAt && taskData.availableAt <= now && existing.status === 'upcoming')
      ) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'available',
          now,
          `${existing.id}_available_${now.toISOString().slice(0, 10)}`,
        );
      }

      if (gradeChanged && (taskData.score != null || taskData.grade != null)) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'graded',
          now,
          `${existing.id}_graded_${taskData.score ?? taskData.grade}`,
        );
      }

      await prisma.task.update({
        where: {
          userId_canvasTaskId: {
            userId,
            canvasTaskId,
          },
        },
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

  await createNotificationIfNeeded(
    userId,
    created.id,
    'new_task',
    now,
    `${created.id}_created_${now.toISOString().slice(0, 10)}`,
  );

  return 'created';
}

// ─── Quiz Upsert ───────────────────────────────────────────────────────

async function upsertQuizForUser(
  userId: string,
  courseDbId: string,
  quiz: CanvasQuiz,
  quizSubmission?: CanvasQuizSubmission,
  matchingAssignment?: CanvasAssignment,
  existingTask?: any | null,
  detectedLatencies: number[] = [],
): Promise<'created' | 'updated' | 'unchanged'> {
  const canvasTaskId = `quiz_${quiz.id}`;
  const now = new Date();

  const dueAt = quiz.due_at
    ? new Date(quiz.due_at)
    : matchingAssignment?.due_at
      ? new Date(matchingAssignment.due_at)
      : null;

  const availableAt = quiz.unlock_at
    ? new Date(quiz.unlock_at)
    : matchingAssignment?.unlock_at
      ? new Date(matchingAssignment.unlock_at)
      : null;

  const lockAt = quiz.lock_at
    ? new Date(quiz.lock_at)
    : matchingAssignment?.lock_at
      ? new Date(matchingAssignment.lock_at)
      : null;

  const isLocked = isTaskLocked(
    quiz.locked_for_user || matchingAssignment?.locked_for_user || false,
    lockAt,
    now,
  );

  const isSubmitted = !!(
    (quizSubmission &&
      (quizSubmission.workflow_state === 'complete' ||
        quizSubmission.workflow_state === 'pending_review' ||
        (quizSubmission.finished_at != null && quizSubmission.workflow_state !== 'untaken') ||
        (typeof quizSubmission.attempt === 'number' && quizSubmission.attempt > 0) ||
        quizSubmission.score != null ||
        quizSubmission.kept_score != null)) ||
    (matchingAssignment?.submission &&
      matchingAssignment.submission.workflow_state !== 'unsubmitted' &&
      (matchingAssignment.submission.submitted_at != null ||
        (typeof matchingAssignment.submission.attempt === 'number' && matchingAssignment.submission.attempt > 0) ||
        matchingAssignment.submission.score != null ||
        matchingAssignment.submission.grade != null))
  );

  const status = computeTaskStatus(
    {
      dueAt,
      availableAt,
      lockAt,
      isLocked,
      isSubmitted,
      submissionWorkflowState: quizSubmission?.workflow_state || matchingAssignment?.submission?.workflow_state,
    },
    now,
  );

  const effectiveScore =
    quizSubmission?.kept_score ??
    quizSubmission?.score ??
    matchingAssignment?.submission?.score ??
    null;

  const effectiveGrade =
    matchingAssignment?.submission?.grade ||
    (effectiveScore !== null ? String(effectiveScore) : null);

  const effectiveSubmittedAt = quizSubmission?.finished_at
    ? new Date(quizSubmission.finished_at)
    : matchingAssignment?.submission?.submitted_at
      ? new Date(matchingAssignment.submission.submitted_at)
      : null;

  const taskData = {
    userId,
    courseId: courseDbId,
    sourceType: 'quiz',
    title: quiz.title,
    description: quiz.description || null,
    htmlUrl: quiz.html_url || null,
    availableAt,
    dueAt,
    lockAt,
    isLocked,
    lockExplanation: quiz.lock_explanation || matchingAssignment?.lock_explanation || null,
    pointsPossible: quiz.points_possible ?? matchingAssignment?.points_possible ?? null,
    submissionTypes: ['online_quiz'],
    published: quiz.published !== false,
    status,
    isSubmitted,
    submittedAt: effectiveSubmittedAt,
    submissionState: quizSubmission?.workflow_state || matchingAssignment?.submission?.workflow_state || null,
    grade: effectiveGrade,
    score: effectiveScore,
    attempt: quizSubmission?.attempt ?? matchingAssignment?.submission?.attempt ?? null,
    quizTimeLimit: quiz.time_limit || null,
    quizAllowedAttempts: quiz.allowed_attempts || null,
    lastSyncedAt: new Date(),
  };

  const existing =
    existingTask !== undefined
      ? existingTask
      : await prisma.task.findUnique({
          where: {
            userId_canvasTaskId: {
              userId,
              canvasTaskId,
            },
          },
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
      if (dueChanged && taskData.dueAt) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'changed',
          now,
          `${existing.id}_due_${taskData.dueAt.getTime()}`,
        );
      }

      if (
        (statusChanged && taskData.status === 'available' && existing.status !== 'available') ||
        (availableChanged && taskData.availableAt && taskData.availableAt <= now && existing.status === 'upcoming')
      ) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'available',
          now,
          `${existing.id}_available_${now.toISOString().slice(0, 10)}`,
        );
      }

      if (gradeChanged && (taskData.score != null || taskData.grade != null)) {
        await createNotificationIfNeeded(
          userId,
          existing.id,
          'graded',
          now,
          `${existing.id}_graded_${taskData.score ?? taskData.grade}`,
        );
      }

      await prisma.task.update({
        where: {
          userId_canvasTaskId: {
            userId,
            canvasTaskId,
          },
        },
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

  await createNotificationIfNeeded(
    userId,
    created.id,
    'new_task',
    now,
    `${created.id}_created_${now.toISOString().slice(0, 10)}`,
  );

  return 'created';
}

// ─── Status Recalculation ──────────────────────────────────────────────

async function recalculateUserTaskStatuses(userId: string, now: Date = new Date()): Promise<number> {
  const activeTasks = await prisma.task.findMany({
    where: {
      userId,
      isSubmitted: false,
      published: true,
    },
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
    for (let i = 0; i < updates.length; i += 5) {
      const chunk = updates.slice(i, i + 5);
      await Promise.all(
        chunk.map((u) =>
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
  }

  return updates.length;
}

// ─── Notification Helper ───────────────────────────────────────────────

async function createNotificationIfNeeded(
  userId: string | null,
  taskId: string,
  type: string,
  scheduledFor: Date,
  idempotencyKey?: string,
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        taskId,
        type,
        scheduledFor,
        state: 'pending',
        idempotencyKey: idempotencyKey || `${taskId}_${type}_${scheduledFor.getTime()}`,
      },
    });
  } catch {
    // Unique constraint violation — already scheduled, skip safely
  }
}

// ─── Last Sync Info ────────────────────────────────────────────────────

export async function getLastSyncInfo(userId?: string) {
  const lastSync = await prisma.syncRun.findFirst({
    where: userId ? { userId } : undefined,
    orderBy: { startedAt: 'desc' },
  });

  const syncState = await prisma.syncState.findUnique({
    where: { id: 'global' },
  });

  const recentRuns = await prisma.syncRun.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { startedAt: 'desc' },
    take: 8,
  });

  return {
    lastSync,
    syncState,
    recentRuns,
  };
}
