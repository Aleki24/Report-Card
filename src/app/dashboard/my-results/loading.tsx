export default function MyResultsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-36 rounded-lg bg-[var(--color-surface-raised)] mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-3 w-20 rounded bg-[var(--color-border)] mb-3" />
            <div className="h-7 w-14 rounded bg-[var(--color-border)]" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse" style={{ height: 300 }} />
    </div>
  );
}
