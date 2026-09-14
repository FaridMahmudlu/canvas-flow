/**
 * Canvas Sync Engine
 *
 * Orchestrates fetching data from Canvas API and upserting
 * into the PostgreSQL database. Detects changes, creates notification
 * entries, handles concurrency locking, and recalculates real-time task statuses.
 */

import { prisma } from '../db';
import { getCourses, getAssignments, getQuizzes, getQuizSubmissions, getCurrentUser } from '../canvas/api';
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
  error?: string;
  durationMs: number;
}

// ─── Main Sync ─────────────────────────────────────────────────────────

export async function syncAll(triggeredBy: string = 'manual'): Promise<SyncResult> {
  const startTime = Date.now();
  let coursesCount = 0;
  let tasksCount = 0;
  let newTasks = 0;
  let updatedTasks = 0;

  // 1. Concurrency Lock: check for a running sync started in the last 30 seconds
  const lockExpiryThreshold = new Date(Date.now() - 30 * 1000);
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

  // Mark any stale sync runs (>2 minutes) as failed
  await prisma.syncRun.updateMany({
    where: {
      status: 'running',
      startedAt: { lt: lockExpiryThreshold },
    },
    data: {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Sync execution timed out or worker recycled',
    },
  });

  // Create new sync run record
  const syncRun = await prisma.syncRun.create({
    data: {
      status: 'running',
      triggeredBy,
    },
  });

  logger.info('Canvas synchronization started', {
    syncRunId: syncRun.id,
    triggeredBy,
  });

  try {
    // 2. Sync user
    await syncUser();

    // 3. Sync courses
    const courses = await syncCourses();
    coursesCount = courses.length;

    // 4. Sync assignments and quizzes for each course concurrently in batches of 6
    const BATCH_SIZE = 6;
    for (let i = 0; i < courses.length; i += BATCH_SIZE) {
      const batch = courses.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((course: { id: string; canvasCourseId: number }) =>
          syncCourseContent(course.id, course.canvasCourseId),
        ),
      );
      for (const res of results) {
        tasksCount += res.total;
        newTasks += res.new;
        updatedTasks += res.updated;
      }
    }

    // 5. Recalculate statuses for all tasks based on current time
    const recalculated = await recalculateAllTaskStatuses();

    // 6. Update sync run
    const durationMs = Date.now() - startTime;
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        coursesCount,
        tasksCount,
      },
    });

    logger.info('Canvas synchronization completed successfully', {
      syncRunId: syncRun.id,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      recalculatedStatuses: recalculated,
      durationMs,
    });

    return {
      success: true,
      coursesCount,
      tasksCount,
      newTasks,
      updatedTasks,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown sync error';

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      },
    });

    logger.error('Canvas synchronization failed', {
      syncRunId: syncRun.id,
      error: errorMessage,
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

async function syncCourses() {
  const canvasCourses = await getCourses();

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
    const result = await upsertAssignment(courseDbId, assignment, existing);
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

    if (!matchingAssignment && !quizSubmission) {
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

    const existing = existingMap.get(canvasTaskId) || null;
    const result = await upsertQuiz(courseDbId, quiz, quizSubmission, matchingAssignment, existing);
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
  existingTask?: any | null,
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
    const changed =
      existing.title !== taskData.title ||
      existing.dueAt?.getTime() !== taskData.dueAt?.getTime() ||
      existing.availableAt?.getTime() !== taskData.availableAt?.getTime() ||
      existing.lockAt?.getTime() !== taskData.lockAt?.getTime() ||
      existing.isSubmitted !== taskData.isSubmitted ||
      existing.isLocked !== taskData.isLocked ||
      existing.status !== taskData.status ||
      existing.published !== taskData.published ||
      existing.grade !== taskData.grade ||
      existing.score !== taskData.score;

    if (changed) {
      if (
        existing.dueAt?.getTime() !== taskData.dueAt?.getTime() &&
        taskData.dueAt
      ) {
        await createNotificationIfNeeded(existing.id, 'changed', new Date());
      }

      await prisma.task.update({
        where: { canvasTaskId },
        data: taskData,
      });
      return 'updated';
    }

    return 'unchanged';
  }

  // New task
  const created = await prisma.task.create({
    data: {
      canvasTaskId,
      ...taskData,
    },
  });

  await createNotificationIfNeeded(created.id, 'new_task', new Date());

  return 'created';
}

// ─── Quiz Upsert ───────────────────────────────────────────────────────

async function upsertQuiz(
  courseDbId: string,
  quiz: CanvasQuiz,
  quizSubmission?: CanvasQuizSubmission | null,
  matchingAssignment?: CanvasAssignment | null,
  existingTask?: any | null,
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
    const changed =
      existing.title !== taskData.title ||
      existing.dueAt?.getTime() !== taskData.dueAt?.getTime() ||
      existing.availableAt?.getTime() !== taskData.availableAt?.getTime() ||
      existing.lockAt?.getTime() !== taskData.lockAt?.getTime() ||
      existing.isSubmitted !== taskData.isSubmitted ||
      existing.isLocked !== taskData.isLocked ||
      existing.status !== taskData.status ||
      existing.published !== taskData.published ||
      existing.score !== taskData.score ||
      existing.grade !== taskData.grade ||
      existing.attempt !== taskData.attempt;

    if (changed) {
      if (
        existing.dueAt?.getTime() !== taskData.dueAt?.getTime() &&
        taskData.dueAt
      ) {
        await createNotificationIfNeeded(existing.id, 'changed', new Date());
      }

      await prisma.task.update({
        where: { canvasTaskId },
        data: taskData,
      });
      return 'updated';
    }

    return 'unchanged';
  }

  const created = await prisma.task.create({
    data: {
      canvasTaskId,
      ...taskData,
    },
  });

  await createNotificationIfNeeded(created.id, 'new_task', new Date());

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

// ─── Notification Helper ───────────────────────────────────────────────

async function createNotificationIfNeeded(
  taskId: string,
  type: string,
  scheduledFor: Date,
) {
  try {
    await prisma.notification.create({
      data: {
        taskId,
        type,
        scheduledFor,
        state: 'pending',
      },
    });
  } catch {
    // Unique constraint violation — notification already scheduled, skip
  }
}

// ─── Last Sync Info ────────────────────────────────────────────────────

export async function getLastSyncInfo() {
  const lastSync = await prisma.syncRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });

  return lastSync;
}
