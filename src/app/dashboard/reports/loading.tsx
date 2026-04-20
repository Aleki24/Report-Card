export default function ReportsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-36 rounded-lg bg-[var(--color-surface-raised)] mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[1,2].map(i => (
          <div key={i} className="animate-pulse h-10 rounded-lg bg-[var(--color-surface-raised)]" />
        ))}
      </div>
      <div className="card animate-pulse" style={{ height: 500 }} />
    </div>
  );
}
