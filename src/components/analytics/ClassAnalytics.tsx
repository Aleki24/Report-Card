"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, BookOpen, CheckCircle2, Medal, Users } from 'lucide-react';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';
import { cn } from '@/lib/utils';
import { StatTile, type StatTone } from '@/components/ui/StatTile';
import type { ClassSubjectRow, MeritRow, SeriesRow } from '@/app/api/school/analytics/class/route';

/**
 * Everything the old Analytics page tried to say about a school, said about a
 * class instead.
 *
 * The school-wide version ranked Grade 1 learners against Form 4 candidates and
 * averaged a Lower Primary "Mathematics" with a Senior School one — the school
 * has "Religious Education" in four curriculum bands and "Kiswahili" in four,
 * and they were listed as separate rows under the same name, then expanded
 * together because the expand key was the name.
 *
 * Inside a class none of that arises. One grade, one curriculum, one set of
 * scales, so every comparison on this screen is one a teacher would actually
 * make.
 */

interface ClassPayload {
    class: {
        id: string;
        full_name: string;
        grade_name: string | null;
        level_code: string | null;
        level_name: string | null;
    };
    scope: { term_id: string | null; term_name: string | null; exam_type: string | null };
    summary: {
        /** The school's pass mark, set in Settings. */
        pass_mark: number;
        mean_percentage: number;
        pass_rate: number;
        student_count: number;
        subject_count: number;
        mark_count: number;
    };
    subjects: ClassSubjectRow[];
    merit: MeritRow[];
    series: SeriesRow[];
    terms: { id: string; name: string; is_current: boolean }[];
}

