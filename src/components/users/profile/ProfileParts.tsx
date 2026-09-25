"use client";

import React, { useEffect, useState } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileSectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  /** Rendered at the right of the heading, e.g. an edit button. */
  action?: React.ReactNode;
  className?: string;
}

export function ProfileSection({ title, icon: Icon, children, action, className }: ProfileSectionProps) {
  return (
    <section className={cn('rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

interface InfoItemProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Makes the value a tel:/mailto: link. */
  href?: string;
  /** Adds a copy button for the raw value. */
  copyValue?: string | null;
}

export function InfoItem({ icon: Icon, label, value, href, copyValue }: InfoItemProps) {
  const empty = value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          {empty
            ? <span className="text-muted-foreground/70">Not provided</span>
            : href
              ? <a href={href} className="truncate text-primary hover:underline">{value}</a>
              : <span className="min-w-0 break-words">{value}</span>}
          {!empty && copyValue && <CopyButton value={copyValue} label={label} />}
        </dd>
      </div>
    </div>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the value is still on screen to copy by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
}

export { StatTile } from '@/components/ui/StatTile';

/** Colour for a percentage score or attendance rate. */
export function scoreTone(percent: number): { bar: string; text: string } {
  if (percent >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  if (percent >= 50) return { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' };
  if (percent >= 40) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' };
}

export function ScoreBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', scoreTone(clamped).bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-muted/60" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}
