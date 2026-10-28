"use client";

import React, { useEffect, useState } from 'react';
import { CalendarRange, Coins, Receipt } from 'lucide-react';
import { LoadError, StatTile } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { formatKsh } from '@/lib/fee-account';
import type { CollectionBucket, CollectionsResponse } from '@/lib/fee-reports';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; body: CollectionsResponse };

/** Today in Nairobi, YYYY-MM-DD. */
const nairobiToday = () => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const PRESETS: readonly { id: string; label: string; range: () => [string, string] }[] = [
    { id: 'today', label: 'Today', range: () => [nairobiToday(), nairobiToday()] },
    { id: 'week', label: 'Last 7 days', range: () => [addDays(nairobiToday(), -6), nairobiToday()] },
    { id: 'month', label: 'This month', range: () => [`${nairobiToday().slice(0, 8)}01`, nairobiToday()] },
    { id: 'days30', label: 'Last 30 days', range: () => [addDays(nairobiToday(), -29), nairobiToday()] },
];

const dayLabel = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Labelled horizontal bars, one hue: each bar is its share of the largest. */
function Bars({ title, rows, label = b => b.label }: { title: string; rows: CollectionBucket[]; label?: (b: CollectionBucket) => string }) {
    const max = Math.max(1, ...rows.map(r => r.amount));
    return (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">{title}</h3>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing received.</p> : (
                <ul className="flex flex-col gap-2.5">
                    {rows.map(r => (
                        <li key={r.key}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate">{label(r)}</span>
                                <span className="shrink-0 font-semibold tabular-nums">{formatKsh(r.amount)} <span className="font-normal text-muted-foreground">· {r.count}</span></span>
                            </div>
                            <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * What came in over a period: the total and number of payments, split by
 * method (M-Pesa, cash, bank…), by class and by day, for the bursar's
 * daily banking and the head's weekly report.
 */
export function CollectionsPanel() {
    const [range, setRange] = useState<[string, string]>(() => PRESETS[2].range());
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
    const [from, to] = range;
    const key = `${from}|${to}|${reload}`;
    const load: Load = result?.key === key ? result.load : { status: 'loading' };

    useEffect(() => {
        if (!from || !to) return;
        const controller = new AbortController();
        fetch(`/api/school/fees/collections?from=${from}&to=${to}`, { cache: 'no-store', signal: controller.signal })
            .then(async res => {
                const body: unknown = await res.json().catch(() => null);
                if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load collections.'));
                setResult({ key, load: { status: 'ready', body: body as CollectionsResponse } });
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setResult({ key, load: { status: 'error', message: err instanceof Error ? err.message : 'Could not load collections.' } });
            });
        return () => controller.abort();
    }, [from, to, key]);

    const activePreset = PRESETS.find(p => { const [a, b] = p.range(); return a === from && b === to; })?.id;
    const body = load.status === 'ready' ? load.body : null;
    const days = body ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 1;

    return (
        <div className="flex flex-col gap-4">
            <section aria-label="Period" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Quick periods">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            aria-pressed={activePreset === p.id}
                            onClick={() => setRange(p.range())}
                            className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', activePreset === p.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2 lg:w-80">
                    <input type="date" className="input-field" aria-label="From" value={from} max={to} onChange={e => e.target.value && setRange([e.target.value, to])} />
                    <input type="date" className="input-field" aria-label="To" value={to} min={from} onChange={e => e.target.value && setRange([from, e.target.value])} />
                </div>
            </section>

            {load.status === 'error' ? (
                <LoadError title="Couldn't load collections" message={load.message} onRetry={() => setReload(n => n + 1)} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        <StatTile icon={Coins} label="Received" value={body ? formatKsh(body.total) : '—'} tone="good" />
                        <StatTile icon={Receipt} hue="blue" label="Payments" value={body ? body.count : '—'} hint={body && body.count > 0 ? `average ${formatKsh(Math.round(body.total / body.count))}` : undefined} />
                        <StatTile icon={CalendarRange} hue="violet" label="Per day" value={body ? formatKsh(Math.round(body.total / days)) : '—'} hint={`over ${days} ${days === 1 ? 'day' : 'days'}`} className="col-span-2 md:col-span-1" />
                    </div>
                    {body ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Bars title="By method" rows={body.byMethod} />
                            <Bars title="By class" rows={body.byClass} />
                            {body.byDay.length > 1 && <div className="lg:col-span-2"><Bars title="By day" rows={body.byDay} label={b => dayLabel(b.key)} /></div>}
                        </div>
                    ) : <div className="h-48 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />}
                </>
            )}
        </div>
    );
}
