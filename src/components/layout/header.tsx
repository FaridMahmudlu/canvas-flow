'use client';

import Link from 'next/link';
import { formatSyncAge } from '@/lib/dates';
import { Logo } from '@/components/brand/logo';
import { SyncOrbitIcon } from '@/components/ui/icons';

interface HeaderProps {
  lastSynced: string | null;
  syncing: boolean;
  onSync: () => void;
}

export function Header({ lastSynced, syncing, onSync }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--color-surface)]/85 backdrop-blur-md border-b border-[var(--color-border)] shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left — Brand context on mobile */}
        <div className="flex items-center md:hidden">
          <Link href="/">
            <Logo size="sm" showSubtitle={false} />
          </Link>
        </div>
        <div className="hidden md:block" />

        {/* Right — Sync controls & status */}
        <div className="flex items-center gap-3">
          {/* Sync age with active indicator */}
          {lastSynced && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
              <span>Synced {formatSyncAge(lastSynced)}</span>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={syncing}
            aria-label="Synchronize Canvas tasks"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-indigo-500/20 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            <SyncOrbitIcon
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
            />
            <span>{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>

          {/* ELTE Student Badge */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-500 select-none shadow-xs">
            🎓
          </div>
        </div>
      </div>
    </header>
  );
}
