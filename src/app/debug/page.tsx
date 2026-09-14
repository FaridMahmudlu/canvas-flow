'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { formatSyncAge } from '@/lib/dates';

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

interface SyncRunItem {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  coursesCount: number | null;
  tasksCount: number | null;
  newTasks: number | null;
  updatedTasks: number | null;
  notificationsCount: number | null;
  rateLimitRemaining: number | null;
  requestCost: number | null;
  targetIntervalSeconds: number | null;
  currentIntervalSeconds: number | null;
  detectionLatencyMs: number | null;
  errorMessage: string | null;
  errorType: string | null;
  triggeredBy: string | null;
}

interface SyncStateData {
  targetIntervalSeconds: number;
  currentIntervalSeconds: number;
  consecutiveSuccesses: number;
  lastRateLimitRemaining: number | null;
  lastRequestCost: number | null;
  last429At: string | null;
  backoffUntil: string | null;
  lastSyncAt: string | null;
  lastSuccessSyncAt: string | null;
  lastDetectionLatencyMs: number | null;
  avgDetectionLatencyMs: number | null;
  worstDetectionLatencyMs: number | null;
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
  const [lastSync, setLastSync] = useState<SyncRunItem | null>(null);
  const [syncState, setSyncState] = useState<SyncStateData | null>(null);
  const [recentRuns, setRecentRuns] = useState<SyncRunItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [testingCanvas, setTestingCanvas] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

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

  const loadSyncData = useCallback(async () => {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        setLastSync(data.lastSync || null);
        setSyncState(data.syncState || null);
        setRecentRuns(data.recentRuns || []);
      }
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
    loadSyncData();
    loadNotifications();
  }, [testCanvas, testApp, loadSyncData, loadNotifications]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setSyncNotice(null);
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();

