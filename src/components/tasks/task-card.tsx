'use client';

import React from 'react';
import {
  formatRelativeDeadline,
  formatRelativeAvailability,
  formatDateTime,
} from '@/lib/dates';
import {
  QuizTabletIcon,
  AssignmentDocIcon,
  ScoreMedalIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  ChevronRightIcon,
} from '@/components/ui/icons';
import type { TaskData } from '@/app/page';

interface TaskCardProps {
  task: TaskData;
  onClick: () => void;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  overdue: {
    label: 'Overdue',
    color: 'var(--color-danger-text)',
    bg: 'var(--color-danger-bg)',
    border: 'var(--color-danger-border)',
  },
  'due-soon': {
    label: 'Due Soon',
    color: 'var(--color-warning-text)',
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
  },
  available: {
    label: 'Available',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-bg)',
    border: 'var(--color-primary-border)',
  },
  submitted: {
    label: 'Submitted',
    color: 'var(--color-success-text)',
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
  },
  completed: {
    label: 'Completed',
    color: 'var(--color-success-text)',
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
  },
  upcoming: {
    label: 'Upcoming',
    color: 'var(--color-text-secondary)',
    bg: 'var(--color-surface-hover)',
    border: 'var(--color-border)',
  },
  locked: {
    label: 'Locked',
    color: 'var(--color-text-tertiary)',
    bg: 'var(--color-surface-hover)',
    border: 'var(--color-border)',
  },
};

const priorityIndicator: Record<string, string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-primary)',
  low: 'var(--color-text-tertiary)',
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const isCompletedOrSubmitted =
    task.isSubmitted ||
    task.status === 'completed' ||
    task.status === 'submitted' ||
    task.submission?.score != null ||
    task.score != null;

  const effectiveStatusKey = isCompletedOrSubmitted
    ? 'completed'
    : task.status;
  const status = statusConfig[effectiveStatusKey] || statusConfig.available;

  // Submitted tasks always have low priority color
  const priorityColor = isCompletedOrSubmitted
    ? 'var(--color-success)'
    : priorityIndicator[task.priority] || priorityIndicator.low;

  // Deadline & availability text
  let deadlineText = '';
  if (task.dueAt) {
    deadlineText = formatRelativeDeadline(task.dueAt);
  }

  let availabilityText = '';
  if (
    (task.status === 'locked' || task.status === 'upcoming') &&
    task.availableAt
  ) {
    availabilityText = formatRelativeAvailability(task.availableAt);
  }

  // Submission info
  const earnedScore = task.submission?.score ?? task.score ?? null;
  const points = task.pointsPossible;
  const attempt = task.submission?.attempt;
  const allowsRetake =
    task.sourceType === 'quiz' &&
    (task.quizDetails?.allowedAttempts === -1 ||
      (typeof task.quizDetails?.allowedAttempts === 'number' &&
        task.quizDetails.allowedAttempts > (attempt || 1)));

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-[var(--color-surface)] border rounded-2xl p-4 sm:p-5 transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] hover:shadow-md ${
        isCompletedOrSubmitted
          ? 'border-emerald-500/20 hover:border-emerald-500/40'
          : 'border-[var(--color-border)] hover:border-[var(--color-primary-border)]'
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Priority / Completed accent bar */}
        <div
          className="w-1.5 self-stretch min-h-12 rounded-full flex-shrink-0 mt-0.5 transition-colors"
          style={{ backgroundColor: priorityColor }}
        />

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Course info + Status & Attempt badges */}
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {/* Type icon */}
              <div
                className={`p-1 rounded-lg shrink-0 ${
                  task.sourceType === 'quiz'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-blue-500/10 text-blue-500'
                }`}
              >
                {task.sourceType === 'quiz' ? (
                  <QuizTabletIcon className="w-3.5 h-3.5" />
                ) : (
                  <AssignmentDocIcon className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Course name */}
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide truncate max-w-[220px] sm:max-w-xs md:max-w-md">
                {task.courseName}
              </span>
            </div>

            {/* Badges container */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Attempt pill */}
              {isCompletedOrSubmitted && attempt && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  Attempt {attempt}
                </span>
              )}

              {/* Retake badge */}
              {isCompletedOrSubmitted && allowsRetake && (
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  Retake Allowed
                </span>
              )}

              {/* Status badge */}
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs"
                style={{
                  backgroundColor: status.bg,
                  color: status.color,
                  borderColor: status.border,
                }}
              >
                {isCompletedOrSubmitted ? (
                  <>
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </>
                ) : (
                  <>
                    {task.status === 'overdue' && <ClockIcon className="w-3 h-3" />}
                    {task.status === 'locked' && <LockIcon className="w-3 h-3" />}
                    <span>{status.label}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
            {task.title}
          </h3>

          {/* Bottom Meta Row */}
          <div className="flex items-center justify-between gap-3 mt-2.5 pt-2 border-t border-[var(--color-border)]/50 text-xs text-[var(--color-text-secondary)] flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Due date or submission timestamp */}
              {isCompletedOrSubmitted && task.submission?.submittedAt ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                  <span>Submitted {formatDateTime(task.submission.submittedAt)}</span>
                </span>
              ) : deadlineText ? (
                <span
                  className={`inline-flex items-center gap-1 ${
                    task.isOverdue && !isCompletedOrSubmitted
                      ? 'text-[var(--color-danger-text)] font-semibold'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5 shrink-0 opacity-75" />
                  <span>{deadlineText}</span>
                </span>
              ) : null}

              {/* Availability */}
              {availabilityText && !isCompletedOrSubmitted && (
                <span className="text-[var(--color-text-tertiary)]">
                  {availabilityText}
                </span>
              )}
            </div>

            {/* Score & Points Display */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {isCompletedOrSubmitted && earnedScore != null ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-2xs">
                  <ScoreMedalIcon className="w-3.5 h-3.5" />
                  <span>
                    {earnedScore}
                    {points != null ? ` / ${points} pts` : ' pts'}
                  </span>
                  {points != null && points > 0 && (
                    <span className="text-[10px] font-normal opacity-85 ml-0.5">
                      ({Math.round((earnedScore / points) * 100)}%)
                    </span>
                  )}
                </div>
              ) : points != null && points > 0 ? (
                <span className="font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-md text-xs border border-[var(--color-border)]">
                  {points} pts
                </span>
              ) : null}

              <ChevronRightIcon className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
