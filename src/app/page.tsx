'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Greeting } from '@/components/dashboard/greeting';
import { StatsRow } from '@/components/dashboard/stats-row';
import { SemesterSelector } from '@/components/dashboard/semester-selector';
import { TaskSection } from '@/components/dashboard/task-section';
import { TaskFilters } from '@/components/tasks/task-filters';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { EmptyState } from '@/components/ui/empty-state';
import type { SemesterOption } from '@/lib/semester';

export interface TaskData {
  id: string;
  source: string;
  sourceType: string;
  canvasId: string;
  courseId: string;
  courseName: string;
  courseCode: string | null;
  title: string;
  description: string | null;
  url: string | null;
  availableAt: string | null;
  dueAt: string | null;
  lockAt: string | null;
  isAvailable: boolean;
  isLocked: boolean;
  isOverdue: boolean;
  isSubmitted: boolean;
  status: string;
  priority: string;
  priorityScore: number;
  pointsPossible: number | null;
  submissionTypes: string[];
  score?: number | null;
  grade?: string | null;
  submission: {
    submittedAt: string | null;
    attempt: number | null;
    grade: string | null;
    score: number | null;
    workflowState: string | null;
  } | null;
  lockExplanation: string | null;
  quizDetails: {
    timeLimit: number | null;
    allowedAttempts: number | null;
  } | null;
  lastSyncedAt: string;
}

interface TaskStats {
  dueSoon: number;
  availableNow: number;
  overdue: number;
  submitted: number;
  upcoming: number;
  locked: number;
  total: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    dueSoon: 0,
    availableNow: 0,
    overdue: 0,
    submitted: 0,
    upcoming: 0,
    locked: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');

