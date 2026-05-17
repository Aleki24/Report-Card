"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExamResultsTable, type MarkRow } from '@/components/exam-results/ExamResultsTable';
import { ExamAnalysisPanel } from '@/components/exam-results/ExamAnalysisPanel';
import { QuickMarkEntry } from '@/components/exam-results/QuickMarkEntry';
import { AllSubjectsView } from '@/components/exam-results/AllSubjectsView';

interface GradeStreamOption { id: string; full_name: string; grade_id: string; }
interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_name: string; }
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; academic_year_id: string; }

type Tab = 'allsubjects' | 'results' | 'analysis' | 'quickentry' | 'reports';

export default function ExamResultsPage() {
    const { user, profile } = useAuth();

    // ----- Cascading filters -----
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [selectedStreamId, setSelectedStreamId] = useState('');
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loadingStreams, setLoadingStreams] = useState(true);
    const [loadingExams, setLoadingExams] = useState(false);

    // ----- Tab + Data -----
    const [activeTab, setActiveTab] = useState<Tab>('allsubjects');
    const [marks, setMarks] = useState<MarkRow[]>([]);
    const [loadingMarks, setLoadingMarks] = useState(false);

    // ----- Reports tab -----
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [allTerms, setAllTerms] = useState<Term[]>([]);
    const [selectedYearId, setSelectedYearId] = useState('');
    const [selectedTermId, setSelectedTermId] = useState('');
    const [reportGenerating, setReportGenerating] = useState(false);
    const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [customReportTitle, setCustomReportTitle] = useState('');
    const [classStudents, setClassStudents] = useState<{ id: string; name: string; admission_number: string }[]>([]);

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
    useEffect(() => {
        if (!selectedStreamId) { setExams([]); setSelectedExamId(''); return; }

        const fetchExams = async () => {
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
                    }));
                    setExams(mapped);
                    setSelectedExamId(mapped[0]?.id || '');
                } else {
                    setExams([]);
                    setSelectedExamId('');
                }
            } catch (err) {
                console.error('Failed to fetch exams:', err);
                setExams([]);
                setSelectedExamId('');
            } finally {
                setLoadingExams(false);
            }
        };
        fetchExams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStreamId]);

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
                }));
                setMarks(mapped);
            } else {
                setMarks([]);
            }
        } catch (err) {
            console.error('Failed to fetch marks:', err);
            setMarks([]);
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
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">
                    Exam Results
                </h1>
                <p className="text-[11px] xs:text-[12px] text-muted-foreground leading-relaxed">
                    Select a class and exam to view results, analyze performance, and generate reports
                </p>
            </div>

            {/* ── Cascading Filters ── */}
            <div
                className="card flex flex-col md:flex-row md:items-end gap-4 mb-6 p-5"
            >
                {/* Class / Stream */}
                <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">Class / Stream</label>
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
                    <label className="block text-xs text-muted-foreground mb-1">Exam</label>
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

            {/* Show content when stream is selected */}
            {selectedStreamId && (
                <>
                    {/* Selected Exam Info (only if a specific exam is selected) */}
                    {selectedExamId && selectedExam && (
                        <div className="mb-4 p-3 rounded-md text-sm bg-muted border border-border">
                            <strong>Exam:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name} · <strong>Max Score:</strong> {selectedExam.max_score}
                        </div>
                    )}

                    {/* ── Tabs ── */}
                    <div
                        className="flex flex-wrap bg-card border border-border rounded-md overflow-hidden"
                        style={{ marginBottom: 'var(--space-6)' }}
                    >
                        {([
                            { key: 'allsubjects', label: '📊 All Subjects' },
                            { key: 'results', label: '📋 Single Exam' },
                            { key: 'analysis', label: '📈 Analysis' },
                            { key: 'quickentry', label: '✏️ Quick Entry' },
                            { key: 'reports', label: '📄 Reports' },
                        ] as { key: Tab; label: string }[]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${activeTab === tab.key
                                    ? 'bg-[var(--color-accent)] text-white'
                                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                                    }`}
                                style={{ padding: 'var(--space-3) var(--space-4)' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Content ── */}
                    {loadingMarks ? (
                        <div className="card">
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
                                    onRefresh={fetchMarks}
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
                                    onSaved={fetchMarks}
                                />
                            )}

                            {activeTab === 'reports' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                                    {/* Year/Term Filters */}
                                    <div className="card p-5">
                                        <h3 className="text-sm font-semibold mb-4">Report Settings</h3>
                                        <div className="flex flex-col md:flex-row" style={{ gap: 'var(--space-4)' }}>
                                            <div className="flex-1">
                                                <label className="block text-xs text-muted-foreground mb-1">Academic Year</label>
                                                <select className="input-field w-full" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
                                                    <option value="">-- Select Year --</option>
                                                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-muted-foreground mb-1">Term</label>
                                                <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} disabled={!selectedYearId}>
                                                    <option value="">-- Select Term --</option>
                                                    {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-xs text-muted-foreground mb-1">Custom Report Title (Optional)</label>
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
                                        <h3 className="text-sm font-semibold mb-2">📥 Individual Student Reports (PDF)</h3>
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
                                                        className="btn-secondary text-left"
                                                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', fontSize: 13 }}
                                                        onClick={() => handleDownloadReport(s.id)}
                                                    >
                                                        <span style={{ fontSize: 18 }}>📄</span>
                                                        <span>
                                                            <strong>{s.name}</strong>
                                                            <br />
                                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.admission_number}</span>
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bulk Reports */}
                                    <div className="card p-5">
                                        <h3 className="text-sm font-semibold mb-2">📦 Bulk Report Generation</h3>
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
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
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
