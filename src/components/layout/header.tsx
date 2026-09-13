'use client';

import { formatSyncAge } from '@/lib/dates';

interface HeaderProps {
  lastSynced: string | null;
  syncing: boolean;
  onSync: () => void;
}

export function Header({ lastSynced, syncing, onSync }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left — page context (visible on mobile) */}
        <div className="lg:hidden">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">CanvasFlow</h1>
        </div>
        <div className="hidden lg:block" />

        {/* Right — sync & user */}
        <div className="flex items-center gap-4">
          {/* Sync status */}
          <div className="flex items-center gap-2 text-sm">
            {lastSynced && (
              <span className="text-[var(--color-text-tertiary)] hidden sm:inline">
                Last synced {formatSyncAge(lastSynced)}
              </span>
            )}
            <button
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>

          {/* User avatar placeholder */}
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] border border-[var(--color-primary-border)] flex items-center justify-center">
            <span className="text-xs font-medium text-[var(--color-primary)]">U</span>
          </div>
        </div>
      </div>
    </header>
  );
}
