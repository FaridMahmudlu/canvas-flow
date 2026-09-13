'use client';

import React from 'react';
import type { SemesterOption } from '@/lib/semester';

interface SemesterSelectorProps {
  semesters: SemesterOption[];
  selectedSemester: string;
  onSelectSemester: (semesterId: string) => void;
  isLoading?: boolean;
}

export function SemesterSelector({
  semesters,
  selectedSemester,
  onSelectSemester,
  isLoading = false,
}: SemesterSelectorProps) {
  if (!semesters || semesters.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-bg)] border border-[var(--color-primary-border)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Academic Term
          </h3>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Filter all statistics, deadlines, and course tasks by semester
          </p>
        </div>
      </div>

      {/* Semester pill buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {semesters.map((sem) => {
          const isSelected = selectedSemester === sem.id;
          return (
            <button
              key={sem.id}
              onClick={() => onSelectSemester(sem.id)}
              disabled={isLoading}
              className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-60 ${
                isSelected
                  ? 'bg-[var(--color-primary)] text-white shadow-sm ring-1 ring-[var(--color-primary)]'
                  : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <span>{sem.label}</span>
              {sem.isCurrent && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] border border-[var(--color-primary-border)]'
                  }`}
                >
                  Current
                </span>
              )}
              {typeof sem.courseCount === 'number' && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-md ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
                  }`}
                >
                  {sem.courseCount} {sem.courseCount === 1 ? 'course' : 'courses'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