/** Colour by pass rate, not by mean: it is the figure that survives across scales. */
function toneFor(passRate: number): string {
    if (passRate >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (passRate >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
}

function barFor(passRate: number): string {
    if (passRate >= 70) return 'bg-emerald-500';
    if (passRate >= 40) return 'bg-amber-500';
    return 'bg-destructive';
}

const passStatTone = (passRate: number): StatTone => (passRate >= 70 ? 'good' : passRate >= 40 ? 'warn' : 'bad');

/** Gold, silver and bronze for the top three places. */
const PODIUM: Record<number, string> = {
    1: 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
    2: 'bg-slate-400/20 text-slate-700 dark:text-slate-300',
    3: 'bg-orange-400/20 text-orange-700 dark:text-orange-300',
};

interface ClassAnalyticsProps {
    streamId: string;
    /** The term to analyse, chosen by the page. Null lets the server pick the current one. */
    termId: string | null;
    /** "Term 2 · 2025", for headings. */
    periodLabel: string;
}

export default function ClassAnalytics({ streamId, termId, periodLabel }: ClassAnalyticsProps) {
    // The page keys this component by class and term, so the exam filter
    // starts over whenever either changes.
    const [examType, setExamType] = useState<string | null>(null);

    /*
      Responses keyed by the request that produced them, rather than a `data`
      plus a `loading` flag set at the top of the effect. Setting state
      synchronously inside an effect triggers a cascading render, and switching
      class or exam would otherwise show the previous class's figures under the
      new class's heading for a frame.

      Undefined means "not fetched yet", null means "fetched and empty" — the
      distinction is what lets loading be derived instead of tracked.
    */
    const cacheKey = `${streamId}|${termId ?? 'current'}|${examType ?? 'all'}`;
    const [byKey, setByKey] = useState<Record<string, ClassPayload | null>>({});

    const data = byKey[cacheKey];
    const loading = data === undefined;

    useEffect(() => {
        if (byKey[cacheKey] !== undefined) return;
        let cancelled = false;

        const params = new URLSearchParams({ stream_id: streamId });
        if (termId) params.set('term_id', termId);
        if (examType) params.set('exam_type', examType);

        fetch(`/api/school/analytics/class?${params.toString()}`)
            .then(r => r.json())
            .then(json => {
                if (!cancelled) setByKey(prev => ({ ...prev, [cacheKey]: json?.error ? null : json }));
            })
            .catch(err => {
                console.error('Class analytics error:', err);
                if (!cancelled) setByKey(prev => ({ ...prev, [cacheKey]: null }));
            });

        return () => { cancelled = true; };
    }, [cacheKey, streamId, termId, examType, byKey]);

    // Best first, by mean score (the figure subjects are ranked on in a
    // class's results), pass rate breaking ties. Equal scores share a rank.
    const subjectRanking = useMemo(() => {
        const sorted = (data?.subjects ?? [])
            .slice()
            .sort((a, b) => b.mean_percentage - a.mean_percentage || b.pass_rate - a.pass_rate);
        return sorted.map(subject => ({
            ...subject,
            rank: sorted.findIndex(other => other.mean_percentage === subject.mean_percentage) + 1,
        }));
    }, [data]);

    // The merit list opens on the top 15; "Show all" is remembered per
    // class/term/exam, so switching class collapses it again.
    const [meritExpandedFor, setMeritExpandedFor] = useState<string | null>(null);
    const showAllMerit = meritExpandedFor === cacheKey;
    const MERIT_PREVIEW = 15;

    if (loading) {
        return (
            <div className="space-y-4" aria-hidden="true">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="h-80 animate-pulse rounded-2xl bg-muted/60" />
                    <div className="h-80 animate-pulse rounded-2xl bg-muted/60" />
                </div>
            </div>
        );
    }

    if (!data || data.summary.mark_count === 0) {
        return (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BarChart3 className="size-6" aria-hidden="true" />
                </span>
                <p className="font-semibold">{data ? `No marks for ${periodLabel || 'this term'}` : "Couldn't load this class"}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {data
                        ? 'Pick an earlier term or year in the filters above to see past results.'
                        : 'Something went wrong. Try another term or reload the page.'}
                </p>
            </div>
        );
    }

    const curriculum = shortCurriculumLabel(data.class.level_code, data.class.level_name);
    const incompleteCount = data.merit.filter(m => m.incomplete).length;

    return (
        <div className="space-y-5">
            {curriculum && (
                <p className="-mt-1 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-semibold">{curriculum}</span>
                    <span className="ml-2">{periodLabel}</span>
                </p>
            )}

            {/* Exam series. A series is a term plus an exam type, so "Term 2
                Endterm" is one thing rather than nine exams sharing a name. */}
            {data.series.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Exam
                    </span>
                    <div role="group" aria-label="Exam" className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
                        <button
                            onClick={() => setExamType(null)}
                            aria-pressed={examType === null}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                examType === null ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All
                        </button>
                        {data.series.map(s => (
                            <button
                                key={`${s.term_id}-${s.exam_type}`}
                                onClick={() => setExamType(s.exam_type)}
                                aria-pressed={examType === s.exam_type}
                                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                    examType === s.exam_type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile icon={BarChart3} hue="sky" label="Class average" value={`${data.summary.mean_percentage}%`} hint={`${data.summary.mark_count.toLocaleString()} marks`} />
                <StatTile icon={CheckCircle2} label="Pass rate" value={`${data.summary.pass_rate}%`} hint={`at or above ${data.summary.pass_mark}%`} tone={passStatTone(data.summary.pass_rate)} />
                <StatTile icon={Users} hue="orange" label="Learners" value={data.summary.student_count} hint="with marks" />
                <StatTile icon={BookOpen} hue="emerald" label="Subjects" value={data.summary.subject_count} hint="assessed" />
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* ── Subject ranking, best first ──────────────────────────────── */}
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <h3 className="flex items-center gap-2 font-semibold"><Award className="size-4 text-primary" aria-hidden="true" />Subject ranking</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Ranked from highest to lowest mean score. Colour shows the pass rate; grades come from this school&apos;s own scale.
                </p>

                <ol className="mt-4 space-y-3">
                    {subjectRanking.map(s => (
                        <li key={s.subject_id} className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {s.rank}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">
                                        {s.subject_name}
                                    </span>
                                    <span className={`shrink-0 text-xs font-semibold ${toneFor(s.pass_rate)}`}>
                                        {s.mean_percentage}%{s.grade_symbol ? ` · ${s.grade_symbol}` : ''}
                                    </span>
                                </div>
                                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={`h-full rounded-full ${barFor(s.pass_rate)}`}
                                        style={{ width: `${Math.min(Math.max(s.mean_percentage, 2), 100)}%` }}
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {s.pass_rate}% passed
                                    {` · ${s.student_count} learner${s.student_count === 1 ? '' : 's'}`}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ── Merit list ──────────────────────────────────────────────── */}
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <div className="border-b border-border/70 p-4 sm:p-5">
                    <h3 className="flex items-center gap-2 font-semibold"><Medal className="size-4 text-primary" aria-hidden="true" />Merit list</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {data.class.full_name}
                        {data.scope.term_name ? `, ${data.scope.term_name}` : ''}
                        {examType ? '' : ' — all exams this term'}
                        {incompleteCount > 0 && ` · ${incompleteCount} sat fewer papers and are unranked`}
                    </p>
                </div>

                {/* Stacks on narrow screens rather than scrolling sideways. */}
                <ul className="divide-y divide-border">
                    {(showAllMerit ? data.merit : data.merit.slice(0, MERIT_PREVIEW)).map(m => (
                        <li key={m.student_id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', m.rank ? PODIUM[m.rank] ?? 'bg-muted text-muted-foreground' : 'text-muted-foreground')}>
                                {m.rank ?? '—'}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{m.student_name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {m.admission_number || '—'} · {m.subjects_sat}/{m.papers_available} subjects
                                </p>
                            </div>
                            {m.incomplete && (
                                <span className="shrink-0 rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    incomplete
                                </span>
                            )}
                            <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                                {m.mean_percentage}%
                            </span>
                        </li>
                    ))}
                </ul>

                {data.merit.length > MERIT_PREVIEW && (
                    <button
                        type="button"
                        onClick={() => setMeritExpandedFor(showAllMerit ? null : cacheKey)}
                        aria-expanded={showAllMerit}
                        className="w-full border-t border-border p-3 text-center text-xs font-semibold text-primary transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                        {showAllMerit ? 'Show top 15 only' : `Show all ${data.merit.length} learners (${data.merit.length - MERIT_PREVIEW} more)`}
                    </button>
                )}
            </section>
            </div>
        </div>
    );
}
