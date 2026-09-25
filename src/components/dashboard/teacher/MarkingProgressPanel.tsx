"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList } from 'lucide-react';
import { ALL_EXAM_TYPES } from '@/lib/exam-types';
import { markEntryHref, markingState, type MarkingProgressItem, type MarkingState } from '@/lib/marking-progress';
import { cn } from '@/lib/utils';

interface MarkingProgressPanelProps {
    items: MarkingProgressItem[];
    termName: string | null;
    loading: boolean;
    /** Rows before "Show all". */
    limit?: number;
}

const STATE_ORDER: Record<MarkingState, number> = { 'in-progress': 0, 'not-started': 1, complete: 2, 'no-learners': 3 };

const STATE_META: Record<MarkingState, { label: string; bar: string; chip: string; action: string }> = {
    'in-progress': { label: 'In progress', bar: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', action: 'Continue' },
    'not-started': { label: 'Not started', bar: 'bg-muted-foreground/40', chip: 'bg-muted text-muted-foreground', action: 'Start' },
    complete: { label: 'Complete', bar: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', action: 'Review' },
    'no-learners': { label: 'No learners', bar: 'bg-muted', chip: 'bg-muted text-muted-foreground', action: 'Open' },
};

const typeName = (code: string) => ALL_EXAM_TYPES.find(t => t.code === code)?.shortName ?? code;
const typeOrder = (code: string) => ALL_EXAM_TYPES.find(t => t.code === code)?.order ?? 99;

/**
 * Every exam this teacher marks this term, with how far each has got —
 * unfinished work first — and a one-tap link straight to its mark sheet.
 */
export default function MarkingProgressPanel({ items, termName, loading, limit = 6 }: MarkingProgressPanelProps) {
    const types = useMemo(() => [...new Set(items.map(i => i.examType))].sort((a, b) => typeOrder(a) - typeOrder(b)), [items]);
    // Open on the round that has work in it: the first one with marks begun but
    // not finished, else the first with anything left, else the first.
    const defaultType = useMemo(() => {
        const unfinished = (state: MarkingState) => types.find(t => items.some(i => i.examType === t && markingState(i) === state));
        return unfinished('in-progress') ?? unfinished('not-started') ?? types[0] ?? '';
    }, [items, types]);
    const [picked, setPicked] = useState('');
    const [showAll, setShowAll] = useState(false);
    const activeType = types.includes(picked) ? picked : defaultType;

    const rows = useMemo(
        () => items
            .filter(i => i.examType === activeType)
            .sort((a, b) => STATE_ORDER[markingState(a)] - STATE_ORDER[markingState(b)] || a.subjectName.localeCompare(b.subjectName)),
        [items, activeType],
    );
    const shown = showAll ? rows : rows.slice(0, limit);
    const totals = rows.reduce((acc, r) => ({ entered: acc.entered + r.entered, expected: acc.expected + r.expected }), { entered: 0, expected: 0 });
    const pct = totals.expected > 0 ? Math.round((totals.entered / totals.expected) * 100) : 0;

    return (
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="font-display text-base font-bold tracking-tight">My marking</h2>
                    <p className="text-xs text-muted-foreground">{termName ? `${termName} · ` : ''}Tap an exam to enter or correct its marks</p>
                </div>
                {types.length > 1 && (
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Exam">
                        {types.map(t => (
                            <button
                                key={t}
                                type="button"
                                role="tab"
                                aria-selected={t === activeType}
                                onClick={() => { setPicked(t); setShowAll(false); }}
                                className={cn(
                                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                    t === activeType ? 'bg-foreground text-background' : 'bg-muted/60 text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {typeName(t)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="space-y-2" aria-busy>
                    {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><ClipboardList size={20} aria-hidden /></span>
                    <p className="text-sm font-semibold">No exams to mark yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">When your admin sets up this term&apos;s exams for your subjects, they will show up here.</p>
                </div>
            ) : (
                <>
                    {totals.expected > 0 && (
                        <div className="mb-4 rounded-xl bg-muted/40 p-3">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                                <span className="font-semibold text-foreground">{typeName(activeType)} overall</span>
                                <span className="tabular-nums text-muted-foreground"><strong className="text-foreground">{totals.entered}</strong> / {totals.expected} marks · {pct}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${typeName(activeType)} marks entered`}>
                                <div className={cn('h-full rounded-full transition-[width] duration-500', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    )}

                    <ul className="flex flex-col gap-2">
                        {shown.map(item => {
                            const state = markingState(item);
                            const meta = STATE_META[state];
                            const itemPct = item.expected > 0 ? Math.min(100, Math.round((item.entered / item.expected) * 100)) : 0;
                            return (
                                <li key={item.examId}>
                                    <Link
                                        href={markEntryHref(item.termId, item.examId)}
                                        className="group flex items-center gap-3 rounded-xl border border-border/60 p-3 no-underline transition-all hover:border-primary/40 hover:bg-primary/[0.03]"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="truncate text-sm font-semibold text-foreground">{item.subjectName}</span>
                                                <span className="text-xs text-muted-foreground">{item.className}</span>
                                                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.chip)}>
                                                    {state === 'complete' && <CheckCircle2 size={10} aria-hidden />}
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                    <div className={cn('h-full rounded-full', meta.bar)} style={{ width: `${itemPct}%` }} />
                                                </div>
                                                <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{item.entered}/{item.expected}</span>
                                            </div>
                                        </div>
                                        <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary xs:inline-flex">
                                            {meta.action}
                                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                                        </span>
                                        <ArrowRight size={16} className="shrink-0 text-primary xs:hidden" aria-hidden />
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    {rows.length > limit && (
                        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5">
                            {showAll ? 'Show fewer' : `Show all ${rows.length}`}
                        </button>
                    )}
                </>
            )}
        </section>
    );
}
