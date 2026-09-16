'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpenIcon,
  CalendarDialIcon,
  GraduationCapIcon,
  QuizTabletIcon,
  ScoreMedalIcon,
} from '@/components/ui/icons';

interface MobileNavProps {
  activePage: string;
}

const mobileItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: BookOpenIcon },
  { id: 'courses', label: 'Courses', href: '/courses', icon: GraduationCapIcon },
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: CalendarDialIcon },
  { id: 'settings', label: 'Settings', href: '/settings', icon: QuizTabletIcon },
  { id: 'debug', label: 'Diagnostics', href: '/debug', icon: ScoreMedalIcon },
];

export function MobileNav({ activePage }: MobileNavProps) {
  return (
    <nav
      aria-label="Mobile menu"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)] border-t border-[var(--color-border)] md:hidden px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.07)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {mobileItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] min-h-[44px] rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 scale-105'
                    : 'bg-transparent text-current'
                }`}
              >
                <item.icon className="w-4.5 h-4.5" />
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight ${
                  isActive ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-medium opacity-90'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
