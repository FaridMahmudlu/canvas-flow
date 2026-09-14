'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { formatSyncAge } from '@/lib/dates';
import { Logo } from '@/components/brand/logo';
import { SyncOrbitIcon } from '@/components/ui/icons';

interface HeaderProps {
  lastSynced: string | null;
  syncing: boolean;
  onSync: () => void;
}

export function Header({ lastSynced, syncing, onSync }: HeaderProps) {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = session?.user?.name || 'Student';
  const userInitial = userName.charAt(0).toUpperCase();

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

        {/* Right — Sync controls & User Account */}
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
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-indigo-500/20 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
          >
            <SyncOrbitIcon
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
            />
            <span>{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>

          {/* User Profile & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-sm hover:ring-2 hover:ring-blue-500/30 transition cursor-pointer select-none"
              aria-label="User menu"
            >
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={userName}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                userInitial
              )}
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/60 p-2 z-50 text-xs">
                <div className="px-3 py-2.5 border-b border-slate-800/80 mb-1">
                  <p className="font-semibold text-white truncate">{userName}</p>
                  <p className="text-slate-400 text-[11px] truncate">{session?.user?.email || 'Student Account'}</p>
                </div>

                <Link
                  href="/connect"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Connect Canvas LMS</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Notification Settings</span>
                </Link>

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition cursor-pointer text-left"
                >
                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
