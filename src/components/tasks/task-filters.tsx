'use client';

import React from 'react';

interface TaskFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  courseFilter: string;
  onCourseFilterChange: (courseId: string) => void;
  courses: { id: string; name: string }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const filterTabs = [
  { id: 'all', label: 'All Tasks' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'available', label: 'Available' },
  { id: 'submitted', label: 'Completed' },
  { id: 'upcoming', label: 'Upcoming' },
];

export function TaskFilters({
  activeFilter,
  onFilterChange,
  courseFilter,
  onCourseFilterChange,
  courses,
  searchQuery,
  onSearchChange,
}: TaskFiltersProps) {
  return (
    <div className="w-full min-w-0 max-w-full mb-6 space-y-3">
      {/* Search Input Bar */}
      <div className="relative w-full min-w-0">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by task title, course name, or topic…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 sm:h-10 pl-10 pr-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs sm:text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)] cursor-pointer"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter tabs & Course Selector */}
      <div className="w-full min-w-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Status filter tabs (wrapping responsively so no filter is clipped) */}
        <div className="w-full sm:w-auto min-w-0 max-w-full flex flex-wrap items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-1.5 shadow-2xs">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course Dropdown */}
        {courses.length > 0 && (
          <div className="w-full sm:w-auto min-w-0 shrink-0">
            <select
              value={courseFilter}
              onChange={(e) => onCourseFilterChange(e.target.value)}
              className="w-full sm:w-64 h-10 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs truncate"
            >
              <option value="all">All Courses ({courses.length})</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
