'use client';

import { getGreeting } from '@/lib/dates';

interface GreetingProps {
  semesterLabel?: string;
}

export function Greeting({ semesterLabel }: GreetingProps) {
  const greeting = getGreeting();

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{greeting}</h1>
      <p className="text-[var(--color-text-secondary)] mt-1">
        {semesterLabel
          ? `Here's what needs your attention for ${semesterLabel}.`
          : "Here's what needs your attention."}
      </p>
    </div>
  );
}
