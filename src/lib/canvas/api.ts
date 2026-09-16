/**
 * Typed Canvas API functions.
 *
 * Each function maps to a specific Canvas REST endpoint and returns
 * typed data. Server-side only. Supports per-user CanvasContext.
 */

import { canvasRequest, canvasPaginatedRequest, type CanvasContext } from './client';
import { extractSemester, sortSemesters } from '../semester';
import type {
  CanvasUser,
  CanvasCourse,
  CanvasAssignment,
  CanvasQuiz,
  CanvasQuizSubmission,
  CanvasCalendarEvent,
  CanvasSubmission,
} from './types';

// ─── Current User ──────────────────────────────────────────────────────

export { getLatestCanvasTelemetry, resetCycleTelemetry } from './client';
export type { CanvasTelemetry, CanvasContext } from './client';

export async function getCurrentUser(context?: CanvasContext | null): Promise<CanvasUser> {
  const { data } = await canvasRequest<CanvasUser>('/users/self', { context });
  return data;
}

// ─── Courses ───────────────────────────────────────────────────────────

export async function getCourses(context?: CanvasContext | null): Promise<CanvasCourse[]> {
  const courses = await canvasPaginatedRequest<CanvasCourse>('/courses', {
    context,
    params: {
      enrollment_state: 'active',
      'include[]': ['term', 'total_scores'],
      per_page: '50',
      state: ['available'],
    },
  });

  // Filter out courses that are not active/available
  return courses.filter(
    (c) => c.workflow_state === 'available' || c.workflow_state === 'unpublished',
  );
}

/**
 * Fetch courses filtered to active courses for near-real-time synchronization.
 * Prioritizes the latest active academic semester.
 */
export async function getActiveCourses(context?: CanvasContext | null): Promise<CanvasCourse[]> {
  const allCourses = await getCourses(context);

  const detectedSemesters = allCourses
    .map((c) => extractSemester(c.course_code, c.name))
    .filter((s): s is string => Boolean(s));

  if (detectedSemesters.length > 0) {
    const sorted = sortSemesters(Array.from(new Set(detectedSemesters)));
    const latestSemester = sorted[0]; // e.g. "2026/27/1"

    const active = allCourses.filter((c) => {
      if (c.workflow_state !== 'available') return false;
      const sem = extractSemester(c.course_code, c.name);
      return !sem || sem === latestSemester;
    });

    if (active.length > 0) {
      return active;
    }
  }

  // Fallback: filter out concluded or past courses
  return allCourses.filter((c) => {
    if (c.workflow_state !== 'available') return false;
    if (c.end_at && new Date(c.end_at).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  });
}

// ─── Assignments ───────────────────────────────────────────────────────

export async function getAssignments(courseId: number, context?: CanvasContext | null): Promise<CanvasAssignment[]> {
  const assignments = await canvasPaginatedRequest<CanvasAssignment>(
    `/courses/${courseId}/assignments`,
    {
      context,
      params: {
        'include[]': ['submission', 'all_dates'],
        per_page: '100',
        order_by: 'due_at',
      },
    },
  );

  // Only return published assignments
  return assignments.filter((a) => a.published !== false);
}

// ─── Single Assignment ─────────────────────────────────────────────────

export async function getAssignment(
  courseId: number,
  assignmentId: number,
  context?: CanvasContext | null,
): Promise<CanvasAssignment> {
  const { data } = await canvasRequest<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`,
    {
      context,
      params: {
        'include[]': ['submission', 'all_dates'],
      },
    },
  );
  return data;
}

// ─── Submissions ───────────────────────────────────────────────────────

export async function getSubmission(
  courseId: number,
  assignmentId: number,
  context?: CanvasContext | null,
): Promise<CanvasSubmission> {
  const { data } = await canvasRequest<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
    { context },
  );
  return data;
}

// ─── Quizzes ───────────────────────────────────────────────────────────

export async function getQuizzes(courseId: number, context?: CanvasContext | null): Promise<CanvasQuiz[]> {
  try {
    const quizzes = await canvasPaginatedRequest<CanvasQuiz>(
      `/courses/${courseId}/quizzes`,
      {
        context,
        params: {
          per_page: '100',
        },
      },
    );

    // Only return published quizzes
    return quizzes.filter((q) => q.published !== false);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('404') || error.message.includes('403'))
    ) {
      return [];
    }
    throw error;
  }
}

export async function getQuizSubmissions(
  courseId: number,
  quizId: number,
  context?: CanvasContext | null,
): Promise<CanvasQuizSubmission[]> {
  try {
    const { data } = await canvasRequest<{ quiz_submissions?: CanvasQuizSubmission[] }>(
      `/courses/${courseId}/quizzes/${quizId}/submissions`,
      { context },
    );
    return data?.quiz_submissions || [];
  } catch {
    return [];
  }
}

// ─── Calendar Events ───────────────────────────────────────────────────

export async function getCalendarEvents(
  startDate: string,
  endDate: string,
  context?: CanvasContext | null,
): Promise<CanvasCalendarEvent[]> {
  const events = await canvasPaginatedRequest<CanvasCalendarEvent>(
    '/calendar_events',
    {
      context,
      params: {
        type: 'event',
        start_date: startDate,
        end_date: endDate,
        per_page: '100',
      },
    },
  );

  return events;
}

/**
 * Get calendar items (assignments + events) for a date range.
 */
export async function getCalendarItems(
  startDate: string,
  endDate: string,
  context?: CanvasContext | null,
): Promise<CanvasCalendarEvent[]> {
  const [events, assignments] = await Promise.all([
    canvasPaginatedRequest<CanvasCalendarEvent>('/calendar_events', {
      context,
      params: {
        type: 'event',
        start_date: startDate,
        end_date: endDate,
        per_page: '100',
      },
    }),
    canvasPaginatedRequest<CanvasCalendarEvent>('/calendar_events', {
      context,
      params: {
        type: 'assignment',
        start_date: startDate,
        end_date: endDate,
        per_page: '100',
      },
    }),
  ]);

  return [...events, ...assignments];
}
