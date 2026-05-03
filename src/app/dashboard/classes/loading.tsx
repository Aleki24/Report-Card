export default function ClassesLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-32 rounded-lg bg-[var(--color-surface-raised)] mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-4)' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="card animate-pulse" style={{ height: 120 }} />
        ))}
      </div>
    </div>
  );
}
