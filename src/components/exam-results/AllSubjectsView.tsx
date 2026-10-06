"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { RankBadge } from '@/components/ui/RankBadge';
import { findActiveTermId } from '@/lib/term-calendar';
import {
    ALL_EXAMS, broadsheetExamName, broadsheetExamTypes, broadsheetTermIds, buildBroadsheet, defaultBroadsheetFilter, type BroadsheetMark,
} from '@/lib/broadsheet';
import { cn } from '@/lib/utils';

interface Props {
    gradeStreamId: string;
    /** The school's terms, in the order they run. */
    terms: readonly { id: string; name: string; start_date?: string; end_date?: string; is_current?: boolean }[];
}

const scoreTone = (n: number) => (n >= 70 ? 'text-emerald-600 dark:text-emerald-400' : n >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');

/** Every learner in a class against every subject, for one exam or a term's best marks. */
export function AllSubjectsView({ gradeStreamId, terms }: Props) {
    // Results and picks are kept per class, so switching class starts clean without resetting state in an effect.
    const [loaded, setLoaded] = useState<{ streamId: string; marks: BroadsheetMark[] } | null>(null);
    const [pick, setPick] = useState<{ streamId: string; termId: string | null; examType: string | null } | null>(null);
    const loading = loaded?.streamId !== gradeStreamId;
    const marks = useMemo(() => (loaded?.streamId === gradeStreamId ? loaded.marks : []), [loaded, gradeStreamId]);
    const picked = pick?.streamId === gradeStreamId ? pick : { termId: null, examType: null };
    const setPicked = (next: { termId: string | null; examType: string | null }) => setPick({ streamId: gradeStreamId, ...next });

    useEffect(() => {
        if (!gradeStreamId) return;
        let live = true;
        fetch(`/api/school/exam-marks/stream?stream_id=${encodeURIComponent(gradeStreamId)}`)
            .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch marks'))))
            .then((json: { data?: BroadsheetMark[] }) => { if (live) setLoaded({ streamId: gradeStreamId, marks: json.data ?? [] }); })
            .catch(err => { console.error(err); if (live) setLoaded({ streamId: gradeStreamId, marks: [] }); });
        return () => { live = false; };
    }, [gradeStreamId]);

    const activeTermId = useMemo(() => findActiveTermId([...terms]), [terms]);
    const termIds = useMemo(() => broadsheetTermIds(marks), [marks]);
    const fallback = useMemo(() => defaultBroadsheetFilter(marks, terms.map(t => t.id), activeTermId), [marks, terms, activeTermId]);
    const termId = picked.termId && termIds.has(picked.termId) ? picked.termId : fallback.termId;
    const examTypes = useMemo(() => broadsheetExamTypes(marks, termId), [marks, termId]);
    // The term's latest exam unless another (or all of them) was picked.
    const examType = picked.examType === ALL_EXAMS ? null
        : picked.examType && examTypes.includes(picked.examType) ? picked.examType
        : examTypes[examTypes.length - 1] ?? null;
    const { rows, subjects, subjectNames } = useMemo(() => buildBroadsheet(marks, { termId, examType }), [marks, termId, examType]);
    const termName = terms.find(t => t.id === termId)?.name ?? 'This term';

    if (loading) {
        return <div className="card p-12 text-center text-sm text-muted-foreground">Loading all subjects…</div>;
    }
    if (marks.length === 0) {
        return <div className="card p-12 text-center text-sm text-muted-foreground">No marks found for this class. Enter marks for an exam first.</div>;
    }

    return (
        <div className="card overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2.5 text-base font-semibold">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400" aria-hidden><LayoutGrid className="size-4" /></span>
                        All subjects — class results
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {termName} · {broadsheetExamName(examType)} · {rows.length} learners · {subjects.length} subjects
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-auto sm:min-w-[22rem]">
                    <label className="text-xs font-semibold text-muted-foreground">
                        Term
                        <select className="input-field mt-1 w-full" value={termId ?? ''} onChange={e => setPicked({ termId: e.target.value, examType: null })}>
                            {terms.filter(t => termIds.has(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                        Exam
                        <select className="input-field mt-1 w-full" value={examType ?? ALL_EXAMS} onChange={e => setPicked({ termId, examType: e.target.value })}>
                            {examTypes.map(t => <option key={t} value={t}>{broadsheetExamName(t)}</option>)}
                            {examTypes.length > 1 && <option value={ALL_EXAMS}>{broadsheetExamName(null)}</option>}
                        </select>
                    </label>
                </div>
            </div>
            {rows.length === 0 ? (
                <p className="border-t border-border p-8 text-center text-sm text-muted-foreground">No marks for this exam yet.</p>
            ) : (
                <div className="w-full overflow-x-auto border-t border-border">
                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b-2 border-border bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <th className="whitespace-nowrap px-3 py-2.5 text-left">Rank</th>
                                <th className="sticky left-0 z-10 whitespace-nowrap bg-muted px-3 py-2.5 text-left">Student</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-left">Adm No</th>
                                {subjects.map(s => (
                                    <th key={s} className="min-w-20 whitespace-nowrap px-3 py-2.5 text-center" title={subjectNames[s]}>{s}</th>
                                ))}
                                <th className="whitespace-nowrap px-3 py-2.5 text-center">Total</th>
                                <th className="whitespace-nowrap px-3 py-2.5 text-center">Avg</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={row.studentId} className={cn('border-b border-border', i % 2 === 1 && 'bg-muted/30')}>
                                    <td className="whitespace-nowrap px-3 py-2.5"><RankBadge rank={row.rank} /></td>
                                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2.5 font-medium">{row.name}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{row.admNo || '—'}</td>
                                    {subjects.map(s => {
                                        const val = row.subjects[s];
                                        return (
                                            <td key={s} className="whitespace-nowrap px-3 py-2.5 text-center">
                                                {val ? (
                                                    <span title={`${val.name} - Grade: ${val.grade}`}>
                                                        <span className="font-semibold">{val.score.toFixed(0)}</span>
                                                        <span className="ml-0.5 text-[10px] text-muted-foreground">{val.grade}</span>
                                                    </span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </td>
                                        );
                                    })}
                                    <td className="whitespace-nowrap px-3 py-2.5 text-center font-bold">{row.total}</td>
                                    <td className={cn('whitespace-nowrap px-3 py-2.5 text-center font-bold', scoreTone(row.average))}>{row.average}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