      if (res.status === 429 || data.backoffRemainingSec) {
        setSyncNotice('Canvas is temporarily rate-limited. Automatic retry is scheduled.');
      } else if (data.success) {
        setSyncNotice(
          `Sync completed successfully: ${data.coursesCount} courses, ${data.tasksCount} tasks (${data.newTasks} new, ${data.updatedTasks} updated) in ${data.durationMs}ms`,
        );
      } else {
        setSyncNotice(`Sync warning/error: ${data.error || 'Failed'}`);
      }
      await loadSyncData();
      await loadNotifications();
    } catch (err) {
      setSyncNotice(`Sync failed: ${err instanceof Error ? err.message : 'Unknown'}`);
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

  // Backoff calculation
  const nowMs = Date.now();
  const backoffUntilMs = syncState?.backoffUntil ? new Date(syncState.backoffUntil).getTime() : 0;
  const backoffSecondsRemaining = backoffUntilMs > nowMs ? Math.ceil((backoffUntilMs - nowMs) / 1000) : 0;

  // Formatting helper
  const formatTime = (ts?: string | null) => {
    if (!ts) return 'none';
    const d = new Date(ts);
    return `${d.toLocaleTimeString([], { hour12: false })} (${formatSyncAge(ts)})`;
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="debug" />

      <main className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} pb-24 md:pb-8`}>
        <Header lastSynced={lastSync?.completedAt || null} syncing={syncing} onSync={handleManualSync} />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">System & Sync Diagnostics</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  Adaptive Near-Real-Time
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Real-time Canvas API rate-limit telemetry, detection latency metrics, and execution diagnostics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm transition-all disabled:opacity-50 active:scale-95"
              >
                {syncing ? 'Syncing...' : 'Trigger Sync Now'}
              </button>
              <button
                onClick={() => {
                  testCanvas();
                  loadSyncData();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>

          {syncNotice && (
            <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono">
              {syncNotice}
            </div>
          )}

          {/* Core Adaptive Controller & Telemetry Grid (Section 13) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Connection Status */}
            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Canvas connection</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    canvasHealth?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-base font-bold text-[var(--color-text)]">
                  {canvasHealth?.connected ? 'CONNECTED' : 'ERROR'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
                {canvasHealth?.user ? canvasHealth.user.name : 'ELTE Canvas'}
              </p>
            </div>

            {/* Sync Mode & Interval */}
            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Sync mode & Interval</span>
              <div className="mt-2">
                <span className="text-base font-bold text-[var(--color-text)]">
                  Adaptive near-real-time
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                <span>Target: <strong className="text-[var(--color-text)]">{syncState?.targetIntervalSeconds || 60}s</strong></span>
                <span>•</span>
                <span>Current: <strong className="text-indigo-400">{syncState?.currentIntervalSeconds || 60}s</strong></span>
              </div>
            </div>

            {/* Rate Limit Remaining */}
            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Canvas rate-limit remaining</span>
              <div className="mt-2">
                <span className="text-base font-bold text-[var(--color-text)]">
                  {syncState?.lastRateLimitRemaining != null
                    ? syncState.lastRateLimitRemaining.toFixed(1)
                    : 'not provided'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">
                Last cost: {syncState?.lastRequestCost != null ? syncState.lastRequestCost.toFixed(2) : 'not provided'}
              </p>
            </div>

            {/* Backoff & Throttle Status */}
            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Current backoff</span>
              <div className="mt-2">
                <span
                  className={`text-base font-bold ${
                    backoffSecondsRemaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {backoffSecondsRemaining > 0 ? `${backoffSecondsRemaining} sec` : 'none'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Last 429: {formatTime(syncState?.last429At)}
              </p>
            </div>
          </div>

          {/* Section 13 Detailed Metrics Panel */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm mb-8">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">
              Operational Telemetry & Performance
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8 text-xs">
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Target interval:</span>
                <span className="font-semibold text-[var(--color-text)]">{syncState?.targetIntervalSeconds || 60} sec</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Current interval:</span>
                <span className="font-semibold text-indigo-400">{syncState?.currentIntervalSeconds || 60} sec</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Last sync status:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    lastSync?.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : lastSync?.status === 'rate_limited'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {lastSync?.status === 'completed' ? 'SUCCESS' : lastSync?.status === 'rate_limited' ? 'RATE_LIMITED' : 'FAILED'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Last sync:</span>
                <span className="font-mono text-[var(--color-text)]">{formatTime(syncState?.lastSyncAt)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Last successful sync:</span>
                <span className="font-mono text-[var(--color-text)]">{formatTime(syncState?.lastSuccessSyncAt)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Sync duration:</span>
                <span className="font-mono text-[var(--color-text)]">
                  {lastSync?.durationMs != null ? `${lastSync.durationMs} ms` : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Last detection latency:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {syncState?.lastDetectionLatencyMs != null
                    ? `${(syncState.lastDetectionLatencyMs / 1000).toFixed(1)} sec`
                    : 'N/A (no events in last cycle)'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Average detection latency:</span>
                <span className="font-mono text-[var(--color-text)]">
                  {syncState?.avgDetectionLatencyMs != null
                    ? `${(syncState.avgDetectionLatencyMs / 1000).toFixed(1)} sec`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Worst detection latency:</span>
                <span className="font-mono text-[var(--color-text)]">
                  {syncState?.worstDetectionLatencyMs != null
                    ? `${(syncState.worstDetectionLatencyMs / 1000).toFixed(1)} sec`
                    : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Tasks changed in last sync:</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(lastSync?.newTasks || 0) + (lastSync?.updatedTasks || 0)} ({lastSync?.newTasks || 0} new, {lastSync?.updatedTasks || 0} updated)
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Notifications triggered in last sync:</span>
                <span className="font-semibold text-indigo-400">{lastSync?.notificationsCount ?? 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--color-border)]">
                <span className="text-[var(--color-text-secondary)]">Consecutive healthy cycles:</span>
                <span className="font-semibold text-emerald-400">{syncState?.consecutiveSuccesses ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Recent Sync Runs Table */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm mb-8">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">
              Recent Sync Runs
            </h2>
            {recentRuns.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)] py-4 text-center">
                No sync runs recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="py-2.5 px-3">Started</th>
                      <th className="py-2.5 px-3">Trigger</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Courses / Tasks</th>
                      <th className="py-2.5 px-3">Changes</th>
                      <th className="py-2.5 px-3">Rate-Limit</th>
                      <th className="py-2.5 px-3">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-[var(--color-surface-hover)]">
                        <td className="py-2.5 px-3 font-mono text-[var(--color-text-secondary)]">
                          {formatTime(run.startedAt)}
                        </td>
                        <td className="py-2.5 px-3 capitalize font-medium">{run.triggeredBy || 'manual'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              run.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : run.status === 'rate_limited'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {run.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{run.durationMs != null ? `${run.durationMs}ms` : '—'}</td>
                        <td className="py-2.5 px-3">{run.coursesCount ?? '—'} / {run.tasksCount ?? '—'}</td>
                        <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                          +{run.newTasks ?? 0} / ~{run.updatedTasks ?? 0}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {run.rateLimitRemaining != null ? run.rateLimitRemaining.toFixed(0) : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400">
                          {run.detectionLatencyMs != null ? `${(run.detectionLatencyMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notification Queue Table */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Recent Notification Queue & History
              </h2>
              <button
                onClick={handleTestNotification}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Run Worker
              </button>
            </div>

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
                        <td className="py-2.5 px-3 font-medium text-[var(--color-text)] max-w-[200px] truncate">
                          {n.taskTitle}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-secondary)] max-w-[150px] truncate">
                          {n.courseName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400">
                            {n.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--color-text-secondary)]">
                          {new Date(n.scheduledFor).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              n.state === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : n.state === 'failed'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {n.state.toUpperCase()}
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
    </div>
  );
}
