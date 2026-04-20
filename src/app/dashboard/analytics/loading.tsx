export default function AnalyticsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-40 rounded-lg bg-[var(--color-surface-raised)] mb-3" />
      <div className="animate-pulse h-4 w-64 rounded bg-[var(--color-surface-raised)] mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-3 w-24 rounded bg-[var(--color-border)] mb-3" />
            <div className="h-8 w-16 rounded bg-[var(--color-border)]" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse" style={{ height: 320 }} />
    </div>
  );
}
