import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'good' | 'warn' | 'bad';

const VALUE_TONE: Record<StatTone, string> = {
  default: 'text-foreground',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-destructive',
};

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

/** A labelled figure: the KPI tile used across dashboards, profiles and reports. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4', className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('text-xl font-bold tracking-tight tabular-nums sm:text-2xl', VALUE_TONE[tone])}>{value}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
