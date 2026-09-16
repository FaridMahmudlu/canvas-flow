'use client';

import React from 'react';
import type { SemesterOption } from '@/lib/semester';
import { GraduationCapIcon } from '@/components/ui/icons';

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
    <div className="w-full min-w-0 max-w-full mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3.5 sm:p-4 shadow-xs">
      {/* Title & Info */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0 shadow-2xs">
          <GraduationCapIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
            Academic Term
          </h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1 sm:line-clamp-none">
            Filter all statistics, deadlines, and course tasks by semester
          </p>
        </div>
      </div>

      {/* Semester pill buttons — horizontally scrollable strictly inside container on small screens */}
      <div className="w-full md:w-auto min-w-0 max-w-full relative">
        <div className="w-full min-w-0 max-w-full flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none touch-pan-x">
          {semesters.map((sem) => {
            const isSelected = selectedSemester === sem.id;
            return (
              <button
                key={sem.id}
                onClick={() => onSelectSemester(sem.id)}
                disabled={isLoading}
                title={sem.label}
                className={`shrink-0 group relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 disabled:opacity-60 active:scale-98 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                    : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                <span className="truncate max-w-[140px] sm:max-w-none">{sem.label}</span>
                {sem.isCurrent && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                    }`}
                  >
                    Current
                  </span>
                )}
                {typeof sem.courseCount === 'number' && (
                  <span
                    className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md ${
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
    </div>
  );
}
