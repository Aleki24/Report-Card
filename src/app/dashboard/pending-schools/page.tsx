"use client";

import React from 'react';
import { AlertTriangle, CheckCircle2, Hourglass, Mail, MapPin, Phone, RotateCcw, User, XCircle } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { usePendingSchools } from '@/hooks/usePendingSchools';
import type { PendingSchool } from '@/lib/pending-schools';

const when = (iso: string | null) => {
  if (!iso) return 'Unknown time';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const date = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return days >= 1 ? `${date} · waiting ${days} day${days === 1 ? '' : 's'}` : date;
};

function Detail({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </li>
  );
}

function SchoolCard({ school }: { school: PendingSchool }) {
  const r = school.requester;
  return (
    <li className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400" aria-hidden><Hourglass className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">{school.name}</h2>
          <p className="text-xs text-muted-foreground">Requested {when(school.requestedAt)}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
        {r && <Detail icon={User}>{r.name}{r.email ? ` · ${r.email}` : ''}</Detail>}
        {(school.phone || r?.phone) && <Detail icon={Phone}><a className="hover:underline" href={`tel:${school.phone || r?.phone}`}>{school.phone || r?.phone}</a></Detail>}
        {school.email && <Detail icon={Mail}><a className="hover:underline" href={`mailto:${school.email}`}>{school.email}</a></Detail>}
        {school.address && <Detail icon={MapPin}>{school.address}</Detail>}
      </ul>
      {/* The decision links open a confirmation page; nothing happens until it is confirmed there. */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <a href={school.rejectUrl} className="btn-secondary text-destructive"><XCircle className="size-4" aria-hidden />Reject</a>
        <a href={school.approveUrl} className="btn-primary"><CheckCircle2 className="size-4" aria-hidden />Approve</a>
      </div>
    </li>
  );
}

/** The platform owner's queue of schools waiting for approval. */
export default function PendingSchoolsPage() {
  const { state, reload } = usePendingSchools();

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title="Schools awaiting approval"
        eyebrow="Platform"
        icon={Hourglass}
        hue="amber"
        description="New schools stay locked until you approve them. You're also told by email, SMS and WhatsApp when one asks."
        action={state.status === 'ready' && <button type="button" className="btn-secondary" onClick={() => void reload()}><RotateCcw className="size-4" aria-hidden />Refresh</button>}
      />

      {state.status === 'loading' && <ContentSkeleton message="Loading requests..." />}
      {state.status === 'forbidden' && (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState hue="slate" icon={<AlertTriangle className="size-6" />} title="Not available" description="Only the Skulbase platform owner can review school requests." />
        </div>
      )}
      {state.status === 'error' && (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState hue="rose" icon={<AlertTriangle className="size-6" />} title="Couldn't load requests" description={state.message}
            action={<button type="button" className="btn-primary" onClick={() => void reload()}><RotateCcw className="size-4" aria-hidden />Try again</button>} />
        </div>
      )}
      {state.status === 'ready' && (state.schools.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState hue="emerald" icon={<CheckCircle2 className="size-6" />} title="Nothing waiting" description="Every school request has been decided. New ones appear here the moment they're made." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.schools.map(s => <SchoolCard key={s.id} school={s} />)}
        </ul>
      ))}
    </div>
  );
}
