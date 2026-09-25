import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, type Hue } from './tones';

export type StatTone = 'default' | 'good' | 'warn' | 'bad';

const VALUE_TONE: Record<StatTone, string> = {
  default: 'text-foreground',
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-destructive',
};

/** Icon colour when none is given: the figure's own tone, else neutral blue. */
const TONE_HUE: Record<StatTone, Hue> = { default: 'blue', good: 'emerald', warn: 'amber', bad: 'rose' };

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  /** Colour of the icon chip; defaults to the tone's colour. */
  hue?: Hue;
  className?: string;
}

/** A labelled figure: the KPI tile used across dashboards, profiles and reports. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'default', hue, className }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4', className)}>
      <span className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-lg', TONES[hue ?? TONE_HUE[tone]].tile)} aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('mt-0.5 text-xl font-bold tracking-tight tabular-nums sm:text-2xl', VALUE_TONE[tone])}>{value}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
