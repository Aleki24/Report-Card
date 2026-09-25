"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExamResultsTable, type MarkRow } from '@/components/exam-results/ExamResultsTable';
import type { ExamSubjectComponentScheme } from '@/types';
import { ExamAnalysisPanel } from '@/components/exam-results/ExamAnalysisPanel';
import { QuickMarkEntry } from '@/components/exam-results/QuickMarkEntry';
import { AllSubjectsView } from '@/components/exam-results/AllSubjectsView';
import { ExamStatusBar } from '@/components/exam-results/ExamStatusBar';
import { markEntryHref } from '@/lib/marking-progress';
import { BarChart3, ClipboardList, Download, FileText, LayoutGrid, Package, PencilLine, Settings2, Trophy, type LucideIcon } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import { cn } from '@/lib/utils';
import { STEP_TONES } from './examTheme';

interface GradeStreamOption { id: string; full_name: string; grade_id: string; }
interface ExamOption {
    id: string; name: string; exam_type: string; max_score: number; subject_name: string; subject_id?: string; term_id?: string;
    status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED'; published_by?: string | null; approved_by?: string | null; created_by_teacher_id?: string | null;
}
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; academic_year_id: string; }

type Tab = 'allsubjects' | 'results' | 'analysis' | 'quickentry' | 'reports';

const EXAM_TYPE_LABELS: Record<string, string> = {
    CAT: 'CAT', TOPICAL: 'Topical', MIDTERM: 'Midterm', ENDTERM: 'End Term',
    OPENER: 'Opener', MOCK: 'Mock', PRE_MOCK: 'Pre-Mock', POST_MOCK: 'Post-Mock',
    ZONE: 'Zone', SUB_COUNTY: 'Sub-County', COUNTY: 'County', REGIONAL: 'Regional', NATIONAL: 'National',
};

