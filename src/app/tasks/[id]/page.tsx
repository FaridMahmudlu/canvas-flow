'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ScoreMedalIcon, CheckCircleIcon, QuizTabletIcon, AssignmentDocIcon, CalendarDialIcon, ClockIcon } from '@/components/ui/icons';
import { formatDateTime, formatRelativeDeadline, formatRelativeAvailability } from '@/lib/dates';
import type { TaskData } from '@/app/page';

interface TaskPageProps {
  params: Promise<{ id: string }>;
}

export default function TaskDetailPage({ params }: TaskPageProps) {
  const { id: taskId } = use(params);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Task not found in your synced assignments.');
        throw new Error('Failed to load task details.');
      }
      const data = await res.json();
      setTask(data.task);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setLastSynced(new Date().toISOString());
        await fetchTask();
      }
    } finally {
      setSyncing(false);
    }
  };

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    'due-soon': { bg: 'bg-[var(--color-warning-bg)]', text: 'text-[var(--color-warning)]', label: 'Due Soon' },
    overdue: { bg: 'bg-[var(--color-danger-bg)]', text: 'text-[var(--color-danger)]', label: 'Overdue' },
    available: { bg: 'bg-[var(--color-primary-bg)]', text: 'text-[var(--color-primary)]', label: 'Available Now' },
    submitted: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success)]', label: 'Submitted' },
    completed: { bg: 'bg-[var(--color-success-bg)]', text: 'text-[var(--color-success)]', label: 'Completed' },
    locked: { bg: 'bg-[var(--color-border)]', text: 'text-[var(--color-text-tertiary)]', label: 'Locked' },
    upcoming: { bg: 'bg-[var(--color-border)]', text: 'text-[var(--color-text-secondary)]', label: 'Upcoming' },
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="dashboard" />

      <main className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} pb-24 md:pb-8`}>
        <Header lastSynced={lastSynced} syncing={syncing} onSync={handleSync} />

        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center space-x-2 text-sm text-[var(--color-text-secondary)]">
            <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            {task && (
              <>
                <Link href={`/courses/${task.courseId}`} className="hover:text-[var(--color-primary)] transition-colors">
                  {task.courseName}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-[var(--color-text)] font-medium truncate max-w-xs">
              {task?.title || 'Task Details'}
            </span>
          </div>

          {loading ? (
            <div className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse space-y-4">
              <div className="h-6 w-32 bg-[var(--color-surface-hover)] rounded" />
              <div className="h-8 w-3/4 bg-[var(--color-surface-hover)] rounded" />
              <div className="h-20 bg-[var(--color-surface-hover)] rounded" />
            </div>
          ) : error || !task ? (
            <div className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center">
              <p className="text-base font-semibold text-[var(--color-danger)] mb-2">Unable to load task</p>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">{error}</p>
              <Link
                href="/"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          ) : (() => {
            const earnedScore = task.score ?? task.submission?.score;
            const earnedGrade = task.grade ?? task.submission?.grade;
            const isCompleted = task.isSubmitted || earnedScore != null || earnedGrade != null || task.status === 'completed';
            const percent = earnedScore != null && task.pointsPossible && task.pointsPossible > 0
              ? Math.round((earnedScore / task.pointsPossible) * 100)
              : null;

            return (
              <div className="space-y-6">
                {/* Main Card */}
                <div className="p-6 md:p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
                      {task.courseCode || task.courseName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
                      {task.sourceType === 'quiz' ? <QuizTabletIcon className="w-3.5 h-3.5 text-purple-500" /> : <AssignmentDocIcon className="w-3.5 h-3.5 text-indigo-500" />}
                      {task.sourceType}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : statusColors[task.status]?.bg || 'bg-[var(--color-border)]'
                      } ${!isCompleted ? (statusColors[task.status]?.text || 'text-[var(--color-text)]') : ''}`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                          Completed
                        </>
                      ) : (
                        statusColors[task.status]?.label || task.status
                      )}
                    </span>
                    {task.priority && task.priority !== 'low' && !isCompleted && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${
                          task.priority === 'critical'
                            ? 'bg-red-500 text-white'
                            : task.priority === 'high'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        {task.priority} Priority
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-4">
                    {task.title}
                  </h1>

                  {/* Submission & Score Hero Card */}
                  {isCompleted && (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-emerald-900/20 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/80 mb-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <ScoreMedalIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Submission Result
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 font-semibold">
                                Finished ✓
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              {task.submission?.submittedAt
                                ? `Submitted on ${formatDateTime(task.submission.submittedAt)}`
                                : 'Completed on Canvas'}
                              {task.submission?.attempt ? ` • Attempt #${task.submission.attempt}` : ''}
                            </p>
                          </div>
                        </div>

                        {earnedScore != null && (
                          <div className="text-left sm:text-right pl-12 sm:pl-0">
                            <div className="flex items-baseline sm:justify-end space-x-1.5">
                              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                                {earnedScore}
                              </span>
                              {task.pointsPossible !== null && (
                                <span className="text-sm font-semibold text-emerald-600/80 dark:text-emerald-400">
                                  / {task.pointsPossible} pts
                                </span>
                              )}
                              {percent !== null && (
                                <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                  {percent}%
                                </span>
                              )}
                            </div>
                            {earnedGrade && earnedGrade !== String(earnedScore) && (
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                Grade: {earnedGrade}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Percentage Bar */}
                      {percent !== null && (
                        <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-800/50">
                          <div className="w-full bg-emerald-200/50 dark:bg-emerald-950 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {task.quizDetails?.allowedAttempts === -1 && (
                        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-2.5 flex items-center gap-1.5">
                          <span>🔄</span>
                          <span>Unlimited attempts allowed on Canvas. You may retake this quiz to improve your score anytime.</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Key Timing Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] mb-6 text-xs">
                    <div>
                      <span className="text-[var(--color-text-secondary)] font-medium block mb-0.5 flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        Due Date
                      </span>
                      <span className="font-semibold text-sm text-[var(--color-text)]">
                        {task.dueAt ? formatDateTime(task.dueAt) : 'No due date'}
                      </span>
                      {task.dueAt && (
                        <span className="block text-[var(--color-primary)] font-medium mt-0.5">
                          {formatRelativeDeadline(task.dueAt)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[var(--color-text-secondary)] font-medium block mb-0.5 flex items-center gap-1">
                        <CalendarDialIcon className="w-3.5 h-3.5 text-indigo-500" />
                        Availability
                      </span>
                      <span className="font-semibold text-sm text-[var(--color-text)]">
                        {task.availableAt ? formatDateTime(task.availableAt) : 'Always open'}
                      </span>
                      {task.availableAt && (
                        <span className="block text-[var(--color-text-secondary)] mt-0.5">
                          {formatRelativeAvailability(task.availableAt)}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[var(--color-text-secondary)] font-medium block mb-0.5 flex items-center gap-1">
                        <ScoreMedalIcon className="w-3.5 h-3.5 text-amber-500" />
                        Points / Grading
                      </span>
                      <span className="font-semibold text-sm text-[var(--color-text)]">
                        {task.pointsPossible !== null ? `${task.pointsPossible} pts possible` : 'Ungraded'}
                      </span>
                      {earnedScore != null && (
                        <span className="block text-[var(--color-success)] font-bold mt-0.5">
                          Scored: {earnedScore} pts {percent !== null ? `(${percent}%)` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quiz specifics */}
                  {task.quizDetails && (
                    <div className="p-4 rounded-xl bg-[var(--color-primary-bg)] border border-[var(--color-border)] text-xs text-[var(--color-primary)] mb-6 space-y-1">
                      <p className="font-bold text-sm">Quiz Parameters</p>
                      {task.quizDetails.timeLimit && <p>Time limit: {task.quizDetails.timeLimit} minutes</p>}
                      {task.quizDetails.allowedAttempts && (
                        <p>Allowed attempts: {task.quizDetails.allowedAttempts === -1 ? 'Unlimited' : task.quizDetails.allowedAttempts}</p>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {task.description && (
                    <div className="mb-6">
                      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-3">Assignment Description</h2>
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

                  {/* Direct Open in Canvas Link */}
                  {task.url && task.url.startsWith('https://') && (
                    <div className="pt-4 border-t border-[var(--color-border)]">
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-dark)] transition-all shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Task in ELTE Canvas
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      <MobileNav activePage="dashboard" />
    </div>
  );
}
