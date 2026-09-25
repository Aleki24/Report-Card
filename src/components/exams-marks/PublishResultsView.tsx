"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, Info, Loader2, PenLine, Send } from 'lucide-react';
import { findActiveTermId } from '@/lib/term-calendar';
import { ALL_EXAM_TYPES } from '@/lib/exam-types';
import { markEntryHref } from '@/lib/marking-progress';
import { cn } from '@/lib/utils';

type Embedded<T> = T | T[] | null | undefined;
interface GradeStreamOption {
    id: string;
    full_name: string;
    grade_id: string;
    grades?: Embedded<{ academic_levels?: Embedded<{ code?: string | null }> }>;
}

const first = <T,>(value: Embedded<T>): T | undefined => (Array.isArray(value) ? value[0] : value ?? undefined);

/** CBC classes are ranked by marks only; points ranking is an 8-4-4 idea. */
const isCbcStream = (stream?: GradeStreamOption): boolean =>
    first(first(stream?.grades)?.academic_levels)?.code?.trim().toUpperCase() === 'CBC';

interface TermOption { id: string; name: string; academic_year_id?: string; start_date?: string; end_date?: string; is_current?: boolean }
type ExamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
interface ApiExam { id: string; name: string; exam_type: string; subject_id: string; subject_name?: string; status?: ExamStatus }
interface ExamRow { id: string; name: string; exam_type: string; subject_id: string; subject_name: string; status: ExamStatus }

interface StreamMark {
    exam_id: string;
    student_id: string;
    percentage: number | string | null;
    grade_symbol: string | null;
    students?: { admission_number?: string | null; users?: { first_name?: string | null; last_name?: string | null } | null } | null;
}
interface GradingSystemRow { id: string; system_kind?: string }
interface GradingScaleRow { grading_system_id: string; symbol: string; points?: number | null }

interface StudentGap { name: string; admission_number: string; missing?: string[] }
interface PublishReadiness {
    isMultiPaper: boolean;
    papers: { code: string; name: string }[];
    rosterCount: number;
    markedCount: number;
    fullyMarkedCount: number;
    unmarked: StudentGap[];
    partiallyMarked: StudentGap[];
    hasIssues: boolean;
}

type RankBy = 'total_marks' | 'mean_marks' | 'total_points' | 'mean_points';

/** 'PENDING_APPROVAL' is a retired middle state; treat any row still carrying it as released. */
const isReleased = (status: ExamStatus) => status !== 'DRAFT';

const examTypeName = (code: string) => ALL_EXAM_TYPES.find(t => t.code === code)?.shortName ?? code;

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'inline-flex min-h-9 items-center rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
        >
            {children}
        </button>
    );
}

/**
 * Release Results — choose a class, term and exam, see which subjects learners
 * can already see, and release or withdraw them.
 *
 * "Released" controls one thing: whether learners see the subject's marks in
 * their student portal and on the report-card QR check. Staff always see every
 * mark, and marks can still be corrected after release.
 */
