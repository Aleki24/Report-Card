export default function SettingsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-28 rounded-lg bg-[var(--color-surface-raised)] mb-6" />
      <div className="flex gap-3 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="animate-pulse h-10 w-28 rounded-lg bg-[var(--color-surface-raised)]" />
        ))}
      </div>
      <div className="card animate-pulse" style={{ height: 400 }} />
    </div>
  );
}
