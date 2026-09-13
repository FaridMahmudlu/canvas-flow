'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { formatDateTime, formatRelativeDeadline, formatRelativeAvailability } from '@/lib/dates';
import type { TaskData } from '@/app/page';

interface TaskDetailDrawerProps {
  task: TaskData;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap focus
  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    'overdue': { label: 'Overdue', color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)' },
    'due-soon': { label: 'Due Soon', color: 'var(--color-warning-text)', bg: 'var(--color-warning-bg)' },
    'available': { label: 'Available Now', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
    'submitted': { label: 'Submitted', color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
    'completed': { label: 'Completed', color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
    'upcoming': { label: 'Upcoming', color: 'var(--color-text-secondary)', bg: 'var(--color-surface-hover)' },
    'locked': { label: 'Locked', color: 'var(--color-text-tertiary)', bg: 'var(--color-surface-hover)' },
  };

  const sc = statusColors[task.status] || statusColors['available'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-50 animate-fadeIn"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Task details: ${task.title}`}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-lg z-50 overflow-y-auto"
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: sc.bg, color: sc.color }}
            >
              {sc.label}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
              {task.sourceType}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Course */}
          <div className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            {task.courseName}
            {task.courseCode && <span className="ml-1">· {task.courseCode}</span>}
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-[var(--color-text)]">{task.title}</h2>

          {/* Key details */}
          <div className="grid grid-cols-2 gap-4">
            {task.dueAt && (
              <DetailItem label="Due At" value={formatDateTime(task.dueAt)} />
            )}
            {task.dueAt && (
              <DetailItem label="Deadline" value={formatRelativeDeadline(task.dueAt)} />
            )}
            {task.availableAt && (
              <DetailItem label="Available At" value={formatDateTime(task.availableAt)} />
            )}
            {task.availableAt && task.status === 'locked' && (
              <DetailItem label="Opens" value={formatRelativeAvailability(task.availableAt)} />
            )}
            {task.lockAt && (
              <DetailItem label="Locks At" value={formatDateTime(task.lockAt)} />
            )}
            {task.pointsPossible != null && task.pointsPossible > 0 && (
              <DetailItem label="Points" value={`${task.pointsPossible}`} />
            )}
          </div>

          {/* Submission info */}
          {task.submission && (
            <div className="p-4 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <h3 className="text-sm font-medium text-[var(--color-success-text)] mb-2">
                Submission
              </h3>
              <div className="space-y-1 text-sm text-[var(--color-success-text)]">
                {task.submission.submittedAt && (
                  <p>Submitted: {formatDateTime(task.submission.submittedAt)}</p>
                )}
                {task.submission.attempt && (
                  <p>Attempt: {task.submission.attempt}</p>
                )}
                {task.submission.grade && (
                  <p>Grade: {task.submission.grade}</p>
                )}
                {task.submission.score != null && (
                  <p>Score: {task.submission.score}{task.pointsPossible ? ` / ${task.pointsPossible}` : ''}</p>
                )}
              </div>
            </div>
          )}

          {/* Lock explanation */}
          {task.lockExplanation && (
            <div className="p-4 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-secondary)]">{task.lockExplanation}</p>
            </div>
          )}

          {/* Quiz details */}
          {task.quizDetails && (
            <div className="p-4 rounded-lg bg-[var(--color-primary-bg)] border border-[var(--color-primary-border)]">
              <h3 className="text-sm font-medium text-[var(--color-primary)] mb-2">Quiz Details</h3>
              <div className="space-y-1 text-sm text-[var(--color-primary)]">
                {task.quizDetails.timeLimit && (
                  <p>Time Limit: {task.quizDetails.timeLimit} minutes</p>
                )}
                {task.quizDetails.allowedAttempts && (
                  <p>
                    Allowed Attempts:{' '}
                    {task.quizDetails.allowedAttempts === -1
                      ? 'Unlimited'
                      : task.quizDetails.allowedAttempts}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Description</h3>
              <div
                className="prose prose-sm max-w-none text-[var(--color-text-secondary)] [&_a]:text-[var(--color-primary)] [&_a]:underline leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(task.description, {
                    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'code', 'pre', 'blockquote', 'span', 'div'],
                    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                  }),
                }}
              />
            </div>
          )}

          {/* Open in Canvas */}
          {task.url && task.url.startsWith('https://') && (
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Open in Canvas
            </a>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-text)] mt-0.5">{value}</dd>
    </div>
  );
}
