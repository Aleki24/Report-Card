"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { opsFetch } from '@/lib/ops/client';
import type { OverviewTile, TileTone } from '@/lib/ops/overview';
import { cn } from '@/lib/utils';

const VALUE_TONE: Record<TileTone, string> = {
    default: 'text-foreground',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-destructive',
};

/**
 * Live figures from every module the school runs that the viewer may see.
 * Renders nothing when there are none, so it can sit on every dashboard.
 */
export function OperationsOverview({ className }: { className?: string }) {
    const [tiles, setTiles] = useState<OverviewTile[]>([]);
    useEffect(() => {
        let live = true;
        opsFetch<OverviewTile[]>('/api/ops/overview').then(t => { if (live) setTiles(t); }).catch(() => undefined);
        return () => { live = false; };
    }, []);
    if (tiles.length === 0) return null;
    return (
        <section aria-label="School operations" className={cn('mx-auto w-full max-w-7xl', className)}>
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Across the school</h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {tiles.map(t => (
                    <li key={t.key}>
                        <Link href={t.href} className="group flex h-full flex-col gap-1 rounded-2xl border border-border/70 bg-card p-3 no-underline shadow-sm transition-colors hover:border-primary/40 sm:p-4">
                            <span className="flex items-start justify-between gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                <span className="line-clamp-2">{t.label}</span>
                                <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                            </span>
                            <span className={cn('truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl', VALUE_TONE[t.tone])}>{t.value}</span>
                            {t.hint && <span className="truncate text-[11px] text-muted-foreground">{t.hint}</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
