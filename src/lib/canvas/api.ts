/**
 * Typed Canvas API functions.
 *
 * Each function maps to a specific Canvas REST endpoint and returns
 * typed data. Server-side only.
 */

import { canvasRequest, canvasPaginatedRequest } from './client';
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
export type { CanvasTelemetry } from './client';

export async function getCurrentUser(): Promise<CanvasUser> {
  const { data } = await canvasRequest<CanvasUser>('/users/self');
  return data;
}

// ─── Courses ───────────────────────────────────────────────────────────

export async function getCourses(): Promise<CanvasCourse[]> {
  const courses = await canvasPaginatedRequest<CanvasCourse>('/courses', {
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
 * Fetch courses filtered to current active academic terms.
 * Avoids hammering Canvas for historical/archived terms during rapid polling cycles.
 */
export async function getActiveCourses(): Promise<CanvasCourse[]> {
  const allCourses = await getCourses();
  const currentActive = allCourses.filter((c) => {
    const combined = `${c.course_code || ''} ${c.name || ''}`;
    if (
      combined.includes('2025/26/') ||
      combined.includes('2024/25/') ||
      combined.includes('2023/24/') ||
      combined.includes('2022/23/')
    ) {
      return false;
    }
    return true;
  });

  return currentActive.length > 0 ? currentActive : allCourses;
}

// ─── Assignments ───────────────────────────────────────────────────────

export async function getAssignments(courseId: number): Promise<CanvasAssignment[]> {
  const assignments = await canvasPaginatedRequest<CanvasAssignment>(
    `/courses/${courseId}/assignments`,
    {
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
): Promise<CanvasAssignment> {
  const { data } = await canvasRequest<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`,
    {
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
): Promise<CanvasSubmission> {
  const { data } = await canvasRequest<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
  );
  return data;
}

// ─── Quizzes ───────────────────────────────────────────────────────────

export async function getQuizzes(courseId: number): Promise<CanvasQuiz[]> {
  try {
    const quizzes = await canvasPaginatedRequest<CanvasQuiz>(
      `/courses/${courseId}/quizzes`,
      {
        params: {
          per_page: '100',
        },
      },
    );

    // Only return published quizzes
    return quizzes.filter((q) => q.published !== false);
  } catch (error) {
    // Some courses may not have quizzes enabled — gracefully return empty
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
): Promise<CanvasQuizSubmission[]> {
  try {
    const { data } = await canvasRequest<{ quiz_submissions?: CanvasQuizSubmission[] }>(
      `/courses/${courseId}/quizzes/${quizId}/submissions`,
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
): Promise<CanvasCalendarEvent[]> {
  const events = await canvasPaginatedRequest<CanvasCalendarEvent>(
    '/calendar_events',
    {
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
 * This uses the assignment type to also pull assignment due dates.
 */
export async function getCalendarItems(
  startDate: string,
  endDate: string,
): Promise<CanvasCalendarEvent[]> {
  const [events, assignments] = await Promise.all([
    canvasPaginatedRequest<CanvasCalendarEvent>('/calendar_events', {
      params: {
        type: 'event',
        start_date: startDate,
        end_date: endDate,
        per_page: '100',
      },
    }),
    canvasPaginatedRequest<CanvasCalendarEvent>('/calendar_events', {
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
