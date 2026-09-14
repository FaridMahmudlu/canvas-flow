'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

interface HealthCanvasResponse {
  status: string;
  connected: boolean;
  user?: { id: number; name: string };
  error?: string;
  canvasUrl?: string;
  mockMode?: boolean;
}

interface AppHealthResponse {
  status: string;
  timestamp: string;
  database?: string;
}

interface NotificationItem {
  id: string;
  taskTitle: string;
  courseName: string;
  type: string;
  scheduledFor: string;
  sentAt: string | null;
  state: string;
  errorMessage: string | null;
}

export default function DebugPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasHealth, setCanvasHealth] = useState<HealthCanvasResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppHealthResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [testingCanvas, setTestingCanvas] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const testCanvas = useCallback(async () => {
    try {
      setTestingCanvas(true);
      const res = await fetch('/api/health/canvas');
      const data = await res.json();
      setCanvasHealth(data);
    } catch (err) {
      setCanvasHealth({
        status: 'error',
        connected: false,
        error: err instanceof Error ? err.message : 'Network request failed',
      });
    } finally {
      setTestingCanvas(false);
    }
  }, []);

  const testApp = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setAppHealth(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    testCanvas();
    testApp();
    loadNotifications();
  }, [testCanvas, testApp, loadNotifications]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Sync completed: ${data.coursesCount} courses, ${data.tasksCount} tasks (${data.newTasks} new, ${data.updatedTasks} updated) in ${data.durationMs}ms`);
      } else {
        setSyncResult(`Sync error: ${data.error || 'Failed'}`);
      }
      loadNotifications();
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const res = await fetch('/api/cron/notifications', { method: 'POST' });
      const data = await res.json();
      alert(`Processed due notifications: scheduled ${data.scheduled}, sent ${data.sent}`);
      loadNotifications();
    } catch (err) {
      alert(`Notification test failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="debug" />

      <main className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} pb-24 md:pb-8`}>
        <Header lastSynced={null} syncing={syncing} onSync={handleManualSync} />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">System Diagnostics</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Canvas API connectivity, database health, and background notification logs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Canvas Health Card */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Canvas Connection</h2>
                <button
                  onClick={testCanvas}
                  disabled={testingCanvas}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  {testingCanvas ? 'Checking...' : 'Retest'}
                </button>
              </div>

              {canvasHealth ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-secondary)]">Status</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded ${
                        canvasHealth.connected
                          ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                          : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                      }`}
                    >
                      {canvasHealth.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-secondary)]">Base URL</span>
                    <span className="font-mono text-[var(--color-text)]">{canvasHealth.canvasUrl}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-secondary)]">Mock Mode</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      {canvasHealth.mockMode ? 'Active (Development)' : 'Disabled (Live API)'}
                    </span>
                  </div>
                  {canvasHealth.user && (
                    <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                      <span className="text-[var(--color-text-secondary)]">Authenticated User</span>
                      <span className="font-medium text-[var(--color-text)]">{canvasHealth.user.name}</span>
                    </div>
                  )}
                  {canvasHealth.error && (
                    <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-xs mt-2">
                      {canvasHealth.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-28 bg-[var(--color-surface-hover)] rounded-lg animate-pulse" />
              )}
            </div>

            {/* Application & Sync Status */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Sync Engine</h2>
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Trigger Sync Now'}
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">App Status</span>
                  <span className="font-semibold text-[var(--color-success)]">{appHealth?.status || 'OK'}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Local Timezone</span>
                  <span className="font-mono text-[var(--color-text)]">Europe/Budapest</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)]">Test Notification Worker</span>
                  <button
                    onClick={handleTestNotification}
                    className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                  >
                    Run Notification Worker
                  </button>
                </div>
                {syncResult && (
                  <div className="p-3 rounded-lg bg-[var(--color-primary-bg)] text-[var(--color-primary)] text-xs mt-2 font-mono">
                    {syncResult}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification Queue Table */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">
              Recent Notification Queue & History
            </h2>

            {notifications.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] py-4 text-center">
                No notifications recorded yet. Notifications are scheduled as tasks are synced.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="py-2.5 px-3">Task</th>
                      <th className="py-2.5 px-3">Course</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Scheduled For</th>
                      <th className="py-2.5 px-3">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {notifications.slice(0, 15).map((n) => (
                      <tr key={n.id} className="hover:bg-[var(--color-surface-hover)]">
                        <td className="py-2.5 px-3 font-medium text-[var(--color-text)] max-w-xs truncate">
                          {n.taskTitle}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">{n.courseName}</td>
                        <td className="py-2.5 px-3 font-mono uppercase">{n.type}</td>
                        <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                          {new Date(n.scheduledFor).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                              n.state === 'sent'
                                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                                : n.state === 'pending'
                                ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                                : 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                            }`}
                          >
                            {n.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <MobileNav activePage="debug" />
    </div>
  );
}
