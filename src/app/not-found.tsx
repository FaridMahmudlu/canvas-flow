import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 bg-[var(--color-surface)] p-8 rounded-3xl border border-[var(--color-border)] shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-black">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            The requested course, task, or page does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-500/20"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
