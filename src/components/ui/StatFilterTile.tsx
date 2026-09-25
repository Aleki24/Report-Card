"use client";

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, type Hue } from './tones';

interface StatFilterTileProps {
  icon: LucideIcon;
  hue: Hue;
  label: string;
  value: number;
  hint?: string;
  selected: boolean;
  loading?: boolean;
  onClick: () => void;
}

/**
 * A figure that is also a filter: tapping it narrows the list below to what
 * it counts. First used on the Users page.
 */
export function StatFilterTile({ icon: Icon, hue, label, value, hint, selected, loading = false, onClick }: StatFilterTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group flex min-w-0 items-start gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all sm:p-4',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/70 hover:border-primary/40',
      )}
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11', TONES[hue].tile)}>
        <Icon className="size-4 sm:size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
        {loading
          ? <span className="mt-1 block h-7 w-12 animate-pulse rounded-md bg-muted" />
          : <span className="block text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value.toLocaleString()}</span>}
        {hint && <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{hint}</span>}
      </span>
    </button>
  );
}
