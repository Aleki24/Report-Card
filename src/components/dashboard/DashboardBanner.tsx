import React from 'react';
import DashboardCard from './DashboardCard';

type DashboardBannerProps = {
  greeting: string;
  summary: string;
  meta?: string;
};

export default function DashboardBanner({ greeting, summary, meta }: DashboardBannerProps) {
  return (
    <DashboardCard className="relative overflow-hidden rounded-3xl border-primary/15 bg-gradient-to-br from-primary/12 via-card/95 to-amber-500/10 p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full border border-amber-400/40 bg-amber-300/10" />
      <div className="pointer-events-none absolute bottom-4 right-6 text-4xl opacity-20">✏️</div>
      <div className="relative max-w-2xl space-y-2 pl-2">
        {meta && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{meta}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{greeting}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{summary}</p>
      </div>
    </DashboardCard>
  );
}
