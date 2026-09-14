'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import type { TaskData } from '@/app/page';

interface CalendarTask {
  id: string;
  title: string;
  sourceType: string;
  dueAt: string | null;
  availableAt: string | null;
  status: string;
  priority: string;
  isSubmitted: boolean;
  course: {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [itemsByDate, setItemsByDate] = useState<Record<string, CalendarTask[]>>({});
  const [selectedDate, setSelectedDate] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/calendar?year=${currentYear}&month=${currentMonth}`);
      if (!res.ok) throw new Error('Failed to fetch calendar');
      const data = await res.json();
      setItemsByDate(data.itemsByDate || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    setSelectedDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        setLastSynced(new Date().toISOString());
        await fetchCalendar();
      }
    } finally {
      setSyncing(false);
    }
  };

  // Open full task details
  const handleTaskClick = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTask(data.task);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calendar matrix calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  // Monday-based index (0 = Monday, 6 = Sunday)
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;

  // Previous month padding days
  const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
  const calendarCells = [];

  for (let i = startDay - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      dateString: '',
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      dateString: dStr,
    });
  }

  // Next month padding to round up to full weeks
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const remaining = totalCells - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({
      day: i,
      isCurrentMonth: false,
      dateString: '',
    });
  }

  const selectedTasks = selectedDate ? itemsByDate[selectedDate] || [] : [];

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="calendar" />

      <main
        className={`flex-1 pb-24 md:pb-8 transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        } ml-0`}
      >
        <Header lastSynced={lastSynced} syncing={syncing} onSync={handleSync} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Academic Calendar</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Deadlines and schedules synced from ELTE Canvas
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleToday}
                className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors shadow-sm"
              >
                Today
              </button>
              <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-0.5 shadow-sm">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                  aria-label="Previous Month"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="px-3 text-sm font-semibold text-[var(--color-text)] min-w-[140px] text-center">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                  aria-label="Next Month"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Calendar Grid */}
            <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="py-2.5 text-center text-xs font-semibold text-[var(--color-text-secondary)]">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-[var(--color-border)]">
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.dateString === selectedDate;
                  const isToday =
                    cell.dateString ===
                    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const tasks = cell.dateString ? itemsByDate[cell.dateString] || [] : [];

                  return (
                    <div
                      key={idx}
                      onClick={() => cell.isCurrentMonth && setSelectedDate(cell.dateString)}
                      className={`min-h-[100px] p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                        !cell.isCurrentMonth
                          ? 'bg-[var(--color-bg)] opacity-40 cursor-default'
                          : isSelected
                          ? 'bg-[var(--color-primary-bg)]/40'
                          : 'hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-[var(--color-primary)] text-white'
                              : isSelected
                              ? 'bg-[var(--color-primary-bg)] text-[var(--color-primary)]'
                              : 'text-[var(--color-text)]'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {tasks.length > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                            {tasks.length}
                          </span>
                        )}
                      </div>

                      {/* Task previews */}
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {tasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskClick(t.id);
                            }}
                            className={`text-[11px] truncate px-1.5 py-0.5 rounded font-medium ${
                              t.status === 'overdue'
                                ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
                                : t.isSubmitted
                                ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                                : 'bg-[var(--color-primary-bg)] text-[var(--color-primary)]'
                            }`}
                            title={t.title}
                          >
                            {t.title}
                          </div>
                        ))}
                        {tasks.length > 2 && (
                          <div className="text-[10px] text-[var(--color-text-tertiary)] px-1">
                            +{tasks.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar: Details for Selected Date */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm flex flex-col h-full">
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">
                Deadlines on {selectedDate || 'Selected Day'}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'} scheduled
              </p>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-[var(--color-surface-hover)] animate-pulse" />
                  ))}
                </div>
              ) : selectedTasks.length === 0 ? (
                <div className="text-center py-12 flex-1 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
                  <svg className="w-10 h-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2.25 2.25 0 002.25-2.25V7.5A2.25 2.25 0 0018.75 5H5.25A2.25 2.25 0 003 7.5v11.25A2.25 2.25 0 005.25 21z" />
                  </svg>
                  <p className="text-sm font-medium">No deadlines for this date</p>
                  <p className="text-xs mt-1">Select another day or enjoy your free time!</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto flex-1">
                  {selectedTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleTaskClick(t.id)}
                      className="p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-[var(--color-primary)] truncate max-w-[160px]">
                          {t.course.name}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            t.status === 'overdue'
                              ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                              : t.isSubmitted
                              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                              : 'bg-[var(--color-primary-bg)] text-[var(--color-primary)]'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                        {t.title}
                      </h3>
                      {t.dueAt && (
                        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1.5">
                          Due at {new Date(t.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      <MobileNav activePage="calendar" />
    </div>
  );
}
