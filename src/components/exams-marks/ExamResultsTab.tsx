"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BarChart3, ClipboardList, LayoutGrid, Trophy, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExamResultsTable, type MarkRow } from '@/components/exam-results/ExamResultsTable';
import type { ExamSubjectComponentScheme } from '@/types';
import { ExamAnalysisPanel } from '@/components/exam-results/ExamAnalysisPanel';
import { AllSubjectsView } from '@/components/exam-results/AllSubjectsView';
import { ExamStatusBar } from '@/components/exam-results/ExamStatusBar';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';
import { markEntryHref } from '@/lib/marking-progress';
import { findActiveTermId } from '@/lib/term-calendar';
import { localToday } from '@/lib/assignments';
import { getExamTypeLabel } from '@/lib/exam-types';
import { currentExamType, examTypeDates, examTypeOrder } from '@/lib/exam-schedule';
import type { ExamWindowsResponse } from '@/lib/exam-windows';
import { cn } from '@/lib/utils';
import { STEP_TONES } from './examTheme';

interface GradeStreamOption { id: string; full_name: string; grade_id: string }
interface TermOption {
    id: string; name: string; academic_year_id: string; academic_year_name?: string | null;
    start_date?: string; end_date?: string; is_current?: boolean;
}
/** One subject's paper in the chosen class, term and exam. */
interface ExamOption {
    id: string; name: string; exam_type: string; max_score: number; exam_date?: string | null;
    subject_name: string; subject_id?: string; term_id?: string;
    status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
}

type Tab = 'allsubjects' | 'results' | 'analysis' | 'reports';
/** Views about one subject's paper: they share the Term → Exam → Subject picker. */
const PAPER_TABS: ReadonlySet<Tab> = new Set<Tab>(['results', 'analysis']);

const STATUS_LABEL: Record<NonNullable<ExamOption['status']>, string> = { DRAFT: 'not released', PENDING_APPROVAL: 'awaiting approval', APPROVED: 'released' };

/**
 * Results for one class. "All subjects" is the class broadsheet; the paper
 * views (one subject, its analysis, quick entry) pick a paper by term, exam
 * and subject. The exam dropdown used to list every paper the class had ever
 * had, across every term, and opened on whichever came first (often an old,
 * empty CAT); now it only lists the chosen term's, and opens on the exam
 * the school has open for the class, else the latest one already due.
 */
