"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
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
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { user } = useAuth();

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

    // ═══════════════════ Data fetching ═══════════════════

    // 1. Fetch all grade streams
    useEffect(() => {
        const fetchStreams = async () => {
            const { data } = await supabase
                .from('grade_streams')
                .select('id, full_name, grade_id')
                .order('grade_id')
                .order('name');
            setGradeStreams(data || []);
            setLoadingStreams(false);
        };
        fetchStreams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Fetch exams for selected stream
    useEffect(() => {
        if (!selectedStreamId) { setExams([]); setSelectedExamId(''); return; }

        const fetchExams = async () => {
            setLoadingExams(true);
            const stream = gradeStreams.find(s => s.id === selectedStreamId);
            if (!stream) { setLoadingExams(false); return; }

            const { data } = await supabase
                .from('exams')
                .select('id, name, exam_type, max_score, subjects:subject_id(name)')
                .or(`grade_stream_id.eq.${selectedStreamId},and(grade_id.eq.${stream.grade_id},grade_stream_id.is.null)`)
                .order('exam_date', { ascending: false });

            const mapped = (data || []).map((e: any) => ({
                id: e.id,
                name: e.name,
                exam_type: e.exam_type,
                max_score: e.max_score,
                subject_name: e.subjects?.name || 'N/A',
            }));
            setExams(mapped);
            setSelectedExamId(mapped[0]?.id || '');
            setLoadingExams(false);
        };
        fetchExams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStreamId]);

    // 3. Fetch marks for selected exam
    const fetchMarks = useCallback(async () => {
        if (!selectedExamId) { setMarks([]); return; }
        setLoadingMarks(true);

        const { data } = await supabase
            .from('exam_marks')
            .select('id, student_id, raw_score, percentage, grade_symbol, remarks, students!inner(admission_number, users(first_name, last_name))')
            .eq('exam_id', selectedExamId);

        const mapped: MarkRow[] = (data || []).map((m: any) => ({
            id: m.id,
            student_id: m.student_id,
            student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(),
            admission_number: m.students?.admission_number || '',
            raw_score: Number(m.raw_score),
            percentage: Number(m.percentage || 0),
            grade_symbol: m.grade_symbol || '-',
            remarks: m.remarks,
        }));

        setMarks(mapped);
        setLoadingMarks(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedExamId]);

    useEffect(() => { fetchMarks(); }, [fetchMarks]);

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

    const handleBulkReports = async () => {
        if (!selectedTermId || !selectedStreamId) {
            setReportMsg({ type: 'error', text: 'Select a term and class to generate bulk reports.' });
            return;
        }
        setReportGenerating(true);
        setReportMsg(null);

        const { error } = await supabase.rpc('generate_term_reports', {
            p_term_id: selectedTermId,
            p_grade_stream_id: selectedStreamId,
        });

        if (error) {
            setReportMsg({ type: 'error', text: `Failed: ${error.message}` });
        } else {
            setReportMsg({ type: 'success', text: 'Bulk reports generated successfully!' });
        }
        setReportGenerating(false);
    };

    // ═══════════════════ Current exam info ═══════════════════
    const selectedExam = exams.find(e => e.id === selectedExamId);

    // ═══════════════════ Render ═══════════════════
    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">
                    Exam Results
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Select a class and exam to view results, analyze performance, and generate reports
                </p>
            </div>

            {/* ── Cascading Filters ── */}
            <div
                className="card flex flex-col md:flex-row md:items-end"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}
            >
                {/* Class / Stream */}
                <div className="flex-1">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class / Stream</label>
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
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam</label>
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
                        <div className="mb-4 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                            <strong>Exam:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name} · <strong>Max Score:</strong> {selectedExam.max_score}
                        </div>
                    )}

                    {/* ── Tabs ── */}
                    <div
                        className="flex flex-wrap bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden"
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
                                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
                                    }`}
                                style={{ padding: 'var(--space-3) var(--space-4)' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Content ── */}
                    {loadingMarks ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading marks…</p>
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
                                    onRefresh={fetchMarks}
                                />
                            )}
                            {activeTab === 'results' && !selectedExamId && (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
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
                                    <div className="card" style={{ padding: 'var(--space-5)' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-4)' }}>Report Settings</h3>
                                        <div className="flex flex-col md:flex-row" style={{ gap: 'var(--space-4)' }}>
                                            <div className="flex-1">
                                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Year</label>
                                                <select className="input-field w-full" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
                                                    <option value="">-- Select Year --</option>
                                                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term</label>
                                                <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} disabled={!selectedYearId}>
                                                    <option value="">-- Select Term --</option>
                                                    {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Custom Report Title (Optional)</label>
                                            <input 
                                                className="input-field w-full" 
                                                placeholder="e.g. Mid Term 1 Report (Leave blank to use Term Name)"
                                                value={customReportTitle}
                                                onChange={e => setCustomReportTitle(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Individual Reports */}
                                    <div className="card" style={{ padding: 'var(--space-5)' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-2)' }}>📥 Individual Student Reports (PDF)</h3>
                                        <p className="text-sm text-[var(--color-text-muted)]" style={{ marginBottom: 'var(--space-4)' }}>
                                            Click a student to download their PDF report card.
                                        </p>
                                        {marks.length === 0 ? (
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No students with marks to generate reports for.</p>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                                                {marks.map(m => (
                                                    <button
                                                        key={m.student_id}
                                                        className="btn-secondary text-left"
                                                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', fontSize: 13 }}
                                                        onClick={() => handleDownloadReport(m.student_id)}
                                                    >
                                                        <span style={{ fontSize: 18 }}>📄</span>
                                                        <span>
                                                            <strong>{m.student_name}</strong>
                                                            <br />
                                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.admission_number}</span>
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bulk Reports */}
                                    <div className="card" style={{ padding: 'var(--space-5)' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-2)' }}>📦 Bulk Report Generation</h3>
                                        <p className="text-sm text-[var(--color-text-muted)]" style={{ marginBottom: 'var(--space-4)' }}>
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
