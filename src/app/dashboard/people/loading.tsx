export default function PeopleLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="animate-pulse h-8 w-40 rounded-lg bg-muted mb-3" />
      <div className="animate-pulse h-4 w-64 rounded bg-muted mb-8" />
      <div className="card animate-pulse p-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 rounded-lg bg-muted mb-3" />
        ))}
      </div>
    </div>
  );
}
