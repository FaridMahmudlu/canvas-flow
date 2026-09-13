/**
 * Transform Canvas API responses into unified AcademicTask objects.
 */

import type { CanvasAssignment, CanvasQuiz, CanvasCalendarEvent } from '../canvas/types';
import type { AcademicTask } from './types';
import {
  computeTaskStatus,
  computePriority,
  computePriorityScore,
  isTaskAvailable,
  isTaskOverdue,
  isTaskLocked,
} from './availability';

interface CourseInfo {
  id: string;
  canvasCourseId: number;
  name: string;
  code?: string | null;
}

// ─── Assignment → AcademicTask ─────────────────────────────────────────

export function transformAssignment(
  assignment: CanvasAssignment,
  course: CourseInfo,
  now: Date = new Date(),
): AcademicTask {
  const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
  const availableAt = assignment.unlock_at ? new Date(assignment.unlock_at) : null;
  const lockAt = assignment.lock_at ? new Date(assignment.lock_at) : null;

  const submission = assignment.submission;
  const isSubmitted = !!(
    submission &&
    submission.workflow_state !== 'unsubmitted' &&
    submission.submitted_at
  );
  const locked = isTaskLocked(assignment.locked_for_user, lockAt, now);
  const available = isTaskAvailable(availableAt, lockAt, assignment.locked_for_user, now);
  const overdue = isTaskOverdue(dueAt, isSubmitted, now);

  const statusInput = {
    dueAt,
    availableAt,
    lockAt,
    isLocked: locked,
    isSubmitted,
    submissionWorkflowState: submission?.workflow_state,
  };

  const priorityInput = {
    dueAt,
    availableAt,
    isLocked: locked,
    isSubmitted,
    isOverdue: overdue,
    pointsPossible: assignment.points_possible,
    sourceType: 'assignment' as const,
  };

  const status = computeTaskStatus(statusInput, now);
  const priority = computePriority(priorityInput, now);
  const priorityScore = computePriorityScore(priorityInput, now);

  return {
    id: '', // Will be set by the database
    source: 'canvas',
    sourceType: 'assignment',
    canvasId: `assignment_${assignment.id}`,
    courseId: course.id,
    courseName: course.name,
    courseCode: course.code || undefined,
    title: assignment.name,
    description: assignment.description,
    url: assignment.html_url,
    availableAt,
    dueAt,
    lockAt,
    isAvailable: available,
    isLocked: locked,
    isOverdue: overdue,
    isSubmitted,
    status,
    priority,
    priorityScore,
    pointsPossible: assignment.points_possible,
    submissionTypes: assignment.submission_types,
    submission: submission
      ? {
          submittedAt: submission.submitted_at
            ? new Date(submission.submitted_at)
            : null,
          attempt: submission.attempt,
          grade: submission.grade,
          score: submission.score,
          workflowState: submission.workflow_state,
          submissionType: submission.submission_type,
          late: submission.late,
          missing: submission.missing,
          excused: submission.excused,
        }
      : null,
    rubric: assignment.rubric?.map((r) => ({
      description: r.description,
      points: r.points,
    })),
    lockExplanation: assignment.lock_explanation,
    lastSyncedAt: new Date(),
  };
}

// ─── Quiz → AcademicTask ───────────────────────────────────────────────

export function transformQuiz(
  quiz: CanvasQuiz,
  course: CourseInfo,
  now: Date = new Date(),
): AcademicTask {
  const dueAt = quiz.due_at ? new Date(quiz.due_at) : null;
  const availableAt = quiz.unlock_at ? new Date(quiz.unlock_at) : null;
  const lockAt = quiz.lock_at ? new Date(quiz.lock_at) : null;

  const locked = isTaskLocked(quiz.locked_for_user, lockAt, now);
  const available = isTaskAvailable(availableAt, lockAt, quiz.locked_for_user, now);

  // Quiz submission is trickier — use the quiz submission if present
  const isSubmitted = !!(
    quiz.submission &&
    quiz.submission.finished_at
  );
  const overdue = isTaskOverdue(dueAt, isSubmitted, now);

  const statusInput = {
    dueAt,
    availableAt,
    lockAt,
    isLocked: locked,
    isSubmitted,
  };

  const priorityInput = {
    dueAt,
    availableAt,
    isLocked: locked,
    isSubmitted,
    isOverdue: overdue,
    pointsPossible: quiz.points_possible,
    sourceType: 'quiz' as const,
  };

  const status = computeTaskStatus(statusInput, now);
  const priority = computePriority(priorityInput, now);
  const priorityScore = computePriorityScore(priorityInput, now);

  return {
    id: '',
    source: 'canvas',
    sourceType: 'quiz',
    canvasId: `quiz_${quiz.id}`,
    courseId: course.id,
    courseName: course.name,
    courseCode: course.code || undefined,
    title: quiz.title,
    description: quiz.description,
    url: quiz.html_url,
    availableAt,
    dueAt,
    lockAt,
    isAvailable: available,
    isLocked: locked,
    isOverdue: overdue,
    isSubmitted,
    status,
    priority,
    priorityScore,
    pointsPossible: quiz.points_possible,
    submission: quiz.submission
      ? {
          submittedAt: quiz.submission.finished_at
            ? new Date(quiz.submission.finished_at)
            : null,
          attempt: quiz.submission.attempt,
          score: quiz.submission.score,
          workflowState: quiz.submission.workflow_state,
        }
      : null,
    lockExplanation: quiz.lock_explanation,
    quizDetails: {
      timeLimit: quiz.time_limit,
      allowedAttempts: quiz.allowed_attempts,
    },
    lastSyncedAt: new Date(),
  };
}

// ─── Calendar Event → AcademicTask ─────────────────────────────────────

export function transformCalendarEvent(
  event: CanvasCalendarEvent,
  course: CourseInfo,
  now: Date = new Date(),
): AcademicTask {
  const startAt = event.start_at ? new Date(event.start_at) : null;
  const endAt = event.end_at ? new Date(event.end_at) : null;

  const isPast = startAt ? now.getTime() > startAt.getTime() : false;

  return {
    id: '',
    source: 'canvas',
    sourceType: 'event',
    canvasId: `event_${event.id}`,
    courseId: course.id,
    courseName: course.name,
    courseCode: course.code || undefined,
    title: event.title,
    description: event.description,
    url: event.html_url || event.url,
    availableAt: null,
    dueAt: startAt, // Use start_at as the "due" time for events
    lockAt: endAt,
    isAvailable: !isPast,
    isLocked: false,
    isOverdue: false,
    isSubmitted: isPast,
    status: isPast ? 'completed' : 'available',
    priority: 'low',
    priorityScore: isPast ? 5 : 100,
    lastSyncedAt: new Date(),
  };
}
