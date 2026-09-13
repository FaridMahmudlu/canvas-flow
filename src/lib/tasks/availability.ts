/**
 * Deterministic availability and priority engine.
 *
 * Computes task status and priority based on dates, submission state,
 * and lock state. Pure functions — no side effects, no API calls.
 */

import type { TaskStatus, TaskPriority } from './types';

// ─── Thresholds (in milliseconds) ─────────────────────────────────────

const HOUR = 60 * 60 * 1000;

/** Configurable priority thresholds */
export const PRIORITY_THRESHOLDS = {
  /** Less than 3 hours → critical */
  critical: 3 * HOUR,
  /** Less than 24 hours → high */
  high: 24 * HOUR,
  /** Less than 72 hours → medium */
  medium: 72 * HOUR,
  // Everything else → low
};

// ─── Status Computation ────────────────────────────────────────────────

interface StatusInput {
  dueAt?: Date | null;
  availableAt?: Date | null;
  lockAt?: Date | null;
  isLocked?: boolean;
  isSubmitted?: boolean;
  submissionWorkflowState?: string | null;
}

/**
 * Compute the display status of a task.
 * Order of precedence:
 * 1. Submitted/completed (regardless of overdue)
 * 2. Locked
 * 3. Overdue (not submitted, past due)
 * 4. Due soon (within thresholds)
 * 5. Available now
 * 6. Upcoming (not yet available)
 */
export function computeTaskStatus(input: StatusInput, now: Date = new Date()): TaskStatus {
  const { dueAt, availableAt, lockAt, isLocked, isSubmitted, submissionWorkflowState } = input;
  const nowMs = now.getTime();

  // 1. Check submission
  if (isSubmitted || submissionWorkflowState === 'graded' || submissionWorkflowState === 'submitted') {
    if (submissionWorkflowState === 'graded') return 'completed';
    return 'submitted';
  }

  // 2. Check lock
  if (isLocked) return 'locked';
  if (lockAt && nowMs > lockAt.getTime()) return 'locked';

  // 3. Check overdue
  if (dueAt && nowMs > dueAt.getTime()) return 'overdue';

  // 4. Check not yet available
  if (availableAt && nowMs < availableAt.getTime()) return 'upcoming';

  // 5. Check due soon
  if (dueAt) {
    const timeUntilDue = dueAt.getTime() - nowMs;
    if (timeUntilDue <= PRIORITY_THRESHOLDS.medium) return 'due-soon';
  }

  // 6. Available
  return 'available';
}

// ─── Priority Computation ──────────────────────────────────────────────

interface PriorityInput {
  dueAt?: Date | null;
  availableAt?: Date | null;
  isLocked?: boolean;
  isSubmitted?: boolean;
  isOverdue?: boolean;
  pointsPossible?: number | null;
  sourceType?: 'assignment' | 'quiz' | 'event';
}

/**
 * Compute the priority level of a task.
 */
export function computePriority(input: PriorityInput, now: Date = new Date()): TaskPriority {
  const { dueAt, isSubmitted, isLocked } = input;

  // Submitted tasks are low priority
  if (isSubmitted) return 'low';

  // Locked tasks are low priority (can't act on them)
  if (isLocked) return 'low';

  if (!dueAt) return 'low';

  const nowMs = now.getTime();
  const dueMs = dueAt.getTime();
  const timeUntilDue = dueMs - nowMs;

  // Overdue → critical
  if (timeUntilDue < 0) return 'critical';

  // Within thresholds
  if (timeUntilDue <= PRIORITY_THRESHOLDS.critical) return 'critical';
  if (timeUntilDue <= PRIORITY_THRESHOLDS.high) return 'high';
  if (timeUntilDue <= PRIORITY_THRESHOLDS.medium) return 'medium';

  return 'low';
}

/**
 * Compute a numeric priority score for fine-grained sorting.
 * Higher score = more urgent.
 */
export function computePriorityScore(input: PriorityInput, now: Date = new Date()): number {
  const { dueAt, availableAt, isSubmitted, isLocked, isOverdue, pointsPossible, sourceType } = input;
  const nowMs = now.getTime();
  let score = 0;

  // Base: submitted tasks get low score
  if (isSubmitted) return 10;

  // Locked tasks slightly above submitted
  if (isLocked) {
    // If it unlocks soon, give some priority
    if (availableAt) {
      const timeUntilUnlock = availableAt.getTime() - nowMs;
      if (timeUntilUnlock > 0 && timeUntilUnlock < 24 * HOUR) {
        score += 20;
      }
    }
    return score + 15;
  }

  // Overdue: high urgency
  if (isOverdue) {
    score += 800;
    // More overdue = slightly higher (but capped)
    if (dueAt) {
      const overdueHours = Math.min((nowMs - dueAt.getTime()) / HOUR, 168); // cap at 1 week
      score += overdueHours * 2;
    }
    return score;
  }

  // Due date urgency
  if (dueAt) {
    const timeUntilDue = dueAt.getTime() - nowMs;

    if (timeUntilDue <= 0) {
      score += 800; // overdue
    } else if (timeUntilDue <= PRIORITY_THRESHOLDS.critical) {
      score += 700; // critical
    } else if (timeUntilDue <= PRIORITY_THRESHOLDS.high) {
      score += 500; // high
    } else if (timeUntilDue <= PRIORITY_THRESHOLDS.medium) {
      score += 300; // medium
    } else {
      // Further out, lower score, inversely proportional to time
      score += Math.max(50, 200 - (timeUntilDue / HOUR));
    }
  } else {
    // No due date — lower priority
    score += 30;
  }

  // Available now bonus
  if (!availableAt || nowMs >= availableAt.getTime()) {
    score += 50;
  }

  // Quiz bonus (quizzes often have time limits)
  if (sourceType === 'quiz') {
    score += 25;
  }

  // Points bonus (high-value tasks are more important)
  if (pointsPossible && pointsPossible > 0) {
    score += Math.min(pointsPossible / 10, 20);
  }

  return Math.round(score);
}

// ─── Availability Helpers ──────────────────────────────────────────────

export function isTaskAvailable(
  availableAt?: Date | null,
  lockAt?: Date | null,
  isLocked?: boolean,
  now: Date = new Date(),
): boolean {
  if (isLocked) return false;
  if (lockAt && now.getTime() > lockAt.getTime()) return false;
  if (availableAt && now.getTime() < availableAt.getTime()) return false;
  return true;
}

export function isTaskOverdue(
  dueAt?: Date | null,
  isSubmitted?: boolean,
  now: Date = new Date(),
): boolean {
  if (isSubmitted) return false;
  if (!dueAt) return false;
  return now.getTime() > dueAt.getTime();
}

export function isTaskLocked(
  isLocked?: boolean,
  lockAt?: Date | null,
  now: Date = new Date(),
): boolean {
  if (isLocked) return true;
  if (lockAt && now.getTime() > lockAt.getTime()) return true;
  return false;
}
