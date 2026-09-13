/**
 * Unified Academic Task model.
 *
 * This normalizes Canvas assignments, quizzes, and events into
 * a single consistent type for the UI layer.
 */

export type TaskSourceType = 'assignment' | 'quiz' | 'event';

export type TaskStatus =
  | 'upcoming'
  | 'available'
  | 'due-soon'
  | 'overdue'
  | 'submitted'
  | 'completed'
  | 'locked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AcademicTask {
  /** Internal database ID */
  id: string;
  /** Always "canvas" for now — prepared for multi-source future */
  source: 'canvas';
  /** Type of Canvas object */
  sourceType: TaskSourceType;
  /** Canvas object ID (e.g., assignment_123 or quiz_456) */
  canvasId: string;
  /** Internal course ID */
  courseId: string;
  /** Course display name */
  courseName: string;
  /** Course code (e.g., "CS101") */
  courseCode?: string;
  /** Task title */
  title: string;
  /** HTML description from Canvas (sanitized before rendering) */
  description?: string | null;
  /** Canvas URL for "Open in Canvas" */
  url?: string | null;
  /** When the task becomes available */
  availableAt?: Date | null;
  /** When the task is due */
  dueAt?: Date | null;
  /** When the task locks */
  lockAt?: Date | null;
  /** Whether the task is currently available for work */
  isAvailable: boolean;
  /** Whether the task is locked */
  isLocked: boolean;
  /** Whether the due date has passed without submission */
  isOverdue: boolean;
  /** Whether the user has submitted */
  isSubmitted: boolean;
  /** Computed status for display */
  status: TaskStatus;
  /** Computed priority for sorting */
  priority: TaskPriority;
  /** Numeric priority score for fine-grained sorting (higher = more urgent) */
  priorityScore: number;
  /** Maximum points available */
  pointsPossible?: number | null;
  /** Allowed submission types */
  submissionTypes?: string[];
  /** Submission details */
  submission?: {
    submittedAt?: Date | null;
    attempt?: number | null;
    grade?: string | null;
    score?: number | null;
    workflowState?: string;
    submissionType?: string | null;
    late?: boolean;
    missing?: boolean;
    excused?: boolean;
  } | null;
  /** Rubric data if available */
  rubric?: Array<{
    description?: string;
    points: number;
  }> | null;
  /** Lock explanation from Canvas */
  lockExplanation?: string | null;
  /** Quiz-specific fields */
  quizDetails?: {
    timeLimit?: number | null;
    allowedAttempts?: number;
  } | null;
  /** When this task was last synced from Canvas */
  lastSyncedAt: Date;
}

/**
 * Task statistics for the dashboard summary cards.
 */
export interface TaskStats {
  dueSoon: number;
  availableNow: number;
  overdue: number;
  submitted: number;
  upcoming: number;
  locked: number;
  total: number;
}
