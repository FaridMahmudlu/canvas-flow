'use client';

import React from 'react';
import {
  AlertTriangleIcon,
  ClockIcon,
  BookOpenIcon,
  CheckCircleIcon,
} from '@/components/ui/icons';

interface Stats {
  dueSoon: number;
  availableNow: number;
  overdue: number;
  submitted: number;
  upcoming: number;
  locked: number;
  total: number;
}

interface StatsRowProps {
  stats: Stats;
  loading: boolean;
}

export function StatsRow({ stats, loading }: StatsRowProps) {
  const completionRate =
    stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;

  const statCards = [
    {
      key: 'overdue' as const,
      label: 'Overdue',
      count: stats.overdue,
      subtitle: stats.overdue > 0 ? 'Needs attention' : 'Clean record',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/5 dark:bg-red-500/10',
      border: 'border-red-500/20',
      iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400',
      icon: AlertTriangleIcon,
    },
    {
      key: 'dueSoon' as const,
      label: 'Due Soon',
      count: stats.dueSoon,
      subtitle: stats.dueSoon > 0 ? 'Within 48 hours' : 'No urgent tasks',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/5 dark:bg-amber-500/10',
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      icon: ClockIcon,
    },
    {
      key: 'availableNow' as const,
      label: 'Available Now',
      count: stats.availableNow,
      subtitle: 'Ready to submit',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/5 dark:bg-blue-500/10',
      border: 'border-blue-500/20',
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      icon: BookOpenIcon,
    },
    {
      key: 'submitted' as const,
      label: 'Completed',
      count: stats.submitted,
      subtitle: `${completionRate}% of term done`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      icon: CheckCircleIcon,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
      {statCards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.key}
            className={`rounded-2xl border ${card.border} ${card.bg} p-4 sm:p-5 transition-all duration-200 hover:shadow-sm hover:scale-[1.01]`}
          >
            {loading ? (
              <div className="space-y-2">
                <div className="skeleton h-8 w-16 rounded-lg" />
                <div className="skeleton h-4 w-24 rounded-md" />
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${card.color}`}>
                    {card.count}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-[var(--color-text)] mt-0.5">
                    {card.label}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-tertiary)] font-medium mt-0.5 truncate">
                    {card.subtitle}
                  </div>
                </div>

                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                  <IconComponent className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
