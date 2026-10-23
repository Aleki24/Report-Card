"use client";

import React, { useState } from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import type { TermLock } from '@/lib/exam-windows';

interface TermLockCardProps {
  termId: string;
  termName: string;
  lock: TermLock | null;
  onChange: (lock: TermLock | null) => void;
}

const lockedOn = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Lock a finished term's marks so nobody changes one by mistake once report
 * cards are out; unlock it for a correction. For whoever opens exams.
 */
export function TermLockCard({ termId, termName, lock, onChange }: TermLockCardProps) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    const locking = !lock;
    const ok = await confirm(locking
      ? { title: `Lock ${termName} marks?`, message: 'Nobody can enter, change or remove a mark in this term until it is unlocked. Releasing results still works.', confirmText: 'Lock term', variant: 'warning' }
      : { title: `Unlock ${termName} marks?`, message: 'Teachers can change this term’s marks again. Lock it once the correction is done.', confirmText: 'Unlock' });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/school/exam-windows/lock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termId, locked: locking }) });
      const json = (await res.json().catch(() => null)) as { lock?: TermLock | null; error?: string } | null;
      if (!res.ok) throw new Error(json?.error || 'Could not save.');
      onChange(json?.lock ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={`${termName} marks lock`}
      className={cn('flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:p-5', lock ? 'border-slate-500/30 bg-slate-500/[0.06]' : 'border-border/70 bg-card')}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', lock ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300' : 'bg-muted text-muted-foreground')} aria-hidden>
        {lock ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-bold tracking-tight text-foreground">
          {lock ? `${termName} marks are locked` : `Lock ${termName} marks when it’s finished`}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {lock
            ? `Locked${lock.lockedBy ? ` by ${lock.lockedBy}` : ''} on ${lockedOn(lock.lockedAt)}. Unlock it to correct a mark.`
            : 'Once report cards are out, lock the term so nobody changes a mark by mistake.'}
        </p>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={cn('inline-flex shrink-0 items-center justify-center gap-2 self-stretch sm:self-auto', lock ? 'btn-secondary' : 'btn-primary')}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : lock ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        {lock ? 'Unlock term' : 'Lock term'}
      </button>
    </section>
  );
}
