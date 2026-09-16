'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
  showSubtitle?: boolean;
  badge?: string | null;
  className?: string;
}

export function Logo({
  size = 'md',
  collapsed = false,
  showSubtitle = true,
  badge = 'PRO',
  className = '',
}: LogoProps) {
  const dimensions = {
    sm: { box: 'w-8 h-8', svg: 'w-5 h-5', text: 'text-base', sub: 'text-[8.5px]' },
    md: { box: 'w-10 h-10', svg: 'w-6 h-6', text: 'text-lg', sub: 'text-[10px]' },
    lg: { box: 'w-12 h-12', svg: 'w-7 h-7', text: 'text-xl', sub: 'text-[11px]' },
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Exclusive Geometric Academic Flow Emblem */}
      <div
        className={`relative ${dimensions.box} rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-violet-600 p-[1px] shadow-lg shadow-indigo-500/25 group flex-shrink-0`}
      >
        <div className="w-full h-full rounded-[15px] bg-[var(--color-surface)]/95 backdrop-blur-md flex items-center justify-center overflow-hidden relative">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-indigo-500/15 to-violet-500/10" />

          {/* Precision Vector Emblem */}
          <svg
            className={`${dimensions.svg} relative z-10 transition-transform duration-300 group-hover:scale-105`}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Knowledge Portal & Kinetic Shield */}
            <path
              d="M16 3L27 7.5V16C27 22.8 22.3 28.5 16 29.8C9.7 28.5 5 22.8 5 16V7.5L16 3Z"
              stroke="url(#cf-brand-grad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Wisdom Diamond Apex */}
            <path
              d="M16 8.5L23.5 12.5L16 16.5L8.5 12.5L16 8.5Z"
              fill="url(#cf-fill-primary)"
              stroke="url(#cf-brand-grad)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Academic Flow Horizon Waves */}
            <path
              d="M10.5 18.5C12.5 17.5 14.5 18 16 19C17.5 18 19.5 17.5 21.5 18.5V22.5C19.5 21.5 17.5 22 16 23C14.5 22 12.5 21.5 10.5 22.5V18.5Z"
              fill="url(#cf-fill-secondary)"
              stroke="url(#cf-brand-grad)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Intellect Spark Beacon */}
            <circle cx="16" cy="25.5" r="1.2" fill="#F59E0B" />

            <defs>
              <linearGradient id="cf-brand-grad" x1="5" y1="3" x2="27" y2="29.8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" />
                <stop offset="0.5" stopColor="#6366F1" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
              <linearGradient id="cf-fill-primary" x1="8.5" y1="8.5" x2="23.5" y2="16.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0EA5E9" stopOpacity="0.45" />
                <stop offset="1" stopColor="#6366F1" stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id="cf-fill-secondary" x1="10.5" y1="17.5" x2="21.5" y2="23" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38BDF8" stopOpacity="0.25" />
                <stop offset="1" stopColor="#818CF8" stopOpacity="0.4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Brand Wordmark & Dynamic Tagline */}
      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-extrabold tracking-tight text-[var(--color-text)] ${dimensions.text} font-sans`}
            >
              Canvas<span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">Flow</span>
            </span>
            {badge && (
              <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                {badge}
              </span>
            )}
          </div>
          {showSubtitle && (
            <span className={`${dimensions.sub} font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest`}>
              Academic Command
            </span>
          )}
        </div>
      )}
    </div>
  );
}
