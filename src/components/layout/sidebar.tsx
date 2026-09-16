'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import {
  BookOpenIcon,
  CalendarDialIcon,
  GraduationCapIcon,
  QuizTabletIcon,
  ScoreMedalIcon,
  GitHubIcon,
  ExternalLinkIcon,
} from '@/components/ui/icons';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  activePage: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: BookOpenIcon },
  { id: 'courses', label: 'Courses', href: '/courses', icon: GraduationCapIcon },
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: CalendarDialIcon },
  { id: 'settings', label: 'Settings', href: '/settings', icon: QuizTabletIcon },
  { id: 'debug', label: 'Diagnostics', href: '/debug', icon: ScoreMedalIcon },
];

export function Sidebar({ open, onToggle, activePage }: SidebarProps) {
  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] z-40 transition-all duration-300 flex flex-col ${
          open ? 'w-64' : 'w-20'
        } hidden md:flex`}
      >
        {/* Brand Logo */}
        <div className="flex items-center h-20 px-4 border-b border-[var(--color-border)]">
          <Link href="/" className="flex items-center">
            <Logo collapsed={!open} size={open ? 'md' : 'sm'} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {open && <span className="ml-3 truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Developer & GitHub Repository Link */}
        <div className="px-3 py-2 border-t border-[var(--color-border)]">
          <a
            href="https://github.com/FaridMahmudlu/canvas-flow"
            target="_blank"
            rel="noopener noreferrer"
            title="Developer: Farid Mahmudlu • CanvasFlow GitHub Repository"
            aria-label="View CanvasFlow repository on GitHub by developer Farid Mahmudlu"
            className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-transparent hover:border-[var(--color-border)] transition-all group ${
              open ? 'justify-between' : 'justify-center'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <GitHubIcon className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-indigo-400 transition-colors flex-shrink-0" />
              {open && (
                <div className="min-w-0 flex flex-col text-left">
                  <span className="font-semibold truncate text-[var(--color-text)] leading-tight">
                    GitHub Project
                  </span>
                  <span className="text-[10px] text-indigo-400 truncate">
                    dev: Farid Mahmudlu
                  </span>
                </div>
              )}
            </div>
            {open && (
              <ExternalLinkIcon className="w-3 h-3 text-[var(--color-text-tertiary)] group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            )}
          </a>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-12 border-t border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${open ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>
    </>
  );
}

