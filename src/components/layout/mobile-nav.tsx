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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-lg border-t border-[var(--color-border)] md:hidden px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-around">
        {mobileItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold scale-105'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-500/10' : 'bg-transparent'
                }`}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
