'use client';

import { useState } from 'react';
import { TaskCard } from '@/components/tasks/task-card';
import {
  FlameIcon,
  ClockIcon,
  BookOpenIcon,
  CheckCircleIcon,
  GraduationCapIcon,
} from '@/components/ui/icons';
import type { TaskData } from '@/app/page';

interface TaskSectionProps {
  title: string;
  subtitle?: string;
  tasks: TaskData[];
  onTaskClick: (task: TaskData) => void;
  variant?: 'default' | 'urgent';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function TaskSection({
  title,
  subtitle,
  tasks,
  onTaskClick,
  variant = 'default',
  collapsible = false,
  defaultCollapsed = false,
}: TaskSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const getSectionIcon = () => {
    if (variant === 'urgent' || title.toLowerCase().includes('focus')) {
      return <FlameIcon className="w-4 h-4 text-red-500" />;
    }
    if (title.toLowerCase().includes('due soon')) {
      return <ClockIcon className="w-4 h-4 text-amber-500" />;
    }
    if (title.toLowerCase().includes('completed')) {
      return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (title.toLowerCase().includes('available')) {
      return <BookOpenIcon className="w-4 h-4 text-blue-500" />;
    }
    return <GraduationCapIcon className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
            {getSectionIcon()}
          </div>
          <div>
            <h2
              className={`text-base sm:text-lg font-bold flex items-center gap-2 ${
                variant === 'urgent'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[var(--color-text)]'
              }`}
            >
              <span>{title}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                {tasks.length}
              </span>
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      )}
    </section>
  );
}
