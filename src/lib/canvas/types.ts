/**
 * Canvas LMS REST API response types.
 * Based on https://canvas.instructure.com/doc/api/
 *
 * These types represent the raw JSON shapes returned by the Canvas API.
 * They are intentionally loose (many fields optional) because Canvas
 * responses vary depending on include[] params, permissions, and version.
 */

// ─── User ──────────────────────────────────────────────────────────────

export interface CanvasUser {
  id: number;
  name: string;
  sortable_name?: string;
  short_name?: string;
  login_id?: string;
  email?: string;
  avatar_url?: string;
  locale?: string;
  effective_locale?: string;
  created_at?: string;
  time_zone?: string;
}

// ─── Course ────────────────────────────────────────────────────────────

export interface CanvasTerm {
  id: number;
  name: string;
  start_at?: string | null;
  end_at?: string | null;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  workflow_state: 'unpublished' | 'available' | 'completed' | 'deleted';
  account_id?: number;
  start_at?: string | null;
  end_at?: string | null;
  time_zone?: string;
  default_view?: string;
  enrollment_term_id?: number;
  term?: CanvasTerm;
  enrollments?: CanvasEnrollment[];
  created_at?: string;
  uuid?: string;
  // Color from user dashboard settings (if available)
  course_color?: string;
}

export interface CanvasEnrollment {
  type: string;
  role: string;
  enrollment_state: string;
  computed_current_score?: number | null;
  computed_final_score?: number | null;
  computed_current_grade?: string | null;
  computed_final_grade?: string | null;
}

// ─── Assignment ────────────────────────────────────────────────────────

export interface CanvasLockInfo {
  asset_string?: string;
  unlock_at?: string | null;
  lock_at?: string | null;
  context_module?: Record<string, unknown>;
  manually_locked?: boolean;
}

export interface CanvasRubricCriterion {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
  ratings?: CanvasRubricRating[];
}

export interface CanvasRubricRating {
  id: string;
  description?: string;
  long_description?: string;
  points: number;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  due_at?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
  has_overrides?: boolean;
  course_id: number;
  html_url?: string;
  submission_types?: string[];
  points_possible?: number | null;
  grading_type?: string;
  published?: boolean;
  locked_for_user?: boolean;
  lock_info?: CanvasLockInfo | null;
  lock_explanation?: string | null;
  has_submitted_submissions?: boolean;
  quiz_id?: number | null;
  is_quiz_assignment?: boolean;
  allowed_attempts?: number;
  workflow_state?: string;
  position?: number;
  // Included when include[]=submission
  submission?: CanvasSubmission | null;
  // Rubric data (included if assignment has a rubric)
  rubric?: CanvasRubricCriterion[] | null;
  rubric_settings?: { points_possible?: string } | null;
  use_rubric_for_grading?: boolean;
  omit_from_final_grade?: boolean;
}

// ─── Submission ────────────────────────────────────────────────────────

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id?: number;
  submitted_at?: string | null;
  attempt?: number | null;
  grade?: string | null;
  score?: number | null;
  workflow_state:
    | 'submitted'
    | 'unsubmitted'
    | 'graded'
    | 'pending_review'
    | string;
  submission_type?: string | null;
  late?: boolean;
  missing?: boolean;
  excused?: boolean;
  grade_matches_current_submission?: boolean;
  preview_url?: string;
  entered_grade?: string | null;
  entered_score?: number | null;
  posted_at?: string | null;
}

// ─── Quiz ──────────────────────────────────────────────────────────────

export interface CanvasQuiz {
  id: number;
  title: string;
  description?: string | null;
  html_url?: string;
  quiz_type?: 'practice_quiz' | 'assignment' | 'graded_survey' | 'survey' | string;
  time_limit?: number | null; // minutes
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
  points_possible?: number | null;
  allowed_attempts?: number; // -1 = unlimited
  due_at?: string | null;
  lock_at?: string | null;
  unlock_at?: string | null;
  published?: boolean;
  locked_for_user?: boolean;
  lock_info?: CanvasLockInfo | null;
  lock_explanation?: string | null;
  assignment_id?: number | null;
  course_id?: number;
  // Not always available
  submission?: CanvasQuizSubmission | null;
}

export interface CanvasQuizSubmission {
  id: number;
  quiz_id: number;
  user_id?: number;
  submission_id?: number;
  started_at?: string | null;
  finished_at?: string | null;
  end_at?: string | null;
  attempt?: number;
  score?: number | null;
  kept_score?: number | null;
  workflow_state?: string;
}

// ─── Calendar Event ────────────────────────────────────────────────────

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  all_day?: boolean;
  all_day_date?: string | null;
  context_code?: string; // e.g. "course_123"
  context_name?: string;
  workflow_state?: string;
  html_url?: string;
  url?: string;
  type?: 'event' | 'assignment';
  // For assignment-type calendar items
  assignment?: CanvasAssignment;
}

// ─── Pagination ────────────────────────────────────────────────────────

export interface CanvasPaginationLinks {
  current?: string;
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
}

// ─── Error ─────────────────────────────────────────────────────────────

export interface CanvasErrorResponse {
  errors?: Array<{ message: string }>;
  message?: string;
  status?: string;
}
