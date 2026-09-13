'use client';

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

const statCards = [
  {
    key: 'overdue' as const,
    label: 'Overdue',
    color: 'var(--color-danger)',
    bg: 'var(--color-danger-bg)',
    border: 'var(--color-danger-border)',
  },
  {
    key: 'dueSoon' as const,
    label: 'Due Soon',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
  },
  {
    key: 'availableNow' as const,
    label: 'Available Now',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-bg)',
    border: 'var(--color-primary-border)',
  },
  {
    key: 'submitted' as const,
    label: 'Completed',
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
  },
];

export function StatsRow({ stats, loading }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {statCards.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border p-4 transition-all hover:shadow-sm"
          style={{
            backgroundColor: card.bg,
            borderColor: card.border,
          }}
        >
          {loading ? (
            <>
              <div className="skeleton h-8 w-12 mb-2" />
              <div className="skeleton h-4 w-20" />
            </>
          ) : (
            <>
              <div
                className="text-2xl font-bold"
                style={{ color: card.color }}
              >
                {stats[card.key]}
              </div>
              <div
                className="text-sm font-medium mt-0.5"
                style={{ color: card.color }}
              >
                {card.label}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
