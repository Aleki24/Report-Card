"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Hourglass } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { usePendingSchools } from '@/hooks/usePendingSchools';

/**
 * For the platform owner: a reminder on every page while schools are waiting
 * for approval, so a request is never missed when a message doesn't arrive.
 * Everyone else gets a 403 from the list and sees nothing.
 */
export function OwnerPendingNotice() {
  const { role, preview } = useAuth();
  const pathname = usePathname();
  const onList = pathname === '/dashboard/pending-schools';
  const { state } = usePendingSchools(role === 'ADMIN' && !preview && !onList);

  if (onList || state.status !== 'ready' || state.schools.length === 0) return null;
  const n = state.schools.length;

  return (
    <Link
      href="/dashboard/pending-schools"
      className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 shadow-sm transition-colors hover:border-amber-500/60 sm:p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400" aria-hidden>
        <Hourglass className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <strong className="font-semibold">{n} school{n === 1 ? ' is' : 's are'} waiting for your approval</strong>
        <span className="block truncate text-muted-foreground">{state.schools.map(s => s.name).join(', ')}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">Review<ArrowRight className="size-4" aria-hidden /></span>
    </Link>
  );
}
