'use client';

import { getGreeting } from '@/lib/dates';

export function Greeting() {
  const greeting = getGreeting();

  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{greeting}</h1>
      <p className="text-[var(--color-text-secondary)] mt-1">
        Here&apos;s what needs your attention.
      </p>
    </div>
  );
}
