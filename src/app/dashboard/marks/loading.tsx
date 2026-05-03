export default function MarksLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="animate-pulse h-8 w-36 rounded-lg bg-[var(--color-surface-raised)] mb-2" />
          <div className="animate-pulse h-4 w-64 rounded bg-[var(--color-surface-raised)]" />
        </div>
        <div className="animate-pulse h-10 w-32 rounded-lg bg-[var(--color-surface-raised)]" />
      </div>
      <div className="animate-pulse rounded-lg bg-[var(--color-surface-raised)] mb-6" style={{ height: 80 }} />
      <div className="flex gap-4 mb-6">
        <div className="animate-pulse h-10 w-48 rounded-lg bg-[var(--color-surface-raised)]" />
        <div className="animate-pulse h-10 flex-1 rounded-lg bg-[var(--color-surface-raised)]" />
      </div>
      <div className="animate-pulse rounded-xl bg-[var(--color-surface-raised)]" style={{ height: 400 }} />
    </div>
  );
}
