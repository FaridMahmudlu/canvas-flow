'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Greeting } from '@/components/dashboard/greeting';
import { StatsRow } from '@/components/dashboard/stats-row';
import { TaskSection } from '@/components/dashboard/task-section';
import { TaskFilters } from '@/components/tasks/task-filters';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { EmptyState } from '@/components/ui/empty-state';

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

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (courseFilter !== 'all') params.set('courseId', courseFilter);

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
  }, [searchQuery, courseFilter]);

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
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const result = await res.json();
      if (result.success) {
        setLastSynced(new Date().toISOString());
        await fetchTasks();
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
    fetchSyncStatus();
  }, [fetchTasks, fetchSyncStatus]);

  // Filter tasks by status tab
  const filteredTasks =
    filter === 'all'
      ? tasks
      : tasks.filter((t) => {
          switch (filter) {
            case 'assignments':
              return t.sourceType === 'assignment';
            case 'quizzes':
              return t.sourceType === 'quiz';
            case 'overdue':
              return t.status === 'overdue';
            case 'available':
              return t.status === 'available' || t.status === 'due-soon';
            case 'submitted':
              return t.status === 'submitted' || t.status === 'completed';
            case 'upcoming':
              return t.status === 'upcoming' || t.status === 'locked';
            default:
              return true;
          }
        });

  // Group tasks by status for dashboard sections
  const focusTasks = tasks.filter(
    (t) => t.status === 'overdue' || (t.status === 'due-soon' && t.priority === 'critical'),
  );
  const dueSoonTasks = tasks.filter(
    (t) => t.status === 'due-soon' && t.priority !== 'critical',
  );
  const availableTasks = tasks.filter((t) => t.status === 'available');
  const upcomingTasks = tasks.filter(
    (t) => t.status === 'upcoming' || t.status === 'locked',
  );
  const completedTasks = tasks.filter(
    (t) => t.status === 'submitted' || t.status === 'completed',
  );

  // Get unique courses for filter
  const courses = Array.from(
    new Map(tasks.map((t) => [t.courseId, { id: t.courseId, name: t.courseName }])).values(),
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="dashboard" />

      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Header
          lastSynced={lastSynced}
          syncing={syncing}
          onSync={handleSync}
        />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <Greeting />

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
                  title="No tasks yet"
                  description="Click 'Sync Now' to fetch your assignments from Canvas."
                  action={
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                    >
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
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
    </div>
  );
}
