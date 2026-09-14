'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { MobileNav } from '@/components/layout/mobile-nav';
import type { TaskData } from '@/app/page';

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id: courseId } = use(params);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [courseName, setCourseName] = useState<string>('Course Details');
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);

  const fetchCourseTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks?courseId=${courseId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.tasks || []);

      if (data.tasks && data.tasks.length > 0) {
        setCourseName(data.tasks[0].courseName);
        setCourseCode(data.tasks[0].courseCode);
      } else {
        // Fetch course info directly
        const courseRes = await fetch('/api/courses');
        if (courseRes.ok) {
          const cData = await courseRes.json();
          const match = cData.courses?.find((c: { id: string }) => c.id === courseId);
          if (match) {
            setCourseName(match.name);
            setCourseCode(match.code);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourseTasks();
  }, [fetchCourseTasks]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setLastSynced(new Date().toISOString());
        await fetchCourseTasks();
      }
    } finally {
      setSyncing(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    switch (filter) {
      case 'assignments':
        return t.sourceType === 'assignment';
      case 'quizzes':
        return t.sourceType === 'quiz';
      case 'overdue':
        return t.status === 'overdue';
      case 'pending':
        return !t.isSubmitted && !t.isLocked;
      case 'submitted':
        return t.isSubmitted;
      default:
        return true;
    }
  });

  const pendingCount = tasks.filter((t) => !t.isSubmitted && !t.isLocked).length;
  const overdueCount = tasks.filter((t) => t.status === 'overdue').length;
  const completedCount = tasks.filter((t) => t.isSubmitted).length;

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="courses" />

      <main className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} pb-24 md:pb-8`}>
        <Header lastSynced={lastSynced} syncing={syncing} onSync={handleSync} />

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/courses"
              className="inline-flex items-center text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to all courses
            </Link>
          </div>

          {/* Course Banner */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
                    {courseCode || 'COURSE'}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">{courseName}</h1>
              </div>

              <div className="flex items-center space-x-4 border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-4 md:pt-0 md:pl-6">
                <div className="text-center">
                  <div className="text-xl font-bold text-[var(--color-text)]">{tasks.length}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Total Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-[var(--color-warning)]">{pendingCount}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Pending</div>
                </div>
                {overdueCount > 0 && (
                  <div className="text-center">
                    <div className="text-xl font-bold text-[var(--color-danger)]">{overdueCount}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">Overdue</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xl font-bold text-[var(--color-success)]">{completedCount}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Completed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 border-b border-[var(--color-border)] pb-3 mb-6 overflow-x-auto">
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'pending', label: 'Pending' },
              { id: 'assignments', label: 'Assignments' },
              { id: 'quizzes', label: 'Quizzes' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'submitted', label: 'Submitted' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Task List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              title="No tasks in this category"
              description="No tasks match the active filter for this course."
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => setSelectedTask(task)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      <MobileNav activePage="courses" />
    </div>
  );
}