export function PublishResultsView() {
    const [streams, setStreams] = useState<GradeStreamOption[]>([]);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [streamId, setStreamId] = useState('');
    const [termId, setTermId] = useState('');
    const [examType, setExamType] = useState('');

    const [termExams, setTermExams] = useState<ExamRow[]>([]);
    const [loadingExams, setLoadingExams] = useState(false);
    const [busyExamId, setBusyExamId] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [confirmExam, setConfirmExam] = useState<{ id: string; name: string; subject: string; readiness: PublishReadiness } | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const [rankBy, setRankBy] = useState<RankBy>('mean_marks');
    const [minSubjects, setMinSubjects] = useState(7);
    const cbcClass = isCbcStream(streams.find(s => s.id === streamId));
    // A CBC class has one ranking criterion — total marks. Total, not mean: a
    // mean favours whoever sat fewer subjects.
    const effectiveRankBy: RankBy = cbcClass ? 'total_marks' : rankBy;
    const [marks, setMarks] = useState<StreamMark[]>([]);
    const [pointsBySymbol, setPointsBySymbol] = useState<Record<string, number>>({});
    const [loadingPreview, setLoadingPreview] = useState(false);

    // ── Classes + terms; start on the current term, and the only class if there is one ──
    useEffect(() => {
        (async () => {
            try {
                const [gsRes, tRes] = await Promise.all([
                    fetch('/api/school/data?type=grade_streams'),
                    fetch('/api/school/data?type=terms'),
                ]);
                const gsJson = (await gsRes.json()) as { data?: GradeStreamOption[] };
                const tJson = (await tRes.json()) as { data?: TermOption[] };
                const streamList = gsJson.data ?? [];
                const termList = tJson.data ?? [];
                setStreams(streamList);
                setTerms(termList);
                setTermId(findActiveTermId(termList) ?? termList[0]?.id ?? '');
                if (streamList.length === 1) setStreamId(streamList[0].id);
            } catch (err) {
                console.error('Failed to load classes/terms', err);
            }
        })();
    }, []);

    // ── Every exam for the class in the term; the round filter is applied locally ──
    const loadExams = useCallback(async () => {
        const stream = streams.find(s => s.id === streamId);
        if (!stream || !termId) { setTermExams([]); return; }
        setLoadingExams(true);
        try {
            const params = new URLSearchParams({ stream_id: streamId, grade_id: stream.grade_id, term_id: termId });
            const res = await fetch(`/api/school/exams?${params.toString()}`);
            const json = (await res.json()) as { data?: ApiExam[] };
            setTermExams((json.data ?? []).map(e => ({
                id: e.id, name: e.name, exam_type: e.exam_type, subject_id: e.subject_id,
                subject_name: e.subject_name || 'N/A', status: e.status ?? 'DRAFT',
            })));
        } catch (err) {
            console.error('Failed to load exams', err);
            setTermExams([]);
        } finally {
            setLoadingExams(false);
        }
    }, [streamId, termId, streams]);

    useEffect(() => { void loadExams(); }, [loadExams]);

    const availableTypes = useMemo(
        () => ALL_EXAM_TYPES.map(t => t.code).filter(code => termExams.some(e => e.exam_type === code)),
        [termExams],
    );
    // Keep the chosen round while it exists; otherwise the first one this term.
    const effectiveExamType = availableTypes.includes(examType) ? examType : availableTypes[0] ?? '';
    const exams = useMemo(
        () => termExams.filter(e => e.exam_type === effectiveExamType).sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
        [termExams, effectiveExamType],
    );

    // ── Marks for the round: per-subject counts and the ranking preview ──
    const loadPreview = useCallback(async () => {
        if (!streamId || exams.length === 0) { setMarks([]); return; }
        setLoadingPreview(true);
        try {
            const [marksRes, structRes] = await Promise.all([
                // Any exam in the term scopes the stream endpoint to that term.
                fetch(`/api/school/exam-marks/stream?stream_id=${streamId}&exam_id=${exams[0].id}`),
                fetch('/api/admin/academic-structure'),
            ]);
            const marksJson = (await marksRes.json()) as { data?: StreamMark[] };
            const struct = (await structRes.json()) as { grading_systems?: GradingSystemRow[]; grading_scales?: GradingScaleRow[] };
            const overallIds = new Set((struct.grading_systems ?? []).filter(g => g.system_kind === 'OVERALL').map(g => g.id));
            const map: Record<string, number> = {};
            for (const sc of struct.grading_scales ?? []) {
                if (!overallIds.has(sc.grading_system_id)) map[sc.symbol] = sc.points ?? 0;
            }
            setPointsBySymbol(map);
            const examIds = new Set(exams.map(e => e.id));
            setMarks((marksJson.data ?? []).filter(m => examIds.has(m.exam_id)));
        } catch (err) {
            console.error('Failed to load preview', err);
            setMarks([]);
        } finally {
            setLoadingPreview(false);
        }
    }, [streamId, exams]);

    useEffect(() => { void loadPreview(); }, [loadPreview]);

    const markedByExam = useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of marks) counts.set(m.exam_id, (counts.get(m.exam_id) ?? 0) + 1);
        return counts;
    }, [marks]);

    // ── Release / withdraw ──
    // Releasing is a two-step confirm: the first POST returns a readiness
    // report (who is unmarked or missing papers); the confirmed POST commits.
    const release = async (exam: ExamRow) => {
        setBusyExamId(exam.id);
        try {
            const res = await fetch(`/api/school/exams/${exam.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish' }),
            });
            const data = (await res.json()) as { error?: string; requiresConfirmation?: boolean; readiness?: PublishReadiness };
            if (!res.ok) { toast.error(data.error || 'Could not release'); return; }
            if (data.requiresConfirmation && data.readiness) {
                setConfirmExam({ id: exam.id, name: exam.name, subject: exam.subject_name, readiness: data.readiness });
                return;
            }
            toast.success(`${exam.subject_name} released to learners.`);
            await loadExams();
        } catch { toast.error('Network error'); }
        finally { setBusyExamId(null); }
    };

    const withdraw = async (exam: ExamRow) => {
        if (!window.confirm(`Hide ${exam.subject_name} from learners again? Staff still see the marks, and you can release it again at any time.`)) return;
        setBusyExamId(exam.id);
        try {
            const res = await fetch(`/api/school/exams/${exam.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unpublish' }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) { toast.error(data.error || 'Could not withdraw'); return; }
            toast.success(`${exam.subject_name} hidden from learners.`);
            await loadExams();
        } catch { toast.error('Network error'); }
        finally { setBusyExamId(null); }
    };

    const confirmRelease = async () => {
        if (!confirmExam) return;
        setConfirmBusy(true);
        try {
            const res = await fetch(`/api/school/exams/${confirmExam.id}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'publish', confirm: true }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) { toast.error(data.error || 'Could not release'); return; }
            toast.success(`${confirmExam.subject} released to learners.`);
            setConfirmExam(null);
            await loadExams();
        } catch { toast.error('Network error'); }
        finally { setConfirmBusy(false); }
    };

    const notReleased = exams.filter(e => !isReleased(e.status));
    const releaseAll = async () => {
        if (notReleased.length === 0) { toast.info('Everything is already released.'); return; }
        if (!window.confirm(`Release ${notReleased.length} subject${notReleased.length !== 1 ? 's' : ''} to learners? Learners with no mark in a subject simply won't see it, and a missing paper counts as 0.`)) return;
        setBulkBusy(true);
        let ok = 0, fail = 0;
        for (const ex of notReleased) {
            try {
                const res = await fetch(`/api/school/exams/${ex.id}/status`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'publish', confirm: true }),
                });
                if (res.ok) ok++; else fail++;
            } catch { fail++; }
        }
        setBulkBusy(false);
        toast[fail === 0 ? 'success' : 'warning'](`Released ${ok} subject${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}.`);
        await loadExams();
    };

    // ── Ranking preview ──
    const ranking = useMemo(() => {
        const byStudent = new Map<string, { name: string; adm: string; pcts: number[]; pts: number[] }>();
        for (const m of marks) {
            const u = m.students?.users;
            const rec = byStudent.get(m.student_id) ?? { name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim(), adm: m.students?.admission_number ?? '', pcts: [], pts: [] };
            rec.pcts.push(Number(m.percentage) || 0);
            rec.pts.push(m.grade_symbol && pointsBySymbol[m.grade_symbol] != null ? pointsBySymbol[m.grade_symbol] : 0);
            byStudent.set(m.student_id, rec);
        }
        const rows = Array.from(byStudent.entries()).map(([sid, r]) => {
            const totalMarks = r.pcts.reduce((a, b) => a + b, 0);
            const meanMarks = r.pcts.length ? totalMarks / r.pcts.length : 0;
            const bestPts = [...r.pts].sort((a, b) => b - a).slice(0, Math.max(1, minSubjects));
            const totalPoints = bestPts.reduce((a, b) => a + b, 0);
            const meanPoints = bestPts.length ? totalPoints / bestPts.length : 0;
            return { sid, name: r.name, adm: r.adm, subjects: r.pcts.length, totalMarks, meanMarks, totalPoints, meanPoints };
        });
        const key = ({ total_marks: 'totalMarks', mean_marks: 'meanMarks', total_points: 'totalPoints', mean_points: 'meanPoints' } as const)[effectiveRankBy];
        rows.sort((a, b) => b[key] - a[key]);
        let rank = 0;
        let prev: number | null = null;
        return rows.map((r, i) => {
            const v = r[key];
            if (prev === null || v !== prev) { rank = i + 1; prev = v; }
            return { ...r, rank };
        });
    }, [marks, pointsBySymbol, effectiveRankBy, minSubjects]);

    const releasedCount = exams.length - notReleased.length;
    const th = 'px-4 py-3 text-xs font-semibold text-muted-foreground';

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            {/* What releasing means, in one sentence */}
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 text-sm">
                <Info size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <p className="text-muted-foreground">
                    <strong className="text-foreground">Releasing</strong> a subject lets learners see its marks in their student portal and on the report-card QR check.
                    Staff always see every mark. You can still <strong className="text-foreground">correct marks</strong> after releasing, and you can withdraw a subject at any time.
                </p>
            </div>

            {/* Scope */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Class</span>
                        <select className="input-field w-full" value={streamId} onChange={e => setStreamId(e.target.value)}>
                            <option value="">Choose a class…</option>
                            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Term</span>
                        <select className="input-field w-full" value={termId} onChange={e => setTermId(e.target.value)}>
                            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                </div>
                {streamId && availableTypes.length > 0 && (
                    <div>
                        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam</span>
                        <div className="flex flex-wrap gap-2">
                            {availableTypes.map(t => (
                                <Pill key={t} active={effectiveExamType === t} onClick={() => setExamType(t)}>{examTypeName(t)}</Pill>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {!streamId ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Choose a class to see which of its results learners can see.</div>
            ) : (
                <>
                    {/* Subjects */}
                    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
                        <header className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                            <div>
                                <h3 className="font-display text-base font-bold">Subjects</h3>
                                {exams.length > 0 && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {releasedCount} of {exams.length} released to learners
                                    </p>
                                )}
                            </div>
                            <button type="button" className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50" onClick={() => void releaseAll()} disabled={bulkBusy || notReleased.length === 0}>
                                {bulkBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
                                {notReleased.length > 0 ? `Release all (${notReleased.length})` : 'All released'}
                            </button>
                        </header>

                        {loadingExams ? (
                            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
                        ) : exams.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">No exams for this class in the selected term.</p>
                        ) : (
                            <ul className="divide-y divide-border/60">
                                {exams.map(ex => {
                                    const released = isReleased(ex.status);
                                    const busy = busyExamId === ex.id;
                                    const marked = markedByExam.get(ex.id) ?? 0;
                                    return (
                                        <li key={ex.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">{ex.subject_name}</span>
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                                        released ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                                                    )}>
                                                        {released ? <Eye size={11} aria-hidden /> : <EyeOff size={11} aria-hidden />}
                                                        {released ? 'Learners can see' : 'Hidden from learners'}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {loadingPreview ? 'Counting marks…' : marked === 0 ? 'No marks entered yet' : `${marked} learner${marked !== 1 ? 's' : ''} marked`}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Link href={markEntryHref(termId, ex.id)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                                                    <PenLine size={13} aria-hidden /> {marked === 0 ? 'Enter marks' : 'Correct marks'}
                                                </Link>
                                                {released ? (
                                                    <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void withdraw(ex)} disabled={busy}>
                                                        {busy ? 'Working…' : 'Withdraw'}
                                                    </button>
                                                ) : (
                                                    <button type="button" className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50" onClick={() => void release(ex)} disabled={busy || marked === 0} title={marked === 0 ? 'Enter marks before releasing' : undefined}>
                                                        {busy ? 'Working…' : 'Release'}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    {/* Ranking preview */}
                    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
                        <header className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
                            <div>
                                <h3 className="font-display text-base font-bold">Class ranking preview</h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">{effectiveExamType ? `${examTypeName(effectiveExamType)} · ` : ''}{cbcClass ? 'CBC: ranked by total marks' : 'Check the order before releasing'}</p>
                            </div>
                            {!cbcClass && (
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="block">
                                        <span className="mb-1 block text-[11px] text-muted-foreground">Rank by</span>
                                        <select className="input-field text-sm" value={rankBy} onChange={e => setRankBy(e.target.value as RankBy)}>
                                            <option value="total_marks">Total marks</option>
                                            <option value="mean_marks">Mean marks</option>
                                            <option value="total_points">Total points</option>
                                            <option value="mean_points">Mean points</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-[11px] text-muted-foreground">Best subjects</span>
                                        <input type="number" min={1} max={20} className="input-field w-20 text-center text-sm" value={minSubjects} onChange={e => setMinSubjects(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                                    </label>
                                </div>
                            )}
                        </header>
                        {loadingPreview ? (
                            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
                        ) : ranking.length === 0 ? (
                            <p className="p-6 text-sm text-muted-foreground">No marks entered yet for this exam.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[34rem] text-left">
                                    <thead className="border-b border-border/60 bg-muted/40">
                                        <tr>
                                            <th className={cn(th, 'text-center')}>Pos</th>
                                            <th className={th}>Learner</th>
                                            <th className={cn(th, 'text-center')}>Subjects</th>
                                            <th className={cn(th, 'text-center')}>Total</th>
                                            <th className={cn(th, 'text-center')}>Mean %</th>
                                            {!cbcClass && <th className={cn(th, 'text-center')}>Total pts</th>}
                                            {!cbcClass && <th className={cn(th, 'text-center')}>Mean pts</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {ranking.map(r => (
                                            <tr key={r.sid} className="transition-colors hover:bg-muted/40">
                                                <td className="px-4 py-2.5 text-center font-bold text-primary tabular-nums">{r.rank}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="text-sm font-medium">{r.name}</div>
                                                    <div className="text-[11px] text-muted-foreground">{r.adm}</div>
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-sm tabular-nums">{r.subjects}</td>
                                                <td className="px-4 py-2.5 text-center text-sm font-semibold tabular-nums">{Math.round(r.totalMarks)}</td>
                                                <td className="px-4 py-2.5 text-center text-sm tabular-nums">{r.meanMarks.toFixed(1)}%</td>
                                                {!cbcClass && <td className="px-4 py-2.5 text-center text-sm tabular-nums">{r.totalPoints}</td>}
                                                {!cbcClass && <td className="px-4 py-2.5 text-center text-sm tabular-nums">{r.meanPoints.toFixed(2)}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="border-t border-border/60 px-5 py-3 text-[11px] text-muted-foreground">
                            {cbcClass
                                ? 'Preview only — CBC learners are ranked by total marks, the same as on report cards and the mark sheet.'
                                : 'Preview only — the official report-card ranking uses the full 8-4-4 subject clustering. "Best subjects" sums each learner’s top grade points.'}
                        </p>
                    </section>
                </>
            )}

            {confirmExam && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !confirmBusy && setConfirmExam(null)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="release-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h2 id="release-title" className="mb-1 font-display text-base font-bold">Release {confirmExam.subject} to learners?</h2>
                        <p className="mb-4 text-xs text-muted-foreground">{confirmExam.name} — learners will see these marks in their portal. You can withdraw or correct them later.</p>

                        <div className="mb-4 grid grid-cols-3 gap-2">
                            {[
                                { value: confirmExam.readiness.fullyMarkedCount, label: 'Fully marked', tone: 'text-emerald-600 dark:text-emerald-400' },
                                { value: confirmExam.readiness.partiallyMarked.length, label: 'Missing papers', tone: 'text-amber-600' },
                                { value: confirmExam.readiness.unmarked.length, label: 'No mark', tone: 'text-muted-foreground' },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl bg-muted/50 p-3 text-center">
                                    <div className={cn('text-lg font-bold tabular-nums', s.tone)}>{s.value}</div>
                                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {confirmExam.readiness.partiallyMarked.length > 0 && (
                            <div className="mb-3">
                                <p className="mb-1 text-xs font-semibold text-amber-600">Missing some papers — a missing paper counts as 0:</p>
                                <ul className="max-h-32 space-y-0.5 overflow-y-auto pl-1 text-xs text-muted-foreground">
                                    {confirmExam.readiness.partiallyMarked.slice(0, 50).map((s, i) => (
                                        <li key={i}><strong className="text-foreground">{s.name || s.admission_number}</strong>{s.missing && s.missing.length > 0 && <span> — missing {s.missing.join(', ')}</span>}</li>
                                    ))}
                                    {confirmExam.readiness.partiallyMarked.length > 50 && <li>…and {confirmExam.readiness.partiallyMarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {confirmExam.readiness.unmarked.length > 0 && (
                            <div className="mb-3">
                                <p className="mb-1 text-xs font-semibold text-muted-foreground">No mark yet — nothing will show for them:</p>
                                <ul className="max-h-32 space-y-0.5 overflow-y-auto pl-1 text-xs text-muted-foreground">
                                    {confirmExam.readiness.unmarked.slice(0, 50).map((s, i) => <li key={i}>{s.name || s.admission_number}</li>)}
                                    {confirmExam.readiness.unmarked.length > 50 && <li>…and {confirmExam.readiness.unmarked.length - 50} more</li>}
                                </ul>
                            </div>
                        )}

                        {!confirmExam.readiness.hasIssues && (
                            <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={14} aria-hidden /> Every learner in this class is fully marked.</p>
                        )}

                        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
                            {confirmExam.readiness.hasIssues && (
                                <Link href={markEntryHref(termId, confirmExam.id)} className="btn-secondary justify-center" onClick={() => setConfirmExam(null)}>Finish marking first</Link>
                            )}
                            <button type="button" className="btn-secondary justify-center" onClick={() => setConfirmExam(null)} disabled={confirmBusy}>Cancel</button>
                            <button type="button" className="btn-primary justify-center disabled:opacity-50" onClick={() => void confirmRelease()} disabled={confirmBusy}>
                                {confirmBusy ? 'Releasing…' : confirmExam.readiness.hasIssues ? 'Release anyway' : 'Release'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
