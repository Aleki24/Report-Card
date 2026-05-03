"use client";
import { useEffect } from 'react';
export default function ExamsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
      <p style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Failed to load exams.</p>
      <button className="btn-primary" onClick={reset}>Retry</button>
    </div>
  );
}
