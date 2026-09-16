'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const POPULAR_INSTITUTIONS = [
  { name: 'ELTE (Eötvös Loránd University)', url: 'https://canvas.elte.hu' },
  { name: 'Canvas LMS (Global / Other)', url: 'https://canvas.instructure.com' },
];

export default function ConnectCanvasPage() {
  const router = useRouter();

  const [instanceUrl, setInstanceUrl] = useState('https://canvas.elte.hu');
  const [accessToken, setAccessToken] = useState('');
  const [instanceName, setInstanceName] = useState('ELTE Canvas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/canvas/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceUrl,
          accessToken,
          instanceName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to connect Canvas account');
        setLoading(false);
        return;
      }

      setSuccess(data.connection);
      setLoading(false);

      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch {
      setError('A network error occurred while connecting to Canvas');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black p-4">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl z-10">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link href="/" className="inline-block mb-6 hover:opacity-95 transition">
            <Logo size="lg" badge="LINK" />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connect Canvas LMS
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Link your university Canvas account to start real-time synchronization
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-black/50">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Connected Successfully!</h2>
              <p className="text-slate-300 text-sm mb-4">
                Welcome, <span className="font-semibold text-white">{success.canvasUserName || 'Student'}</span>. Your courses and tasks are synchronizing in the background.
              </p>
              <div className="animate-pulse text-blue-400 text-xs font-medium">
                Redirecting to your command center...
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-6">
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2.5">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: Canvas URL */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  1. Select or Enter Canvas Instance URL
                </label>
                <div className="grid grid-cols-1 gap-2 mb-2">
                  {POPULAR_INSTITUTIONS.map((inst) => (
                    <button
                      key={inst.url}
                      type="button"
                      onClick={() => {
                        setInstanceUrl(inst.url);
                        setInstanceName(inst.name.split(' (')[0]);
                      }}
                      className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                        instanceUrl === inst.url
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{inst.name}</span>
                      {instanceUrl === inst.url && (
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  required
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder="https://canvas.your-university.edu"
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                />
              </div>

              {/* Step 2: Access Token */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    2. Personal Access Token
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    {showInstructions ? 'Hide instructions' : 'How to get this?'}
                  </button>
                </div>

                {showInstructions && (
                  <div className="mb-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-white">How to generate a Canvas Access Token:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Log in to your Canvas instance ({instanceUrl}).</li>
                      <li>Click on <strong>Account</strong> in the left sidebar, then <strong>Settings</strong>.</li>
                      <li>Scroll down to <strong>Approved Integrations</strong>.</li>
                      <li>Click the <strong>+ New Access Token</strong> button.</li>
                      <li>Enter a purpose (e.g. &quot;CanvasFlow&quot;) and click <strong>Generate Token</strong>.</li>
                      <li>Copy the generated token string and paste it below.</li>
                    </ol>
                  </div>
                )}

                <input
                  type="password"
                  required
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste your Canvas access token here"
                  className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Your token is encrypted using AES-256-GCM before storage and never exposed to the browser.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !accessToken || !instanceUrl}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying and Connecting...</span>
                  </>
                ) : (
                  <span>Connect Canvas Account</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-400 transition"
            >
              Skip for now and view dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