  // Load saved semester preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasflow_selected_semester');
      if (saved) {
        setSelectedSemester(saved);
      }
    }
  }, []);

  const handleSemesterChange = (newSemester: string) => {
    setSelectedSemester(newSemester);
    setCourseFilter('all');
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasflow_selected_semester', newSemester);
    }
  };

  const fetchSemesters = useCallback(async () => {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        if (data.availableSemesters && Array.isArray(data.availableSemesters)) {
          setSemesters(data.availableSemesters);
          // If no semester is saved, pick the active/current one
          if (typeof window !== 'undefined' && !localStorage.getItem('canvasflow_selected_semester')) {
            const current = data.availableSemesters.find((s: SemesterOption) => s.isCurrent);
            if (current) {
              setSelectedSemester(current.id);
            }
          }
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (courseFilter !== 'all') params.set('courseId', courseFilter);
      if (selectedSemester && selectedSemester !== 'all') {
        params.set('semester', selectedSemester);
      }

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.tasks);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, courseFilter, selectedSemester]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        if (data.lastSync?.completedAt) {
          setLastSynced(data.lastSync.completedAt);
        }
      }
    } catch {
      // Silent fail for sync status
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const result = await res.json();
      if (res.status === 429 || result.backoffRemainingSec) {
        setError('Canvas is temporarily rate-limited. Automatic retry is scheduled.');
        return;
      }
      if (!res.ok && !result.success) {
        throw new Error(result.error || 'Sync failed');
      }
      if (result.success) {
        setLastSynced(new Date().toISOString());
        await Promise.all([fetchTasks(), fetchSemesters()]);
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [fetchTasks, fetchSemesters]);

  useEffect(() => {
    fetchTasks();
    fetchSemesters();
    fetchSyncStatus();
  }, [fetchTasks, fetchSemesters, fetchSyncStatus]);

  // Filter tasks by status tab
  const filteredTasks =
    filter === 'all'
      ? tasks
      : tasks.filter((t) => {
          const isDone =
            t.isSubmitted ||
            t.status === 'submitted' ||
            t.status === 'completed' ||
            t.score != null;

          switch (filter) {
            case 'assignments':
              return t.sourceType === 'assignment';
            case 'quizzes':
              return t.sourceType === 'quiz';
            case 'overdue':
              return !isDone && t.status === 'overdue';
            case 'available':
              return !isDone && (t.status === 'available' || t.status === 'due-soon');
            case 'submitted':
              return isDone;
            case 'upcoming':
              return !isDone && (t.status === 'upcoming' || t.status === 'locked');
            default:
              return true;
          }
        });

  // Group tasks by status for dashboard sections (submitted items never in focus/due soon)
  const isDoneTask = (t: TaskData) =>
    t.isSubmitted ||
    t.status === 'submitted' ||
    t.status === 'completed' ||
    t.score != null;

  const focusTasks = tasks.filter(
    (t) =>
      !isDoneTask(t) &&
      (t.status === 'overdue' || (t.status === 'due-soon' && t.priority === 'critical')),
  );
  const dueSoonTasks = tasks.filter(
    (t) =>
      !isDoneTask(t) &&
      t.status === 'due-soon' &&
      t.priority !== 'critical',
  );
  const availableTasks = tasks.filter((t) => !isDoneTask(t) && t.status === 'available');
  const upcomingTasks = tasks.filter(
    (t) =>
      !isDoneTask(t) &&
      (t.status === 'upcoming' || t.status === 'locked'),
  );
  const completedTasks = tasks.filter((t) => isDoneTask(t));

  // Get unique courses for filter
  const courses = Array.from(
    new Map(tasks.map((t) => [t.courseId, { id: t.courseId, name: t.courseName }])).values(),
  );

  const activeSemester = semesters.find((s) => s.id === selectedSemester);
  const greetingSemesterLabel =
    selectedSemester !== 'all' ? activeSemester?.label || selectedSemester : undefined;

  return (
    <div className="flex min-h-screen w-full max-w-full bg-[var(--color-bg)] overflow-x-clip">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="dashboard" />

      <main
        className={`flex-1 w-full min-w-0 max-w-full pb-24 md:pb-8 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        } ml-0`}
      >
        <Header
          lastSynced={lastSynced}
          syncing={syncing}
          onSync={handleSync}
        />

        <div className="w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8">
          <Greeting semesterLabel={greetingSemesterLabel} />

          <SemesterSelector
            semesters={semesters}
            selectedSemester={selectedSemester}
            onSelectSemester={handleSemesterChange}
            isLoading={loading}
          />

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] text-sm">
              {error}
            </div>
          )}

          <StatsRow stats={stats} loading={loading} />

          <TaskFilters
            activeFilter={filter}
            onFilterChange={setFilter}
            courseFilter={courseFilter}
            onCourseFilterChange={setCourseFilter}
            courses={courses}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filter !== 'all' ? (
            /* Filtered view */
            filteredTasks.length === 0 ? (
              <EmptyState
                title="No tasks found"
                description="Try adjusting your filters or search query."
              />
            ) : (
              <TaskSection
                title={filter.charAt(0).toUpperCase() + filter.slice(1)}
                tasks={filteredTasks}
                onTaskClick={setSelectedTask}
              />
            )
          ) : (
            /* Dashboard view with sections */
            <div className="space-y-8">
              {focusTasks.length > 0 && (
                <TaskSection
                  title="Focus Now"
                  subtitle="Tasks that need your immediate attention"
                  tasks={focusTasks}
                  onTaskClick={setSelectedTask}
                  variant="urgent"
                />
              )}

              {dueSoonTasks.length > 0 && (
                <TaskSection
                  title="Due Soon"
                  subtitle="Upcoming deadlines"
                  tasks={dueSoonTasks}
                  onTaskClick={setSelectedTask}
                />
              )}

              {availableTasks.length > 0 && (
                <TaskSection
                  title="Available Now"
                  subtitle="Ready to start"
                  tasks={availableTasks}
                  onTaskClick={setSelectedTask}
                />
              )}

              {upcomingTasks.length > 0 && (
                <TaskSection
                  title="Upcoming"
                  subtitle="Coming up soon"
                  tasks={upcomingTasks}
                  onTaskClick={setSelectedTask}
                  collapsible
                />
              )}

              {completedTasks.length > 0 && (
                <TaskSection
                  title="Completed"
                  subtitle="Recently submitted"
                  tasks={completedTasks}
                  onTaskClick={setSelectedTask}
                  collapsible
                  defaultCollapsed
                />
              )}

              {tasks.length === 0 && !loading && (
                <EmptyState
                  title="No tasks found"
                  description={
                    selectedSemester !== 'all'
                      ? "No assignments or quizzes found for this semester. Try selecting 'All Semesters' or connect your Canvas account."
                      : "Connect your Canvas account to synchronize your courses, assignments, and quizzes."
                  }
                  action={
                    <div className="flex items-center gap-3">
                      <Link
                        href="/connect"
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                      >
                        Connect Canvas LMS
                      </Link>
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                    </div>
                  }
                />
              )}
            </div>
          )}
        </div>
      </main>

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <MobileNav activePage="dashboard" />
    </div>
  );
}
