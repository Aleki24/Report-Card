import React from 'react';
import { formatKsh } from '@/lib/fee-account';
import { cn } from '@/lib/utils';

/** A sum of money and how many payments made it, under a label. */
export interface MoneyBucket {
    key: string;
    label: string;
    amount: number;
    count: number;
}

/** Labelled horizontal bars, one hue: each bar is its share of the largest. */
export function MoneyBars<B extends MoneyBucket>({ title, rows, label = b => b.label, empty = 'Nothing received.', barClassName = 'bg-emerald-500', className }: {
    title: string;
    rows: readonly B[];
    label?: (b: B) => React.ReactNode;
    empty?: string;
    barClassName?: string;
    className?: string;
}) {
    const max = Math.max(1, ...rows.map(r => r.amount));
    return (
        <section className={cn('rounded-2xl border border-border/70 bg-card p-4 shadow-sm', className)}>
            <h3 className="mb-3 text-sm font-semibold">{title}</h3>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
                <ul className="flex flex-col gap-2.5">
                    {rows.map(r => (
                        <li key={r.key}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate">{label(r)}</span>
                                <span className="shrink-0 font-semibold tabular-nums">{formatKsh(r.amount)} <span className="font-normal text-muted-foreground">· {r.count}</span></span>
                            </div>
                            <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                <span className={cn('block h-full rounded-full', barClassName)} style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
