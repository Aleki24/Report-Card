"use client";

import React from 'react';
import EmptyState from '@/components/dashboard/EmptyState';
import type { Hue } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

export { SearchBox } from '@/components/ui/SearchBox';
export { LoadError } from '@/components/ui/LoadError';

/** The card that holds a section's search, filters and actions. */
export function Toolbar({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4', className)}>
      {children}
    </section>
  );
}

/** Nothing matches: says why, and offers to clear the filters when that would help. */
export function NoMatches({ icon, hue, title, description, onClear }: { icon: React.ReactNode; hue: Hue; title: string; description: string; onClear?: () => void }) {
  return (
    <EmptyState
      hue={hue}
      icon={icon}
      title={title}
      description={description}
      action={onClear && <button type="button" className="btn-secondary" onClick={onClear}>Clear filters</button>}
    />
  );
}

/** "12 of 181 students" above a filtered list. */
export function ResultCount({ shown, total, noun, refreshing }: { shown: number; total: number; noun: string; refreshing?: boolean }) {
  return (
    <p className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground" aria-live="polite">
      {shown === total ? `${total.toLocaleString()} ${noun}` : `${shown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}
      {refreshing && <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-label="Updating" />}
    </p>
  );
}
