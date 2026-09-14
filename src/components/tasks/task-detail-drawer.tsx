'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import {
  formatDateTime,
  formatRelativeDeadline,
  formatRelativeAvailability,
} from '@/lib/dates';
import {
  ScoreMedalIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  CloseIcon,
  ExternalLinkIcon,
  QuizTabletIcon,
  AssignmentDocIcon,
} from '@/components/ui/icons';
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

  const isCompletedOrSubmitted =
    task.isSubmitted ||
    task.status === 'completed' ||
    task.status === 'submitted' ||
    task.submission?.score != null ||
    task.score != null;

  const earnedScore = task.submission?.score ?? task.score ?? null;
  const points = task.pointsPossible;
  const percentage =
    earnedScore != null && points != null && points > 0
      ? Math.round((earnedScore / points) * 1000) / 10
      : null;

  const attempt = task.submission?.attempt;
  const allowsRetake =
    task.sourceType === 'quiz' &&
    (task.quizDetails?.allowedAttempts === -1 ||
      (typeof task.quizDetails?.allowedAttempts === 'number' &&
        task.quizDetails.allowedAttempts > (attempt || 1)));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 animate-fadeIn transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Task details: ${task.title}`}
        className="fixed right-0 top-0 h-full w-full max-w-lg md:max-w-xl bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col focus:outline-none animate-slideIn"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isCompletedOrSubmitted
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : task.status === 'overdue'
                    ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}
            >
              {isCompletedOrSubmitted ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </>
              ) : (
                <>
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span className="capitalize">{task.status}</span>
                </>
              )}
            </span>

            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center gap-1 border border-[var(--color-border)]">
              {task.sourceType === 'quiz' ? (
                <QuizTabletIcon className="w-3 h-3 text-amber-500" />
              ) : (
                <AssignmentDocIcon className="w-3 h-3 text-blue-500" />
              )}
              <span>{task.sourceType}</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Course Badge */}
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            {task.courseName}
            {task.courseCode && <span className="ml-1 opacity-70">· {task.courseCode}</span>}
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight">
            {task.title}
          </h2>

          {/* Grade & Submission Hero Card */}
          {isCompletedOrSubmitted && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ScoreMedalIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                      Submission Result
                    </h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Recorded on Canvas
                    </p>
                  </div>
                </div>

                {earnedScore != null && (
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {earnedScore}
                    </span>
                    {points != null && (
                      <span className="text-sm font-semibold text-[var(--color-text-tertiary)] ml-1">
                        / {points} pts
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Score Progress Bar */}
              {percentage != null && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-700 dark:text-emerald-300">Grade Score</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{percentage}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-emerald-500/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submission details */}
              <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
                {task.submission?.submittedAt && (
                  <div>
                    <span className="text-[var(--color-text-tertiary)] block">Submitted</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      {formatDateTime(task.submission.submittedAt)}
                    </span>
                  </div>
                )}
                {attempt && (
                  <div>
                    <span className="text-[var(--color-text-tertiary)] block">Attempt</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      Attempt {attempt}
                    </span>
                  </div>
                )}
              </div>

              {/* Retake Notice */}
              {allowsRetake && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/40 dark:bg-black/20 text-xs text-[var(--color-text-secondary)] border border-emerald-500/20">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    Retake Available:
                  </span>{' '}
                  This quiz allows unlimited attempts on Canvas. You have already completed this task, and your highest score will be kept.
                </div>
              )}
            </div>
          )}

          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
            {task.dueAt && (
              <DetailItem label="Due At" value={formatDateTime(task.dueAt)} />
            )}
            {task.dueAt && (
              <DetailItem
                label="Deadline Status"
                value={
                  isCompletedOrSubmitted
                    ? 'Met & Submitted'
                    : formatRelativeDeadline(task.dueAt)
                }
              />
            )}
            {task.availableAt && (
              <DetailItem label="Available From" value={formatDateTime(task.availableAt)} />
            )}
            {task.pointsPossible != null && (
              <DetailItem label="Total Points" value={`${task.pointsPossible} pts`} />
            )}
            {task.quizDetails?.allowedAttempts && (
              <DetailItem
                label="Allowed Attempts"
                value={
                  task.quizDetails.allowedAttempts === -1
                    ? 'Unlimited'
                    : String(task.quizDetails.allowedAttempts)
                }
              />
            )}
            {task.quizDetails?.timeLimit && (
              <DetailItem
                label="Time Limit"
                value={`${task.quizDetails.timeLimit} minutes`}
              />
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Instructions / Description
              </h3>
              <div
                className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] [&_a]:text-blue-500 [&_a]:underline leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(task.description, {
                    ALLOWED_TAGS: [
                      'b',
                      'i',
                      'em',
                      'strong',
                      'a',
                      'p',
                      'br',
                      'ul',
                      'ol',
                      'li',
                      'code',
                      'pre',
                      'blockquote',
                      'span',
                    ],
                    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                  }),
                }}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        {task.url && task.url.startsWith('https://') && (
          <div className="sticky bottom-0 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] p-4 flex gap-3">
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/25 transition-all duration-150 active:scale-98"
            >
              <span>{isCompletedOrSubmitted ? 'Open Quiz on Canvas' : 'Complete on Canvas'}</span>
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[var(--color-text)] mt-0.5 truncate">
        {value}
      </dd>
    </div>
  );
}
