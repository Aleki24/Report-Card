"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronRight, ClipboardList, School, Users } from 'lucide-react';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';
import { cn } from '@/lib/utils';
import { StatTile } from '@/components/ui/StatTile';
import type { OverviewClass, OverviewScope } from '@/app/api/school/analytics/overview/route';

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
    scope: OverviewScope;
    classes: OverviewClass[];
    summary: {
        classes_with_marks: number;
        classes_total: number;
        learners: number;
        mark_count: number;
        exams_awaiting_marks: number;
    };
}

/** What a fetch for one period settled as. */
type OverviewResult =
    | { kind: 'ok'; data: OverviewPayload }
    | { kind: 'term-unavailable'; message: string }
    | { kind: 'error' };

function passTone(passRate: number | null): { text: string; bar: string } {
    if (passRate === null) return { text: 'text-muted-foreground', bar: 'bg-muted-foreground/30' };
    if (passRate >= 70) return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (passRate >= 40) return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { text: 'text-destructive', bar: 'bg-destructive' };
}

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BarChart3 className="size-6" aria-hidden="true" />
            </span>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

interface SchoolOverviewProps {
    yearId: string | null;
    /** Null = the whole year. */
    termId: string | null;
    onSelectClass: (id: string) => void;
    /** Offered when term figures are unavailable. */
    onShowWholeYear: () => void;
}

export default function SchoolOverview({ yearId, termId, onSelectClass, onShowWholeYear }: SchoolOverviewProps) {
    // Results keyed by the period that produced them, so loading is derived
    // (no entry yet) rather than a flag set synchronously inside the effect,
    // and switching period never shows the previous period's figures.
    const key = `${yearId ?? 'latest'}|${termId ?? 'year'}`;
    const [results, setResults] = useState<Record<string, OverviewResult>>({});
    const result = results[key];

    useEffect(() => {
        if (results[key]) return;
        const controller = new AbortController();
        const params = new URLSearchParams();
        if (yearId) params.set('academic_year_id', yearId);
        if (termId) params.set('term_id', termId);
        fetch(`/api/school/analytics/overview?${params.toString()}`, { signal: controller.signal })
            .then(async r => {
                const json = await r.json();
                const settled: OverviewResult = r.ok
                    ? { kind: 'ok', data: json as OverviewPayload }
                    : json?.code === 'TERM_FILTER_UNAVAILABLE'
                        ? { kind: 'term-unavailable', message: String(json.error) }
                        : { kind: 'error' };
                setResults(prev => ({ ...prev, [key]: settled }));
            })
            .catch(err => {
                if (controller.signal.aborted) return;
                console.error('Overview error:', err);
                setResults(prev => ({ ...prev, [key]: { kind: 'error' } }));
            });
        return () => controller.abort();
    }, [key, yearId, termId, results]);

    if (!result) {
        return (
            <div className="space-y-4" aria-hidden="true">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}
                </div>
                <div className="h-72 animate-pulse rounded-2xl bg-muted/60" />
            </div>
        );
    }

    if (result.kind === 'term-unavailable') {
        return (
            <EmptyPanel
                title="Term figures aren't available yet"
                body={result.message}
                action={<button type="button" className="btn-secondary" onClick={onShowWholeYear}>Show the whole year</button>}
            />
        );
    }

    if (result.kind === 'error') {
        return <EmptyPanel title="Couldn't load analytics" body="Something went wrong fetching these figures. Try another period or reload the page." />;
    }

    const { data } = result;
    const withMarks = data.classes.filter(c => c.mark_count > 0);
    const period = [data.scope.term_name, data.scope.academic_year].filter(Boolean).join(', ') || 'this period';

    if (withMarks.length === 0) {
        return (
            <EmptyPanel
                title={`No marks recorded for ${period}`}
                body={data.scope.term_id
                    ? 'Choose an earlier term above, or wait until exams for this term are marked.'
                    : 'Once exams are marked, each class will appear here.'}
            />
        );
    }

    const { summary } = data;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile icon={School} hue="amber" label="Classes" value={summary.classes_with_marks} hint={`of ${summary.classes_total} with marks`} />
                <StatTile icon={Users} hue="orange" label="Learners" value={summary.learners.toLocaleString()} hint="enrolled" />
                <StatTile icon={BarChart3} hue="sky" label="Marks" value={summary.mark_count.toLocaleString()} hint={period} />
                <StatTile
                    icon={ClipboardList}
                    label="Awaiting marks"
                    value={summary.exams_awaiting_marks}
                    hint="papers sat, unmarked"
                    tone={summary.exams_awaiting_marks > 0 ? 'warn' : 'default'}
                />
            </div>

            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <div className="flex flex-col gap-1 border-b border-border/70 p-4 sm:p-5">
                    <h2 className="font-semibold">Classes, weakest first</h2>
                    <p className="text-xs leading-snug text-muted-foreground">
                        Pass rate is the share of marks at or above 50%. CBC and 8-4-4 are graded
                        differently, so each row names its curriculum. Open a class for its
                        subjects and merit list.
                    </p>
                </div>

                <ul className="divide-y divide-border/60">
                    {withMarks.map(c => {
                        const curriculum = shortCurriculumLabel(c.level_code);
                        const tone = passTone(c.pass_rate);
                        return (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelectClass(c.id)}
                                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06] focus-visible:outline-none sm:px-5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="truncate text-sm font-semibold group-hover:text-primary">{c.name}</span>
                                            {curriculum && (
                                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{curriculum}</span>
                                            )}
                                            {c.unmarked > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                    <AlertTriangle className="size-3" aria-hidden="true" />{c.unmarked} unmarked
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                            <div className={cn('h-full rounded-full transition-[width] duration-500', tone.bar)} style={{ width: `${Math.max(c.pass_rate ?? 0, 2)}%` }} />
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                                            {c.students} learner{c.students === 1 ? '' : 's'} · mean {c.mean ?? '—'}%
                                        </p>
                                    </div>
                                    {/* Fixed-width slot so the bars above line up across rows. */}
                                    <span className="flex w-16 shrink-0 flex-col items-end">
                                        <span className={cn('text-base font-bold tabular-nums', tone.text)}>
                                            {c.pass_rate === null ? '—' : `${c.pass_rate}%`}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">pass rate</span>
                                    </span>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
