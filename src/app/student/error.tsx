"use client";
import { useEffect } from 'react';

export default function StudentPortalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
      <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Failed to load this page.</p>
      <p className="text-muted-foreground text-sm" style={{ marginBottom: 'var(--space-4)' }}>Something went wrong. Your data is safe — try again.</p>
      <button className="btn-primary" onClick={reset}>Retry</button>
    </div>
  );
}
