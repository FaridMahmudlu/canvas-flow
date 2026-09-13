'use client';

import { formatRelativeDeadline, formatRelativeAvailability, formatDateTime } from '@/lib/dates';
import type { TaskData } from '@/app/page';

interface TaskCardProps {
  task: TaskData;
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  'overdue': { label: 'Overdue', color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)' },
  'due-soon': { label: 'Due Soon', color: 'var(--color-warning-text)', bg: 'var(--color-warning-bg)' },
  'available': { label: 'Available', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  'submitted': { label: 'Submitted', color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  'completed': { label: 'Completed', color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  'upcoming': { label: 'Upcoming', color: 'var(--color-text-secondary)', bg: 'var(--color-surface-hover)' },
  'locked': { label: 'Locked', color: 'var(--color-text-tertiary)', bg: 'var(--color-surface-hover)' },
};

const priorityIndicator: Record<string, string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-primary)',
  low: 'var(--color-text-tertiary)',
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const status = statusConfig[task.status] || statusConfig['available'];
  const priorityColor = priorityIndicator[task.priority] || priorityIndicator['low'];

  // Build deadline text
  let deadlineText = '';
  if (task.dueAt) {
    deadlineText = formatRelativeDeadline(task.dueAt);
  }

  // Build availability text for locked/upcoming
  let availabilityText = '';
  if (task.status === 'locked' && task.availableAt) {
    availabilityText = formatRelativeAvailability(task.availableAt);
  } else if (task.status === 'upcoming' && task.availableAt) {
    availabilityText = formatRelativeAvailability(task.availableAt);
  }

  // Submission info
  let submissionText = '';
  if (task.isSubmitted && task.submission?.submittedAt) {
    submissionText = `Submitted ${formatDateTime(task.submission.submittedAt)}`;
  } else if (task.isOverdue && !task.isSubmitted) {
    submissionText = 'Not submitted';
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:shadow-md hover:border-[var(--color-primary-border)] transition-all duration-200 group focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <div className="flex items-start gap-3">
        {/* Priority indicator */}
        <div
          className="w-1 h-12 rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: priorityColor }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Type icon */}
            {task.sourceType === 'quiz' ? (
              <QuizIcon className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
            ) : (
              <AssignmentIcon className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
            )}

            {/* Course name */}
            <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide truncate">
              {task.courseName}
            </span>

            {/* Status badge */}
            <span
              className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {status.label}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors truncate">
            {task.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-text-secondary)]">
            {deadlineText && (
              <span className={task.isOverdue ? 'text-[var(--color-danger-text)] font-medium' : ''}>
                {deadlineText}
              </span>
            )}
            {availabilityText && (
              <span>{availabilityText}</span>
            )}
            {submissionText && (
              <span className={task.isOverdue && !task.isSubmitted ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-success-text)]'}>
                {submissionText}
              </span>
            )}
            {task.pointsPossible != null && task.pointsPossible > 0 && (
              <span className="ml-auto">{task.pointsPossible} pts</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <svg
          className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] transition-colors mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────

function AssignmentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function QuizIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}
