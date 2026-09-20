"use client";

import React, { useEffect, useState } from 'react';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';
import type { OverviewClass } from '@/app/api/school/analytics/overview/route';

/**
 * Which classes need attention, and nothing else.
 *
 * The school-level view used to carry a merit list and a subject table as well.
 * Both asked questions that have no answer at this level: ranking a Grade 1
 * learner against a Form 4 candidate, and averaging subjects that share a name
 * across four curriculum bands. Removing them is the point of this component,
 * not an omission from it — the real analysis lives one level down, inside a
 * class, where a comparison means something.
 *
 * Pass rate leads because it is the one figure that survives being read across
 * curricula, and every row still names its curriculum so the reader can decide
 * what is worth comparing.
 */

interface OverviewPayload {
    academic_year: string | null;
    classes: OverviewClass[];
    summary: {
        classes_with_marks: number;
        classes_total: number;
        learners: number;
        mark_count: number;
        exams_awaiting_marks: number;
    };
}

function tone(passRate: number | null): string {
    if (passRate === null) return 'text-muted-foreground';
    if (passRate >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (passRate >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
}

function bar(passRate: number | null): string {
    if (passRate === null) return 'bg-muted-foreground/30';
    if (passRate >= 70) return 'bg-emerald-500';
    if (passRate >= 40) return 'bg-amber-500';
    return 'bg-destructive';
}

export default function SchoolOverview({ onSelectClass }: { onSelectClass: (id: string) => void }) {
    // Undefined until fetched, so loading is derived rather than tracked in a
    // flag set synchronously inside the effect.
    const [data, setData] = useState<OverviewPayload | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/school/analytics/overview')
            .then(r => r.json())
            .then(json => { if (!cancelled) setData(json?.error ? null : json); })
            .catch(err => { console.error('Overview error:', err); if (!cancelled) setData(null); });
        return () => { cancelled = true; };
    }, []);

    if (data === undefined) {
        return <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />;
    }

    const withMarks = (data?.classes ?? []).filter(c => c.mark_count > 0);

    if (!data || withMarks.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm font-medium text-foreground">No marks recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Once exams are marked, each class will appear here.
                </p>
            </div>
        );
    }

    const { summary } = data;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-3 xs:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Classes</p>
                    <p className="mt-1 text-xl font-bold text-foreground xs:text-2xl">{summary.classes_with_marks}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">of {summary.classes_total} with marks</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 xs:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Learners</p>
                    <p className="mt-1 text-xl font-bold text-foreground xs:text-2xl">{summary.learners}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">enrolled</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 xs:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Marks</p>
                    <p className="mt-1 text-xl font-bold text-foreground xs:text-2xl">{summary.mark_count}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {data.academic_year ? data.academic_year : 'this year'}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 xs:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Awaiting marks</p>
                    <p className={`mt-1 text-xl font-bold xs:text-2xl ${summary.exams_awaiting_marks > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                        {summary.exams_awaiting_marks}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">papers sat, unmarked</p>
                </div>
            </div>

            <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border p-4">
                    <h2 className="text-sm font-semibold text-foreground">Classes, weakest first</h2>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        Pass rate is the share of marks at or above 50%. CBC and 8-4-4 are graded
                        differently, so each row names its curriculum — open a class for its
                        subjects and merit list.
                    </p>
                </div>

                <ul className="divide-y divide-border">
                    {withMarks.map(c => {
                        const curriculum = shortCurriculumLabel(c.level_code);
                        return (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelectClass(c.id)}
                                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 xs:px-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                            <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                                            {curriculum && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                    {curriculum}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={`h-full rounded-full ${bar(c.pass_rate)}`}
                                                style={{ width: `${Math.max(c.pass_rate ?? 0, 2)}%` }}
                                            />
                                        </div>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {c.students} learner{c.students === 1 ? '' : 's'} · mean {c.mean ?? '—'}%
                                            {c.unmarked > 0 && ` · ${c.unmarked} unmarked`}
                                        </p>
                                    </div>
                                    {/* Fixed-width slot so the bars above line up across rows. */}
                                    <span className={`w-12 shrink-0 text-right text-sm font-semibold ${tone(c.pass_rate)}`}>
                                        {c.pass_rate === null ? '—' : `${c.pass_rate}%`}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
