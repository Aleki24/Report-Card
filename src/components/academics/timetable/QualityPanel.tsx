import React from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { describeQuality } from '@/lib/timetable/config';

const TONE = {
    good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    fair: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    poor: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
} as const;

/** How well a draft spreads subjects, with what still breaks a preference. */
export function QualityPanel({ quality, action }: { quality: ReturnType<typeof describeQuality>; action?: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
            <div className={cn('flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border', TONE[quality.tone])}>
                <span className="text-xl font-bold tabular-nums">{quality.score}</span>
                <Gauge className="size-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{quality.verdict}</p>
                {quality.notes.length > 0
                    ? <p className="text-sm text-muted-foreground">{quality.notes.join(' · ')}</p>
                    : <p className="text-sm text-muted-foreground">Subjects are spread across the week with core lessons in the morning.</p>}
            </div>
            {action}
        </section>
    );
}
