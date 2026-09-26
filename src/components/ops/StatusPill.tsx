import React from 'react';
import { cn } from '@/lib/utils';
import { humanize } from '@/lib/ops/format';

export type PillTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'violet';

const TONE_CLASS: Record<PillTone, string> = {
    neutral: 'bg-muted text-muted-foreground',
    info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    good: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    bad: 'bg-destructive/12 text-destructive',
    violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
};

/**
 * A status label coloured by what it means. Pages map their own statuses to
 * tones once (`tones`), so every list reads the same colour for "waiting",
 * "done" and "problem".
 */
export function StatusPill<S extends string>({ status, tones, label }: { status: S; tones: Readonly<Record<S, PillTone>>; label?: string }) {
    return (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONE_CLASS[tones[status] ?? 'neutral'])}>
            {label ?? humanize(status)}
        </span>
    );
}
