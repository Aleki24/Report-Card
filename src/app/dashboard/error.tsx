"use client";

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
      <div className="card text-center" style={{ maxWidth: 420, padding: 'var(--space-8)' }}>
        <div style={{ fontSize: 40, marginBottom: 'var(--space-4)' }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-2)' }}>Something went wrong</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button className="btn-primary" onClick={reset}>Try Again</button>
      </div>
    </div>
  );
}
