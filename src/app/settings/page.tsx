'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

interface Preferences {
  taskAvailable: boolean;
  before24h: boolean;
  before6h: boolean;
  before1h: boolean;
  overdue: boolean;
  newAssignments: boolean;
  newQuizzes: boolean;
  changedDeadlines: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface CanvasConnection {
  id: string;
  instanceUrl: string;
  instanceName: string | null;
  canvasUserId: number | null;
  canvasUserName: string | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Preferences>({
    taskAvailable: true,
    before24h: true,
    before6h: true,
    before1h: true,
    overdue: true,
    newAssignments: true,
    newQuizzes: true,
    changedDeadlines: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const [prefRes, connRes] = await Promise.all([
        fetch('/api/notification-preferences'),
        fetch('/api/canvas/connect'),
      ]);

      if (prefRes.ok) {
        const data = await prefRes.json();
        if (data.preferences) {
          setPrefs({
            taskAvailable: data.preferences.taskAvailable ?? true,
            before24h: data.preferences.before24h ?? true,
            before6h: data.preferences.before6h ?? true,
            before1h: data.preferences.before1h ?? true,
            overdue: data.preferences.overdue ?? true,
            newAssignments: data.preferences.newAssignments ?? true,
            newQuizzes: data.preferences.newQuizzes ?? true,
            changedDeadlines: data.preferences.changedDeadlines ?? true,
            quietHoursStart: data.preferences.quietHoursStart ?? '22:00',
            quietHoursEnd: data.preferences.quietHoursEnd ?? '08:00',
          });
        }
      }

      if (connRes.ok) {
        const connData = await connRes.json();
        setConnections(connData.connections || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(!!sub);
        });
      });
    }
  }, [loadPreferences]);

  const handleTogglePush = async () => {
    if (!pushSupported) return;

    try {
      if (pushSubscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setPushSubscribed(false);
        setStatusMessage('Browser push notifications disabled.');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatusMessage('Notification permission denied.');
          return;
        }

        const keyRes = await fetch('/api/push/subscribe');
        const { publicKey } = await keyRes.json();
        if (!publicKey) {
          setStatusMessage('Push server not configured.');
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });

        const subJson = sub.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          }),
        });

        setPushSubscribed(true);
        setStatusMessage('Push notifications enabled for this device!');
      }
    } catch (err) {
      console.error('Push error:', err);
      setStatusMessage('Failed to update push subscription.');
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      const res = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this Canvas account?')) return;

    try {
      const res = await fetch(`/api/canvas/connect?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Error disconnecting Canvas:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col md:pl-64">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePage="settings"
      />

      <Header
        lastSynced={lastSynced}
        syncing={syncing}
        onSync={async () => {
          setSyncing(true);
          try {
            await fetch('/api/sync', { method: 'POST' });
            setLastSynced(new Date().toISOString());
          } finally {
            setSyncing(false);
          }
        }}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Settings & Accounts</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Manage your connected Canvas LMS accounts, push notification rules, and preferences.
            </p>
          </div>

          {/* Account Profile Card */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  {session?.user?.name || 'Student Account'}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {session?.user?.email || 'Logged in user'}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {/* Connected Canvas LMS Accounts */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">Connected Canvas Accounts</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Institutions synchronized with your CanvasFlow command center
                </p>
              </div>
              <Link
                href="/connect"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <span>+ Connect Canvas</span>
              </Link>
            </div>

            {connections.length === 0 ? (
              <div className="p-6 border border-dashed border-[var(--color-border)] rounded-xl text-center">
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  No Canvas accounts connected yet.
                </p>
                <Link
                  href="/connect"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  Connect Your University Canvas
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                        🎓
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text)]">
                            {conn.instanceName || 'Canvas LMS'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {conn.instanceUrl} • User: {conn.canvasUserName || 'Connected'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteConnection(conn.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 p-2 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Disconnect Canvas"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Web Push Notification Delivery */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">Browser Push Notifications</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Receive deadline alerts on your device even when the browser tab is closed
                </p>
              </div>
              <button
                onClick={handleTogglePush}
                disabled={!pushSupported}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  pushSubscribed
                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                }`}
              >
                {pushSubscribed ? 'Disable Push' : 'Enable Push Notifications'}
              </button>
            </div>
            {statusMessage && (
              <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl">
                {statusMessage}
              </p>
            )}
          </div>

          {/* Reminder Preferences */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Notification Schedule</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose when you want to be alerted for approaching deadlines
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'before24h', title: '24 Hours Before', desc: 'Reminder sent 1 day before due date' },
                { key: 'before6h', title: '6 Hours Before', desc: 'Urgent reminder on due date' },
                { key: 'before1h', title: '1 Hour Before', desc: 'Final countdown alert before deadline' },
                { key: 'overdue', title: 'Overdue Alert', desc: 'Notify immediately when deadline passes' },
                { key: 'taskAvailable', title: 'Task Available', desc: 'Notify when locked assignment unlocks' },
                { key: 'changedDeadlines', title: 'Deadline Changed', desc: 'Notify if instructor changes due date' },
              ].map((item) => (
                <label key={item.key} className="flex items-start justify-between p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] cursor-pointer">
                  <div className="pr-4">
                    <span className="text-xs font-semibold text-[var(--color-text)]">{item.title}</span>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[item.key as keyof Preferences] as boolean}
                    onChange={(e) =>
                      setPrefs({ ...prefs, [item.key]: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>

            {/* Quiet Hours */}
            <div className="border-t border-[var(--color-border)] pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Quiet Hours (Silence alerts during sleep)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={prefs.quietHoursStart || '22:00'}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">End Time</label>
                  <input
                    type="time"
                    value={prefs.quietHoursEnd || '08:00'}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {saveSuccess && (
                <span className="text-xs font-semibold text-emerald-400">
                  Preferences saved successfully!
                </span>
              )}
              <button
                onClick={handleSavePreferences}
                disabled={saving || loading}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-400 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold text-slate-200 mb-0.5">Enterprise Token Encryption (AES-256-GCM)</p>
              <p>
                Your Canvas personal access tokens are encrypted at rest using server-side AES-256-GCM authenticated encryption. Tokens are decrypted only inside ephemeral serverless sync routines and are never sent to browser clients.
              </p>
            </div>
          </div>
        </div>
      </main>

      <MobileNav activePage="settings" />
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
