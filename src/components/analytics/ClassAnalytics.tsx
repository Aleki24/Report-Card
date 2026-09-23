"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-3 xs:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold text-foreground xs:text-2xl">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>}
        </div>
    );
}

export default function ClassAnalytics({ streamId }: { streamId: string }) {
    const [examType, setExamType] = useState<string | null>(null);
    // null means "whichever term the school is in"; the server resolves it.
    const [termId, setTermId] = useState<string | null>(null);

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
        return <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />;
    }

    if (!data || data.summary.mark_count === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm font-medium text-foreground">No marks for this class yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {data?.scope.term_name
                        ? `Nothing recorded for ${data.scope.term_name}.`
                        : 'Once marks are entered they will be analysed here.'}
                </p>
            </div>
        );
    }

    const curriculum = shortCurriculumLabel(data.class.level_code, data.class.level_name);
    const incompleteCount = data.merit.filter(m => m.incomplete).length;

    return (
        <div className="space-y-5">
            {/* Who and when. Stated, never implied. */}
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{data.class.full_name}</h2>
                {curriculum && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {curriculum}
                    </span>
                )}

                {/*
                  A term picker, not just a label. Defaulting to the current
                  term is right; offering only the current term is not — for a
                  while after a term rolls over, the previous one still holds
                  all the marks, and the reader has no way back to it.
                */}
                {data.terms.length > 1 ? (
                    <select
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                        value={data.scope.term_id ?? ''}
                        onChange={e => { setTermId(e.target.value || null); setExamType(null); }}
                        aria-label="Term"
                    >
                        {data.terms.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name}{t.is_current ? ' (current)' : ''}
                            </option>
                        ))}
                    </select>
                ) : data.scope.term_name && (
                    <span className="text-xs text-muted-foreground">{data.scope.term_name}</span>
                )}
            </div>

            {/* Exam series. A series is a term plus an exam type, so "Term 2
                Endterm" is one thing rather than nine exams sharing a name. */}
            {data.series.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Exam
                    </span>
                    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
                        <button
                            onClick={() => setExamType(null)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                examType === null ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            All
                        </button>
                        {data.series.map(s => (
                            <button
                                key={`${s.term_id}-${s.exam_type}`}
                                onClick={() => setExamType(s.exam_type)}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
                <Stat
                    label="Class average"
                    value={`${data.summary.mean_percentage}%`}
                    sub={`${data.summary.mark_count} marks`}
                />
                <Stat label="Pass rate" value={`${data.summary.pass_rate}%`} sub="at or above 50%" />
                {/* Learners, counted as learners. */}
                <Stat label="Learners" value={String(data.summary.student_count)} sub="with marks" />
                <Stat label="Subjects" value={String(data.summary.subject_count)} sub="assessed" />
            </div>

            {/* ── Subject ranking, best first ──────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">Subject ranking</h3>
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
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
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
            <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border p-4">
                    <h3 className="text-sm font-semibold text-foreground">Merit list</h3>
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
                        <li key={m.student_id} className="flex items-center gap-3 p-3 xs:px-4">
                            <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground">
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
                            <span className="shrink-0 text-sm font-semibold text-foreground">
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
    );
}
