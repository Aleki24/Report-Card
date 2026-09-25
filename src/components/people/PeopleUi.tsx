"use client";

import React from 'react';
import { AlertTriangle, RotateCcw, Search, X } from 'lucide-react';
import EmptyState from '@/components/dashboard/EmptyState';
import type { Hue } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

/** Search box used by every section's toolbar. */
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        className="input-field input-icon-left input-icon-right"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** The card that holds a section's search, filters and actions. */
export function Toolbar({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4', className)}>
      {children}
    </section>
  );
}

/** A section that could not load, with a way to try again. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card">
      <EmptyState
        hue="rose"
        icon={<AlertTriangle className="size-6" />}
        title={title}
        description={message}
        action={<button type="button" className="btn-primary" onClick={onRetry}><RotateCcw className="size-4" aria-hidden="true" />Try again</button>}
      />
    </div>
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
