'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export function Logo({
  size = 'md',
  collapsed = false,
  showSubtitle = true,
  className = '',
}: LogoProps) {
  const dimensions = {
    sm: { box: 'w-8 h-8', svg: 'w-5 h-5', text: 'text-base', sub: 'text-[9px]' },
    md: { box: 'w-10 h-10', svg: 'w-6 h-6', text: 'text-lg', sub: 'text-[10px]' },
    lg: { box: 'w-12 h-12', svg: 'w-7 h-7', text: 'text-xl', sub: 'text-[11px]' },
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Bespoke Academic Crest Emblem */}
      <div
        className={`relative ${dimensions.box} rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-[1px] shadow-lg shadow-indigo-500/20 group flex-shrink-0`}
      >
        <div className="w-full h-full rounded-[11px] bg-[var(--color-surface)]/90 backdrop-blur-sm flex items-center justify-center overflow-hidden relative">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-indigo-500/20 to-amber-400/10" />

          {/* Academic Crest SVG */}
          <svg
            className={`${dimensions.svg} text-indigo-500 relative z-10 transition-transform duration-300 group-hover:scale-110`}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Knowledge Portal / Shield Outer Contour */}
            <path
              d="M16 2.5L27 7V16C27 22.8 22.3 28.5 16 29.8C9.7 28.5 5 22.8 5 16V7L16 2.5Z"
              stroke="url(#crest-gradient)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Graduate Cap / Wisdom Peak */}
            <path
              d="M16 8L23.5 12L16 16L8.5 12L16 8Z"
              fill="url(#crest-fill)"
              stroke="url(#crest-gradient)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Cap Tassel Ribbon */}
            <path
              d="M20.5 13.5V17.5C20.5 18 20.8 18.5 21.3 18.5"
              stroke="#F59E0B"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* Kinetic Academic Flow Wings / Open Book Pages */}
            <path
              d="M11 18.5C13 17.5 15 18 16 19C17 18 19 17.5 21 18.5V23C19 22 17 22.5 16 23.5C15 22.5 13 22 11 23V18.5Z"
              fill="url(#crest-fill-subtle)"
              stroke="url(#crest-gradient)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Center Golden Star Accent */}
            <circle cx="16" cy="19.2" r="1" fill="#F59E0B" />

            <defs>
              <linearGradient id="crest-gradient" x1="5" y1="2.5" x2="27" y2="29.8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="0.5" stopColor="#6366F1" />
                <stop offset="1" stopColor="#A855F7" />
              </linearGradient>
              <linearGradient id="crest-fill" x1="8.5" y1="8" x2="23.5" y2="16" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" stopOpacity="0.4" />
                <stop offset="1" stopColor="#6366F1" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="crest-fill-subtle" x1="11" y1="17.5" x2="21" y2="23.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" stopOpacity="0.2" />
                <stop offset="1" stopColor="#6366F1" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Brand Wordmark & Tagline */}
      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-bold tracking-tight text-[var(--color-text)] ${dimensions.text} font-sans`}
            >
              Canvas<span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Flow</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              ELTE
            </span>
          </div>
          {showSubtitle && (
            <span className={`${dimensions.sub} font-medium text-[var(--color-text-tertiary)] uppercase tracking-widest`}>
              Academic Command
            </span>
          )}
        </div>
      )}
    </div>
  );
}
