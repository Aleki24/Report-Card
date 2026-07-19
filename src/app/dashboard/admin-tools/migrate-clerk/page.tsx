"use client";

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

// Temporary, one-time tool: migrates already-activated accounts from Clerk
// Development (where this app has been running) to Clerk Production, now
// that a custom domain exists. Safe to delete once the migration is done —
// re-running it after everyone has moved is a harmless no-op (every user
// is skipped as "already-migrated").
export default function MigrateClerkPage() {
  const { role } = useAuth();
  const [targetUserId, setTargetUserId] = useState('');
  const [sendNotifications, setSendNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');

  const run = async (dryRun: boolean) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/migrate-clerk-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          sendNotifications,
          targetUserId: targetUserId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Request failed');
      else setResult(data);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'ADMIN') {
    return <div className="p-6 text-sm text-muted-foreground">Admins only.</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-10">
      <h1 className="text-xl font-bold mb-2">Migrate to Clerk Production</h1>
      <p className="text-sm text-muted-foreground mb-6">
        One-time tool. Leave &quot;Target user ID&quot; blank to run against everyone, or fill it in to test on a single account first (recommended before running it for real).
      </p>

      <div className="card p-5 mb-6 flex flex-col gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Target user ID (optional — test on one account first)</label>
          <input className="input-field w-full" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="Leave blank for everyone" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendNotifications} onChange={e => setSendNotifications(e.target.checked)} />
          Send SMS/email invite codes (leave off to just generate codes without notifying anyone yet)
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" disabled={loading} onClick={() => run(true)}>{loading ? 'Running...' : 'Dry Run (no changes)'}</button>
          <button className="btn-primary" disabled={loading} onClick={() => run(false)}>{loading ? 'Running...' : 'Migrate for Real'}</button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{error}</div>}
      {result !== null && (
        <pre className="card p-4 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