export function ExamResultsTab() {
    const { role } = useAuth();
    // Report cards have their own page, for those it lets in.
    const canOpenReports = role === 'ADMIN' || role === 'CLASS_TEACHER';

    // ?stream=<grade_stream_id>&exam=<exam_id> (the Publish tab's "Review
    // marks") opens straight onto that paper.
    const searchParams = useSearchParams();
    const linkedStreamId = searchParams.get('stream') || '';
    const linkedExamId = searchParams.get('exam') || '';

    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [loadingStreams, setLoadingStreams] = useState(true);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [streamId, setStreamId] = useState(linkedStreamId);
    const [activeTab, setActiveTab] = useState<Tab>(linkedExamId ? 'results' : 'allsubjects');

    // The paper picker. Empty picks fall back to sensible defaults below.
    const [pickedTermId, setPickedTermId] = useState('');
    const [pickedType, setPickedType] = useState('');
    const [pickedExamId, setPickedExamId] = useState('');

    const [exams, setExams] = useState<ExamOption[]>([]);
    const [loadingExams, setLoadingExams] = useState(false);
    const [openTypeByGrade, setOpenTypeByGrade] = useState<ReadonlyMap<string, string>>(new Map());

    const [marks, setMarks] = useState<MarkRow[]>([]);
    const [markScheme, setMarkScheme] = useState<ExamSubjectComponentScheme | null>(null);
    const [loadingMarks, setLoadingMarks] = useState(false);

    // ── Classes and terms ──
    useEffect(() => {
        (async () => {
            try {
                const [streamsRes, termsRes] = await Promise.all([
                    fetch('/api/school/data?type=grade_streams'),
                    fetch('/api/school/data?type=terms'),
                ]);
                const streamsJson = (await streamsRes.json().catch(() => null)) as { data?: GradeStreamOption[] } | null;
                const termsJson = (await termsRes.json().catch(() => null)) as { data?: TermOption[] } | null;
                setGradeStreams(streamsRes.ok ? streamsJson?.data ?? [] : []);
                setTerms(termsRes.ok ? termsJson?.data ?? [] : []);
            } catch (err) {
                console.error('Failed to load classes and terms:', err);
            } finally {
                setLoadingStreams(false);
            }
        })();
    }, []);

    const stream = gradeStreams.find(s => s.id === streamId) ?? null;
    const activeTermId = useMemo(() => findActiveTermId(terms), [terms]);
    const termId = pickedTermId || activeTermId || terms[0]?.id || '';
    // Newest year first; "Term 1" repeats every year, so later years are named.
    const termGroups = useMemo(() => {
        const groups = new Map<string, { name: string; terms: TermOption[] }>();
        for (const t of terms) {
            const g = groups.get(t.academic_year_id) ?? { name: t.academic_year_name || 'Other', terms: [] };
            g.terms.push(t);
            groups.set(t.academic_year_id, g);
        }
        return [...groups.values()].reverse();
    }, [terms]);

    // ── A "Review marks" link: find its paper's term and exam ──
    const handledLinkRef = useRef('');
    useEffect(() => {
        if (!linkedStreamId || !linkedExamId || !stream || stream.id !== linkedStreamId) return;
        const key = `${linkedStreamId}:${linkedExamId}`;
        if (handledLinkRef.current === key) return;
        handledLinkRef.current = key;
        (async () => {
            const params = new URLSearchParams({ stream_id: stream.id, grade_id: stream.grade_id });
            const res = await fetch(`/api/school/exams?${params}`).catch(() => null);
            const json = res?.ok ? ((await res.json()) as { data?: ExamOption[] }) : null;
            const exam = json?.data?.find(e => e.id === linkedExamId);
            if (!exam) return;
            setActiveTab('results');
            setPickedTermId(exam.term_id ?? '');
            setPickedType(exam.exam_type);
            setPickedExamId(exam.id);
        })();
    }, [linkedStreamId, linkedExamId, stream]);

    // A later link while this tab is open re-uses the mounted component.
    useEffect(() => {
        if (linkedStreamId) setStreamId(linkedStreamId);
    }, [linkedStreamId]);

    // ── The chosen term's papers for the class, and the exam open for it ──
    const loadExams = useCallback(async () => {
        if (!stream || !termId) { setExams([]); return; }
        setLoadingExams(true);
        try {
            const params = new URLSearchParams({ stream_id: stream.id, grade_id: stream.grade_id, term_id: termId });
            const [examsRes, windowsRes] = await Promise.all([
                fetch(`/api/school/exams?${params}`),
                fetch(`/api/school/exam-windows?term_id=${encodeURIComponent(termId)}`),
            ]);
            const examsJson = (await examsRes.json().catch(() => null)) as { data?: ExamOption[] } | null;
            const windowsJson = (await windowsRes.json().catch(() => null)) as ExamWindowsResponse | null;
            setExams(examsRes.ok ? examsJson?.data ?? [] : []);
            setOpenTypeByGrade(new Map(windowsRes.ok ? (windowsJson?.data ?? []).map(w => [w.grade_id, w.exam_type]) : []));
        } catch (err) {
            console.error('Failed to fetch exams:', err);
            setExams([]);
        } finally {
            setLoadingExams(false);
        }
    }, [stream, termId]);

    useEffect(() => { void loadExams(); }, [loadExams]);

    const types = useMemo(() => [...new Set(exams.map(e => e.exam_type))].sort((a, b) => examTypeOrder(a) - examTypeOrder(b)), [exams]);
    const openType = stream ? openTypeByGrade.get(stream.grade_id) ?? '' : '';
    const dueType = useMemo(() => currentExamType(examTypeDates(exams), localToday()), [exams]);
    const examType = types.includes(pickedType) ? pickedType
        : types.includes(openType) ? openType
        : dueType && types.includes(dueType) ? dueType
        : types[0] ?? '';
    const papers = useMemo(
        () => exams.filter(e => e.exam_type === examType).sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
        [exams, examType],
    );
    const selectedExam = papers.find(e => e.id === pickedExamId) ?? papers[0] ?? null;
    const selectedExamId = selectedExam?.id ?? '';
    const showsPaper = PAPER_TABS.has(activeTab);

    // ── Marks for the chosen paper, only while a paper view is open ──
    const fetchMarks = useCallback(async () => {
        if (!selectedExamId) { setMarks([]); setMarkScheme(null); return; }
        setLoadingMarks(true);
        try {
            const res = await fetch(`/api/school/exam-marks?exam_id=${encodeURIComponent(selectedExamId)}`);
            const json = (await res.json().catch(() => null)) as { data?: MarkRowSource[]; scheme?: ExamSubjectComponentScheme | null } | null;
            setMarks(res.ok ? (json?.data ?? []).map(toMarkRow) : []);
            setMarkScheme(res.ok ? json?.scheme ?? null : null);
        } catch (err) {
            console.error('Failed to fetch marks:', err);
            setMarks([]);
            setMarkScheme(null);
        } finally {
            setLoadingMarks(false);
        }
    }, [selectedExamId]);

    useEffect(() => {
        if (showsPaper) void fetchMarks();
    }, [fetchMarks, showsPaper]);

    const chooseStream = (id: string) => {
        setStreamId(id);
        // A new class starts on its own defaults; the view stays where it was.
        setPickedType('');
        setPickedExamId('');
    };

    const tabs = RESULT_TABS.filter(t => t.key !== 'reports' || canOpenReports);

    return (
        <div className="mx-auto w-full max-w-7xl">
            {/* ── Class, and for paper views the term → exam → subject ── */}
            <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Class">
                    <select className="input-field w-full" value={streamId} onChange={e => chooseStream(e.target.value)} disabled={loadingStreams}>
                        <option value="">{loadingStreams ? 'Loading classes…' : 'Choose a class'}</option>
                        {gradeStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                </Field>

                {streamId && showsPaper && (
                    <>
                        <Field label="Term">
                            <select
                                className="input-field w-full"
                                value={termId}
                                onChange={e => { setPickedTermId(e.target.value); setPickedType(''); setPickedExamId(''); }}
                            >
                                {termGroups.map(g => (
                                    <optgroup key={g.name} label={g.name}>
                                        {g.terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === activeTermId ? ' (current)' : ''}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </Field>
                        <Field label="Exam">
                            <select
                                className="input-field w-full"
                                value={examType}
                                onChange={e => { setPickedType(e.target.value); setPickedExamId(''); }}
                                disabled={loadingExams || types.length === 0}
                            >
                                {loadingExams ? <option value="">Loading…</option>
                                    : types.length === 0 ? <option value="">No exams this term</option>
                                    : types.map(t => <option key={t} value={t}>{getExamTypeLabel(t)}{t === openType ? ' · being marked' : ''}</option>)}
                            </select>
                        </Field>
                        <Field label="Subject">
                            <select
                                className="input-field w-full"
                                value={selectedExamId}
                                onChange={e => setPickedExamId(e.target.value)}
                                disabled={loadingExams || papers.length === 0}
                            >
                                {papers.length === 0 ? <option value="">{loadingExams ? 'Loading…' : 'No subjects'}</option>
                                    : papers.map(e => <option key={e.id} value={e.id}>{e.subject_name} · {STATUS_LABEL[e.status ?? 'DRAFT']}</option>)}
                            </select>
                        </Field>
                    </>
                )}
            </div>

            {!streamId ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                    <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400" aria-hidden><Trophy className="size-6" /></span>
                    <p className="text-sm font-semibold text-foreground">Choose a class to see its results</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">Compare every subject, look at one subject&apos;s paper, or see its analysis.</p>
                </div>
            ) : (
                <>
                    <div role="tablist" aria-label="Results views" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/50 p-1 [scrollbar-width:none]">
                        {tabs.map((tab, i) => {
                            const active = activeTab === tab.key;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        'flex min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <span className={cn('flex size-7 items-center justify-center rounded-lg transition-colors', active && STEP_TONES[i % STEP_TONES.length].tile)} aria-hidden><Icon className="size-4" /></span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === 'allsubjects' && <AllSubjectsView gradeStreamId={streamId} terms={terms} />}

                    {activeTab === 'reports' && canOpenReports && (
                        <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400" aria-hidden><FEATURE_ICONS.reports className="size-5" /></span>
                                <div>
                                    <p className="font-semibold text-foreground">Report cards have their own page</p>
                                    <p className="text-sm text-muted-foreground">Download the whole class or one learner, choose the card design, send results by SMS and compare terms.</p>
                                </div>
                            </div>
                            <Link href="/dashboard/reports" className="btn-primary shrink-0 no-underline">
                                Open Report Cards <ArrowRight className="size-4" aria-hidden />
                            </Link>
                        </div>
                    )}

                    {showsPaper && (
                        loadingExams ? (
                            <div className="card p-5"><InlineLoadingSkeleton rows={6} /></div>
                        ) : !selectedExam ? (
                            <div className="card py-16 text-center text-sm text-muted-foreground">
                                {types.length === 0 ? 'No exams are set up for this class this term.' : 'No subjects have this exam in this class.'}
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-3 sm:p-4">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400" aria-hidden><ClipboardList className="size-5" /></span>
                                    <div className="min-w-0 text-sm">
                                        <p className="truncate font-semibold text-foreground">{selectedExam.subject_name} · {getExamTypeLabel(selectedExam.exam_type)}</p>
                                        <p className="text-xs text-muted-foreground">{stream?.full_name} · {terms.find(t => t.id === termId)?.name} · Out of {selectedExam.max_score}</p>
                                    </div>
                                </div>
                                <ExamStatusBar examId={selectedExam.id} status={selectedExam.status || 'DRAFT'} onChanged={() => void loadExams()} />

                                {loadingMarks ? (
                                    <div className="card p-5"><InlineLoadingSkeleton rows={6} /></div>
                                ) : activeTab === 'results' ? (
                                    <ExamResultsTable
                                        marks={marks}
                                        maxScore={selectedExam.max_score || 100}
                                        examId={selectedExam.id}
                                        gradeStreamId={streamId}
                                        scheme={markScheme}
                                        onRefresh={fetchMarks}
                                        onMarkPatched={patched => setMarks(prev => prev.map(m => (m.id === patched.id ? patched : m)))}
                                        markEntryLink={markEntryHref(selectedExam.term_id, selectedExam.id)}
                                    />
                                ) : (
                                    <ExamAnalysisPanel marks={marks} />
                                )}
                            </>
                        )
                    )}
                </>
            )}
        </div>
    );
}

/** A mark as /api/school/exam-marks returns it. */
interface MarkRowSource {
    id: string; student_id: string; student_name?: string; admission_number?: string;
    raw_score: number | string; percentage?: number | string | null; grade_symbol?: string | null;
    rubric?: MarkRow['rubric']; remarks?: MarkRow['remarks']; components?: MarkRow['components'];
}

function toMarkRow(m: MarkRowSource): MarkRow {
    return {
        id: m.id,
        student_id: m.student_id,
        student_name: m.student_name || '',
        admission_number: m.admission_number || '',
        raw_score: Number(m.raw_score),
        percentage: Number(m.percentage || 0),
        grade_symbol: m.grade_symbol || '-',
        rubric: m.rubric ?? null,
        remarks: m.remarks ?? null,
        components: m.components,
    };
}

const RESULT_TABS: readonly { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'allsubjects', label: 'All subjects', icon: LayoutGrid },
    { key: 'results', label: 'One subject', icon: ClipboardList },
    { key: 'analysis', label: 'Analysis', icon: BarChart3 },
    { key: 'reports', label: 'Report cards', icon: FEATURE_ICONS.reports },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block min-w-0 text-xs font-semibold text-muted-foreground">
            <span className="mb-2 block">{label}</span>
            {children}
        </label>
    );
}
