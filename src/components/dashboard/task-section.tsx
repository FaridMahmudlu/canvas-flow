'use client';

import { useState } from 'react';
import { TaskCard } from '@/components/tasks/task-card';
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

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2
            className={`text-base font-semibold ${
              variant === 'urgent'
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-text)]'
            }`}
          >
            {title}
            <span className="ml-2 text-sm font-normal text-[var(--color-text-tertiary)]">
              {tasks.length}
            </span>
          </h2>
          {subtitle && (
            <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      )}
    </section>
  );
}
