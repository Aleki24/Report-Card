export default function DashboardLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="animate-pulse h-8 w-48 rounded-lg bg-[var(--color-surface-raised)] mb-3" />
        <div className="animate-pulse h-4 w-72 rounded bg-[var(--color-surface-raised)]" />
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-3 w-24 rounded bg-[var(--color-border)] mb-3" />
            <div className="h-8 w-16 rounded bg-[var(--color-border)] mb-2" />
            <div className="h-3 w-20 rounded bg-[var(--color-border)]" />
          </div>
        ))}
      </div>
      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        {[1, 2].map((i) => (
          <div key={i} className="card animate-pulse" style={{ height: 220 }} />
        ))}
      </div>
    </div>
  );
}
