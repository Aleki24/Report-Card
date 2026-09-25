export default function UsersLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl" aria-busy="true" aria-label="Loading users">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted sm:h-24" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    </div>
  );
}