export function ExamResultsTab() {
    const { user, profile } = useAuth();

    // Deep link from the Publish screen's "Review marks" action:
    // ?stream=<grade_stream_id>&exam=<exam_id> opens straight onto that exam's
    // marks so an admin can look at the results before approving them.
    const searchParams = useSearchParams();
    const linkedStreamId = searchParams.get('stream') || '';
    const linkedExamId = searchParams.get('exam') || '';

    // ----- Cascading filters -----
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [selectedStreamId, setSelectedStreamId] = useState(linkedStreamId);
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loadingStreams, setLoadingStreams] = useState(true);
    const [loadingExams, setLoadingExams] = useState(false);

    // The exam the URL asked for, consumed once the exam list arrives. Kept in
    // a ref so a manual pick afterwards is never overridden by a refetch.
    const wantedExamIdRef = useRef(linkedExamId);

    // ----- Tab + Data -----
    const [activeTab, setActiveTab] = useState<Tab>(linkedExamId ? 'results' : 'allsubjects');
    const [marks, setMarks] = useState<MarkRow[]>([]);
    const [markScheme, setMarkScheme] = useState<ExamSubjectComponentScheme | null>(null);
    const [loadingMarks, setLoadingMarks] = useState(false);

    // A later click on another pending exam re-uses this mounted component, so
    // follow the URL when it changes rather than only reading it on mount.
    useEffect(() => {
        if (!linkedStreamId && !linkedExamId) return;
        wantedExamIdRef.current = linkedExamId;
        if (linkedStreamId) setSelectedStreamId(linkedStreamId);
        if (linkedExamId) {
            setActiveTab('results');
            setSelectedExamId(linkedExamId);
        }
    }, [linkedStreamId, linkedExamId]);

    // ----- Reports tab -----
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [allTerms, setAllTerms] = useState<Term[]>([]);
    const [selectedYearId, setSelectedYearId] = useState('');
    const [selectedTermId, setSelectedTermId] = useState('');
    const [reportGenerating, setReportGenerating] = useState(false);
    const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [customReportTitle, setCustomReportTitle] = useState('');
    const [classStudents, setClassStudents] = useState<{ id: string; name: string; admission_number: string }[]>([]);
    // Which round of exams (CAT, Midterm, End Term, Mock, ...) to base the
    // report card on — a term can have several per subject.
    const [availableExamTypes, setAvailableExamTypes] = useState<string[]>([]);
    const [selectedReportExamType, setSelectedReportExamType] = useState('');

    // ═══════════════════ Data fetching (all via server APIs) ═══════════════════

    // 1. Fetch all grade streams (server-scoped)
    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const res = await fetch('/api/school/data?type=grade_streams');
                if (res.ok) {
                    const json = await res.json();
                    setGradeStreams(json.data || []);
                } else {
                    setGradeStreams([]);
                }
            } catch (err) {
                console.error('Failed to fetch streams:', err);
                setGradeStreams([]);
            } finally {
                setLoadingStreams(false);
            }
        };
        fetchStreams();
    }, []);

    // 2. Fetch exams for selected stream (via server API instead of browser Supabase)
    const fetchExams = useCallback(async (opts?: { keepSelection?: boolean }) => {
        if (!selectedStreamId) { setExams([]); setSelectedExamId(''); return; }
        setLoadingExams(true);
        const stream = gradeStreams.find(s => s.id === selectedStreamId);
        if (!stream) { setLoadingExams(false); return; }

        try {
            const params = new URLSearchParams({
                stream_id: selectedStreamId,
                grade_id: stream.grade_id,
            });
            const res = await fetch(`/api/school/exams?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                const mapped = (json.data || []).map((e: any) => ({
                    id: e.id,
                    name: e.name,
                    exam_type: e.exam_type,
                    max_score: e.max_score,
                    subject_name: e.subject_name || 'N/A',
                    subject_id: e.subject_id,
                    term_id: e.term_id,
                    status: e.status || 'DRAFT',
                    published_by: e.published_by,
                    approved_by: e.approved_by,
                    created_by_teacher_id: e.created_by_teacher_id,
                }));
                setExams(mapped);
                if (!opts?.keepSelection) {
                    // Prefer the exam a "Review marks" link asked for; fall
                    // back to the first one in the class.
                    const wanted = wantedExamIdRef.current;
                    wantedExamIdRef.current = '';
                    setSelectedExamId(
                        wanted && mapped.some((e: ExamOption) => e.id === wanted) ? wanted : (mapped[0]?.id || '')
                    );
                }
            } else {
                setExams([]);
                if (!opts?.keepSelection) setSelectedExamId('');
            }
        } catch (err) {
            console.error('Failed to fetch exams:', err);
            setExams([]);
            if (!opts?.keepSelection) setSelectedExamId('');
        } finally {
            setLoadingExams(false);
        }
    }, [selectedStreamId, gradeStreams]);

    // gradeStreams is a dependency because the request needs the stream's
    // grade_id — with a ?stream= deep link the id is set before they load.
    useEffect(() => { fetchExams(); }, [fetchExams]);

    // 3. Fetch marks for selected exam (via server API instead of browser Supabase)
    const fetchMarks = useCallback(async () => {
        if (!selectedExamId) { setMarks([]); return; }
        setLoadingMarks(true);

        try {
            const res = await fetch(`/api/school/exam-marks?exam_id=${selectedExamId}`);
            if (res.ok) {
                const json = await res.json();
                const mapped: MarkRow[] = (json.data || []).map((m: any) => ({
                    id: m.id,
                    student_id: m.student_id,
                    student_name: m.student_name || '',
                    admission_number: m.admission_number || '',
                    raw_score: Number(m.raw_score),
                    percentage: Number(m.percentage || 0),
                    grade_symbol: m.grade_symbol || '-',
                    rubric: m.rubric,
                    remarks: m.remarks,
                    components: m.components,
                }));
                setMarks(mapped);
                setMarkScheme(json.scheme || null);
            } else {
                setMarks([]);
                setMarkScheme(null);
            }
        } catch (err) {
            console.error('Failed to fetch marks:', err);
            setMarks([]);
            setMarkScheme(null);
        } finally {
            setLoadingMarks(false);
        }
    }, [selectedExamId]);

    useEffect(() => { fetchMarks(); }, [fetchMarks]);

    // 3.5. Fetch all students in the selected class (for reports tab)
    const fetchClassStudents = useCallback(async () => {
        if (!selectedStreamId) { setClassStudents([]); return; }
        
        try {
            const res = await fetch('/api/school/data?type=students');
            const json = await res.json();
            const allStudents = (json.data || []) as any[];
            
            const filtered = allStudents.filter((s: any) => 
                s.current_grade_stream_id === selectedStreamId
            ).map((s: any) => ({
                id: s.id,
                name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                admission_number: s.admission_number || '',
            })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            
            setClassStudents(filtered);
        } catch (err) {
            console.error('Failed to fetch class students:', err);
            setClassStudents([]);
        }
    }, [selectedStreamId]);

    useEffect(() => {
        if (selectedStreamId) fetchClassStudents();
    }, [selectedStreamId, fetchClassStudents]);

    // 3.6. Fetch which exam rounds (CAT, Midterm, End Term, Mock, ...) exist
    // for this class + term, so the admin/teacher can pick which one the
    // report card should be based on — a term can hold several per subject.
    useEffect(() => {
        setSelectedReportExamType('');
        if (!selectedStreamId || !selectedTermId) { setAvailableExamTypes([]); return; }
        const stream = gradeStreams.find(s => s.id === selectedStreamId);
        if (!stream) { setAvailableExamTypes([]); return; }

        (async () => {
            try {
                const params = new URLSearchParams({ stream_id: selectedStreamId, grade_id: stream.grade_id, term_id: selectedTermId });
                const res = await fetch(`/api/school/exams?${params.toString()}`);
                if (!res.ok) { setAvailableExamTypes([]); return; }
                const json = await res.json();
                const types = Array.from(new Set((json.data || []).map((e: any) => e.exam_type).filter(Boolean))) as string[];
                setAvailableExamTypes(types);
            } catch (err) {
                console.error('Failed to fetch exam types:', err);
                setAvailableExamTypes([]);
            }
        })();
    }, [selectedStreamId, selectedTermId, gradeStreams]);

    // 4. Fetch academic years + terms (for reports tab)
    useEffect(() => {
        const fetchYearsTerms = async () => {
            try {
                const [yearsRes, termsRes] = await Promise.all([
                    fetch('/api/school/data?type=academic_years'),
                    fetch('/api/school/data?type=terms'),
                ]);
                const [yearsJson, termsJson] = await Promise.all([
                    yearsRes.json(),
                    termsRes.json(),
                ]);
                setAcademicYears(yearsJson.data || []);
                setAllTerms(termsJson.data || []);
                if (yearsJson.data && yearsJson.data.length > 0) setSelectedYearId(yearsJson.data[0].id);
            } catch (err) {
                console.error('Failed to fetch years/terms:', err);
            }
        };
        fetchYearsTerms();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { setSelectedTermId(''); }, [selectedYearId]);

    const filteredTerms = allTerms.filter(t => t.academic_year_id === selectedYearId);

    // ═══════════════════ Report handlers ═══════════════════

    const handleDownloadReport = (studentId: string) => {
        const params = new URLSearchParams();
        if (selectedTermId) params.set('term', selectedTermId);
        if (selectedYearId) params.set('year', selectedYearId);
        if (customReportTitle) params.set('customTitle', customReportTitle);
        if (selectedReportExamType) params.set('examType', selectedReportExamType);
        window.open(`/api/reports/student/${studentId}?${params.toString()}`, '_blank');
    };

    // Bulk reports now use server API instead of browser-side supabase.rpc()
    const handleBulkReports = async () => {
        if (!selectedTermId || !selectedStreamId) {
            setReportMsg({ type: 'error', text: 'Select a term and class to generate bulk reports.' });
            return;
        }
        setReportGenerating(true);
        setReportMsg(null);

        try {
            const res = await fetch('/api/school/generate-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    term_id: selectedTermId,
                    grade_stream_id: selectedStreamId,
                }),
            });

            const json = await res.json();
            if (!res.ok || json.error) {
                setReportMsg({ type: 'error', text: `Failed: ${json.error || 'Unknown error'}` });
            } else {
                setReportMsg({ type: 'success', text: 'Bulk reports generated successfully!' });
            }
        } catch (err) {
            setReportMsg({ type: 'error', text: `Failed: ${err instanceof Error ? err.message : 'Network error'}` });
        } finally {
            setReportGenerating(false);
        }
    };

    // ═══════════════════ Current exam info ═══════════════════
    const selectedExam = exams.find(e => e.id === selectedExamId);

    // ═══════════════════ Render ═══════════════════
    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Header removed as it is now a tab */}

            {/* ── Cascading Filters ── */}
            <div
                className="card flex flex-col md:flex-row md:items-end gap-4 mb-6 p-5"
            >
                {/* Class / Stream */}
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-2">Class / Stream</label>
                    <select
                        className="input-field w-full"
                        value={selectedStreamId}
                        onChange={e => { setSelectedStreamId(e.target.value); setActiveTab('results'); }}
                        disabled={loadingStreams}
                    >
                        <option value="">-- Select Class --</option>
                        {gradeStreams.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                    </select>
                </div>

                {/* Exam */}
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-2">Exam</label>
                    <select
                        className="input-field w-full"
                        value={selectedExamId}
                        onChange={e => { setSelectedExamId(e.target.value); setActiveTab('results'); }}
                        disabled={!selectedStreamId || loadingExams}
                    >
                        {!selectedStreamId ? (
                            <option value="">Select a class first</option>
                        ) : loadingExams ? (
                            <option value="">Loading…</option>
                        ) : exams.length === 0 ? (
                            <option value="">No exams found</option>
                        ) : (
                            exams.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.name} — {e.subject_name} ({e.exam_type})
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {!selectedStreamId && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                    <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400" aria-hidden><Trophy className="size-6" /></span>
                    <p className="text-sm font-semibold text-foreground">Choose a class to see its results</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">Compare every subject, check one exam, see the analysis or download report cards.</p>
                </div>
            )}

            {/* Show content when stream is selected */}
            {selectedStreamId && (
                <>
                    {/* Selected Exam Info (only if a specific exam is selected) */}
                    {selectedExamId && selectedExam && (
                        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-3 sm:p-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400" aria-hidden><ClipboardList className="size-5" /></span>
                            <div className="min-w-0 text-sm">
                                <p className="truncate font-semibold text-foreground">{selectedExam.subject_name} · {selectedExam.name}</p>
                                <p className="text-xs text-muted-foreground">Out of {selectedExam.max_score}</p>
                            </div>
                        </div>
                    )}

                    {selectedExamId && selectedExam && (
                        <ExamStatusBar
                            examId={selectedExam.id}
                            status={selectedExam.status || 'DRAFT'}
                            onChanged={() => fetchExams({ keepSelection: true })}
                        />
                    )}

                    {/* ── Tabs ── */}
                    <div role="tablist" aria-label="Results views" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/50 p-1 [scrollbar-width:none]">
                        {RESULT_TABS.map((tab, i) => {
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

                    {/* ── Tab Content ── */}
                    {loadingMarks ? (
                        <div className="card p-5">
                            <InlineLoadingSkeleton rows={6} />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'allsubjects' && (
                                <AllSubjectsView gradeStreamId={selectedStreamId} />
                            )}

                            {activeTab === 'results' && selectedExamId && (
                                <ExamResultsTable
                                    marks={marks}
                                    maxScore={selectedExam?.max_score || 100}
                                    examId={selectedExamId}
                                    gradeStreamId={selectedStreamId}
                                    scheme={markScheme}
                                    onRefresh={fetchMarks}
                                    onMarkPatched={(patched) => setMarks(prev => prev.map(m => m.id === patched.id ? patched : m))}
                                    markEntryLink={markEntryHref(selectedExam?.term_id, selectedExamId)}
                                />
                            )}
                            {activeTab === 'results' && !selectedExamId && (
                                <div className="card text-center py-16">
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Select an exam above to view individual results.</p>
                                </div>
                            )}

                            {activeTab === 'analysis' && selectedExamId && (
                                <ExamAnalysisPanel marks={marks} />
                            )}

                            {activeTab === 'quickentry' && selectedExamId && (
                                <QuickMarkEntry
                                    examId={selectedExamId}
                                    gradeStreamId={selectedStreamId}
                                    subjectId={selectedExam?.subject_id}
                                    onSaved={fetchMarks}
                                />
                            )}

                            {activeTab === 'reports' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                    {/* Year/Term Filters */}
                                    <div className="card p-5">
                                        <SectionTitle icon={Settings2} tone={0} title="Report settings" />
                                        <div className="flex flex-col md:flex-row" style={{ gap: 'var(--space-4)' }}>
                                            <div className="flex-1">
                                                <label className="block text-xs text-muted-foreground mb-2">Academic Year</label>
                                                <select className="input-field w-full" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
                                                    <option value="">-- Select Year --</option>
                                                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-muted-foreground mb-2">Term</label>
                                                <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} disabled={!selectedYearId}>
                                                    <option value="">-- Select Term --</option>
                                                    {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-muted-foreground mb-2">Exam</label>
                                                <select
                                                    className="input-field w-full"
                                                    value={selectedReportExamType}
                                                    onChange={e => setSelectedReportExamType(e.target.value)}
                                                    disabled={availableExamTypes.length === 0}
                                                >
                                                    <option value="">{availableExamTypes.length === 0 ? 'No exams for this term yet' : 'Most recent per subject'}</option>
                                                    {availableExamTypes.map(t => <option key={t} value={t}>{EXAM_TYPE_LABELS[t] || t}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-xs text-muted-foreground mb-2">Custom Report Title (Optional)</label>
                                            <input 
                                                className="input-field w-full" 
                                                placeholder="e.g. Mid Term 1 Report (Leave blank to use Term Name)"
                                                value={customReportTitle}
                                                onChange={e => setCustomReportTitle(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Individual Reports */}
                                    <div className="card p-5">
                                        <SectionTitle icon={Download} tone={1} title="Individual report cards (PDF)" />
                                        <p className="text-sm text-muted-foreground" style={{ marginBottom: 'var(--space-4)' }}>
                                            Click a student to download their PDF report card.
                                        </p>
                                        {classStudents.length === 0 ? (
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No students found in this class.</p>
                                        ) : (
                                            <div className="student-reports-grid">
                                                {classStudents.map(s => (
                                                    <button
                                                        key={s.id}
                                                        type="button"
                                                        className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                        onClick={() => handleDownloadReport(s.id)}
                                                        aria-label={`Download ${s.name}'s report card`}
                                                    >
                                                        <InitialsAvatar name={s.name} seed={s.id} />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-semibold">{s.name}</span>
                                                            <span className="block truncate text-[11px] text-muted-foreground">{s.admission_number}</span>
                                                        </span>
                                                        <FileText className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bulk Reports */}
                                    <div className="card p-5">
                                        <SectionTitle icon={Package} tone={2} title="Generate the whole class" />
                                        <p className="text-sm text-muted-foreground" style={{ marginBottom: 'var(--space-4)' }}>
                                            Generate report cards for all students in the selected class and term.
                                        </p>
                                        <button
                                            className="btn-primary disabled:opacity-50"
                                            onClick={handleBulkReports}
                                            disabled={reportGenerating || !selectedTermId}
                                        >
                                            {reportGenerating ? 'Generating…' : 'Generate All Reports'}
                                        </button>
                                        {reportMsg && (
                                            <div
                                                className={`mt-3 p-3 rounded-md text-sm ${reportMsg.type === 'success'
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30'
                                                    }`}
                                            >
                                                {reportMsg.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

const RESULT_TABS: readonly { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'allsubjects', label: 'All subjects', icon: LayoutGrid },
    { key: 'results', label: 'Single exam', icon: ClipboardList },
    { key: 'analysis', label: 'Analysis', icon: BarChart3 },
    { key: 'quickentry', label: 'Quick entry', icon: PencilLine },
    { key: 'reports', label: 'Reports', icon: FileText },
];

function SectionTitle({ icon: Icon, tone, title }: { icon: LucideIcon; tone: number; title: string }) {
    return (
        <h3 className="mb-3 flex items-center gap-2.5 text-sm font-semibold">
            <span className={cn('flex size-8 items-center justify-center rounded-lg', STEP_TONES[tone % STEP_TONES.length].tile)} aria-hidden><Icon className="size-4" /></span>
            {title}
        </h3>
    );
}
