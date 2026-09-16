'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { formatRelativeDeadline } from '@/lib/dates';

interface CourseItem {
  id: string;
  canvasCourseId: number;
  name: string;
  code: string | null;
  semester: string | null;
  workflowState: string;
  color: string | null;
  lastSyncedAt: string | null;
  stats: {
    pending: number;
    overdue: number;
    dueThisWeek: number;
    total: number;
  };
  nextDeadline: string | null;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [semesters, setSemesters] = useState<Array<{ id: string; label: string; courseCount?: number }>>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      const data = await res.json();
      setCourses(data.courses || []);
      if (data.availableSemesters) {
        setSemesters(data.availableSemesters);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setLastSynced(new Date().toISOString());
        await fetchCourses();
      }
    } finally {
      setSyncing(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSemester = selectedSemester === 'all' || c.semester === selectedSemester;
    if (!matchesSemester) return false;

    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q));
  });

  return (
    <div className="flex min-h-screen w-full max-w-full bg-[var(--color-bg)] overflow-x-clip">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="courses" />

      <main
        className={`flex-1 w-full min-w-0 max-w-full pb-24 md:pb-8 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        } ml-0`}
      >
        <Header lastSynced={lastSynced} syncing={syncing} onSync={handleSync} />

        <div className="w-full max-w-6xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">My Courses</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Active Canvas courses and their current assignment workloads
              </p>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Semester Filter Tabs */}
          {semesters.length > 1 && (
            <div className="w-full min-w-0 max-w-full flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none touch-pan-x">
              <button
                onClick={() => setSelectedSemester('all')}
                className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  selectedSemester === 'all'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
                }`}
              >
                All Semesters
              </button>
              {semesters.map((sem) => (
                <button
                  key={sem.id}
                  onClick={() => setSelectedSemester(sem.id)}
                  className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    selectedSemester === sem.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
                  }`}
                >
                  <span>{sem.label}</span>
                  {typeof sem.courseCount === 'number' && (
                    <span className="ml-1.5 opacity-75">({sem.courseCount})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-16 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8">
              <p className="text-base font-semibold text-[var(--color-text)]">No courses found</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Try running a Canvas sync to load active courses.
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="group flex flex-col justify-between p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
                        {course.code || 'COURSE'}
                      </span>
                      {course.stats.overdue > 0 ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                          {course.stats.overdue} overdue
                        </span>
                      ) : course.stats.pending > 0 ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                          {course.stats.pending} pending
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--color-success-bg)] text-[var(--color-success)]">
                          Caught up
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                      {course.name}
                    </h2>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                    <div>
                      <span className="font-semibold text-[var(--color-text)]">{course.stats.total}</span> total tasks
                    </div>
                    {course.nextDeadline ? (
                      <div className="text-right">
                        <span className="text-[var(--color-primary)] font-medium">
                          {formatRelativeDeadline(new Date(course.nextDeadline))}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[var(--color-text-tertiary)]">No upcoming due</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNav activePage="courses" />
    </div>
  );
}
