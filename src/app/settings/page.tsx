'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function SettingsPage() {
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

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notification-preferences');
      if (res.ok) {
        const data = await res.json();
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();

    // Check browser push notification support
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
        // Unsubscribe
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
        setStatusMessage('Push notifications disabled.');
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatusMessage('Notification permission was not granted.');
          return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          try {
            const keyRes = await fetch('/api/push/subscribe');
            if (keyRes.ok) {
              const keyData = await keyRes.json();
              if (keyData.publicKey) {
                vapidPublicKey = keyData.publicKey;
              }
            }
          } catch {
            // fallback to undefined
          }
        }

        const subOptions: PushSubscriptionOptionsInit = {
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey ? (urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource) : undefined,
        };

        const sub = await reg.pushManager.subscribe(subOptions);

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
        setStatusMessage('Push notifications successfully enabled!');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Failed to change push notification setting.');
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
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

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activePage="settings" />

      <main className={`flex-1 transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} pb-24 md:pb-8`}>
        <Header lastSynced={lastSynced} syncing={syncing} onSync={() => {}} />

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Preferences & Settings</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Customize reminders, quiet hours, and Canvas synchronization settings
            </p>
          </div>

          {statusMessage && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-primary-bg)] text-[var(--color-primary)] text-sm flex items-center justify-between">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage(null)} className="font-bold text-xs">✕</button>
            </div>
          )}

          <div className="space-y-6">
            {/* Browser Push Notifications Card */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text)]">Browser Push Notifications</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Receive desktop alerts for imminent deadlines and newly unlocked assignments
                  </p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={!pushSupported}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    pushSubscribed
                      ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                      : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                  } disabled:opacity-50`}
                >
                  {pushSubscribed ? 'Notifications Enabled ✓' : 'Enable Push Notifications'}
                </button>
              </div>
            </div>

            {/* Notification Intervals */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Deadline Reminder Intervals</h2>
              <div className="space-y-4">
                {[
                  {
                    key: 'before24h',
                    title: '24 Hours Before Deadline',
                    desc: 'Advance notice for assignments due the next day',
                  },
                  {
                    key: 'before6h',
                    title: '6 Hours Before Deadline',
                    desc: 'Medium urgency alert on the day of deadline',
                  },
                  {
                    key: 'before1h',
                    title: '1 Hour Before Deadline',
                    desc: 'High priority alert when deadline is imminent',
                  },
                  {
                    key: 'overdue',
                    title: 'Overdue Task Alert',
                    desc: 'Notify immediately when an unsubmitted task passes due date',
                  },
                  {
                    key: 'taskAvailable',
                    title: 'Task Now Available',
                    desc: 'Notify when a locked assignment unlock date arrives',
                  },
                  {
                    key: 'changedDeadlines',
                    title: 'Deadline Rescheduled',
                    desc: 'Notify if an instructor extends or alters a due date',
                  },
                ].map((item) => (
                  <label key={item.key} className="flex items-start justify-between cursor-pointer group">
                    <div className="pr-4">
                      <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                        {item.title}
                      </span>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs[item.key as keyof Preferences] as boolean}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Quiet Hours</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                Mute push notifications during study blocks or sleep hours
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={prefs.quietHoursStart || '22:00'}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={prefs.quietHoursEnd || '08:00'}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Canvas Security Notice */}
            <div className="p-5 rounded-2xl bg-[var(--color-primary-bg)]/50 border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] space-y-2">
              <div className="flex items-center space-x-2 text-[var(--color-text)] font-semibold">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Canvas API Token Security</span>
              </div>
              <p>
                Your ELTE Canvas Personal Access Token is stored strictly server-side in environment variables and is never transmitted or exposed to browser client sessions.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end space-x-4 pt-4">
              {saveSuccess && (
                <span className="text-xs font-semibold text-[var(--color-success)]">
                  Preferences saved successfully!
                </span>
              )}
              <button
                onClick={handleSavePreferences}
                disabled={saving || loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <MobileNav activePage="settings" />
    </div>
  );
}

// Utility helper for VAPID public key conversion
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
