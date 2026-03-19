"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

interface ExamOption {
    id: string;
    name: string;
    exam_type: string;
    max_score: number;
    subjects: { name: string } | null;
    grades: { name_display: string } | null;
}

interface DropdownItem { id: string; name: string; }
interface GradeItem { id: string; name_display: string; code: string; academic_level_id: string; }
interface TermItem { id: string; name: string; academic_year_id: string; }
interface StreamItem { id: string; name: string; full_name: string; grade_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; }

const EXAM_TYPES = ['CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER'];

export default function MarksPage() {
    const supabase = createSupabaseBrowserClient();
    const { user } = useAuth();

    // Existing exam list state
    const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form fields
    const [examName, setExamName] = useState('');
    const [examType, setExamType] = useState('MIDTERM');
    const [maxScore, setMaxScore] = useState(100);
    const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [selectedTermId, setSelectedTermId] = useState('');
    const [selectedGradeId, setSelectedGradeId] = useState('');
    const [selectedStreamId, setSelectedStreamId] = useState('');

    // Dropdown data
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [academicYears, setAcademicYears] = useState<DropdownItem[]>([]);
    const [allTerms, setAllTerms] = useState<TermItem[]>([]);
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [allStreams, setAllStreams] = useState<StreamItem[]>([]);
    const [dropdownsLoading, setDropdownsLoading] = useState(false);

    // Fetch exams
    const fetchExams = useCallback(async () => {
        const { data, error } = await supabase
            .from('exams')
            .select('id, name, exam_type, max_score, subjects:subject_id(name), grades:grade_id(name_display)')
            .order('exam_date', { ascending: false });

        if (error) console.error('Error fetching exams:', error);

        if (data && data.length > 0) {
            setExams(data as unknown as ExamOption[]);
            if (!selectedExamId || !data.find(e => e.id === selectedExamId)) {
                setSelectedExamId(data[0].id);
            }
        } else {
            setExams([]);
        }
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchExams(); }, [fetchExams]);

    // Fetch dropdown data when modal opens
    useEffect(() => {
        if (!showCreateModal) return;
        const fetchDropdowns = async () => {
            setDropdownsLoading(true);
            const [subjectsRes, yearsRes, termsRes, gradesRes, streamsRes] = await Promise.all([
                supabase.from('subjects').select('id, name, code, academic_level_id').order('display_order'),
                supabase.from('academic_years').select('id, name').order('start_date', { ascending: false }),
                supabase.from('terms').select('id, name, academic_year_id').order('start_date'),
                supabase.from('grades').select('id, name_display, code, academic_level_id').order('numeric_order'),
                supabase.from('grade_streams').select('id, name, full_name, grade_id').order('name'),
            ]);
            if (subjectsRes.data) setSubjects(subjectsRes.data);
            if (yearsRes.data) {
                setAcademicYears(yearsRes.data);
                if (yearsRes.data.length > 0 && !selectedAcademicYearId) setSelectedAcademicYearId(yearsRes.data[0].id);
            }
            if (termsRes.data) setAllTerms(termsRes.data);
            if (gradesRes.data) setGrades(gradesRes.data);
            if (streamsRes.data) setAllStreams(streamsRes.data);
            setDropdownsLoading(false);
        };
        fetchDropdowns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCreateModal]);

    // Filter terms by selected year, streams by selected grade
    const filteredTerms = allTerms.filter(t => t.academic_year_id === selectedAcademicYearId);
    const filteredStreams = allStreams.filter(s => s.grade_id === selectedGradeId);

    // Reset dependent fields on parent change
    useEffect(() => { setSelectedTermId(''); }, [selectedAcademicYearId]);
    useEffect(() => { setSelectedStreamId(''); }, [selectedGradeId]);

    // Handle exam creation
    const handleCreateExam = async () => {
        setSaveMessage(null);
        if (!examName.trim()) return setSaveMessage({ type: 'error', text: 'Exam name is required.' });
        if (!selectedSubjectId) return setSaveMessage({ type: 'error', text: 'Please select a subject.' });
        if (!selectedAcademicYearId) return setSaveMessage({ type: 'error', text: 'Please select an academic year.' });
        if (!selectedTermId) return setSaveMessage({ type: 'error', text: 'Please select a term.' });
        if (!selectedGradeId) return setSaveMessage({ type: 'error', text: 'Please select a grade.' });
        if (!examDate) return setSaveMessage({ type: 'error', text: 'Please set an exam date.' });
        if (maxScore <= 0) return setSaveMessage({ type: 'error', text: 'Max score must be greater than 0.' });

        setCreating(true);

        const insertPayload: Record<string, unknown> = {
            name: examName.trim(),
            exam_type: examType,
            subject_id: selectedSubjectId,
            academic_year_id: selectedAcademicYearId,
            term_id: selectedTermId,
            grade_id: selectedGradeId,
            max_score: maxScore,
            exam_date: examDate,
            created_by_teacher_id: user?.id || null,
        };
        if (selectedStreamId) insertPayload.grade_stream_id = selectedStreamId;

        const { data, error } = await supabase.from('exams').insert(insertPayload).select('id').single();

        if (error) {
            setSaveMessage({ type: 'error', text: `Failed to create exam: ${error.message}` });
            setCreating(false);
            return;
        }

        setSaveMessage({ type: 'success', text: 'Exam created successfully!' });
        setCreating(false);

        // Reset form
        setExamName(''); setExamType('MIDTERM'); setMaxScore(100);
        setExamDate(new Date().toISOString().split('T')[0]);
        setSelectedSubjectId(''); setSelectedTermId(''); setSelectedGradeId(''); setSelectedStreamId('');

        // Refresh + select new exam
        if (data?.id) setSelectedExamId(data.id);
        await fetchExams();
        if (data?.id) setSelectedExamId(data.id);

        setTimeout(() => { setShowCreateModal(false); setSaveMessage(null); }, 1200);
    };

    const selectedExam = exams.find(e => e.id === selectedExamId);

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div
                className="flex flex-col sm:flex-row sm:justify-between sm:items-start"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Mark Entry</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Upload marks in bulk or enter them manually for each exam
                    </p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => setShowCreateModal(true)}>+ Create Exam</button>
            </div>

            {/* Controls Bar */}
            <div
                className="flex flex-col md:flex-row md:justify-between md:items-center"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}
            >
                {/* Mode Toggle */}
                <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden w-full md:w-auto basis-full md:basis-auto">
                    <button
                        onClick={() => setMode('bulk')}
                        className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'bulk'
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
                            }`}
                        style={{ padding: 'var(--space-4) var(--space-6)' }}
                    >
                        📄 Bulk Upload
                    </button>
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'manual'
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
                            }`}
                        style={{ padding: 'var(--space-4) var(--space-6)' }}
                    >
                        ✏️ Manual Entry
                    </button>
                </div>

                {/* Exam Selector */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Exam:</label>
                    <select
                        className="input-field flex-1 md:w-64"
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                        disabled={loading || exams.length === 0}
                    >
                        {loading ? (
                            <option value="">Loading...</option>
                        ) : exams.length === 0 ? (
                            <option value="">No exams — click &quot;+ Create Exam&quot;</option>
                        ) : (
                            exams.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {exam.name} — {exam.subjects?.name || 'N/A'} ({exam.grades?.name_display || 'N/A'})
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Selected Exam Info */}
            {selectedExam && (
                <div className="mb-6 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                    <strong>Selected:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subjects?.name || 'N/A'} · <strong>Grade:</strong> {selectedExam.grades?.name_display || 'N/A'} · <strong>Max Score:</strong> {selectedExam.max_score}
                </div>
            )}

            {/* Content */}
            <div className="w-full">
                {mode === 'bulk'
                    ? <BulkUpload examId={selectedExamId} />
                    : <ManualEntryGrid examId={selectedExamId} maxScore={selectedExam?.max_score || 100} />
                }
            </div>

            {/* ── Create Exam Modal ──────────────────────── */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setShowCreateModal(false); setSaveMessage(null); }}
                >
                    <div
                        className="card w-full max-w-lg"
                        style={{ animation: 'fadeIn .2s ease' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Create New Exam</h2>

                        {dropdownsLoading ? (
                            <div className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading form data…</div>
                        ) : (
                            <div className="flex flex-col gap-4 mb-6">
                                {/* Row: Name + Type */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Name *</label>
                                        <input
                                            className="input-field w-full"
                                            placeholder="e.g. End of Term 1 Maths"
                                            value={examName}
                                            onChange={e => setExamName(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Type *</label>
                                        <select className="input-field w-full" value={examType} onChange={e => setExamType(e.target.value)}>
                                            {EXAM_TYPES.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Subject */}
                                <div>
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Subject *</label>
                                    {subjects.length === 0 ? (
                                        <p className="text-xs text-orange-400">No subjects found. Add subjects in Settings first.</p>
                                    ) : (
                                        <select className="input-field w-full" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                                            <option value="">-- Select Subject --</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Row: Academic Year + Term */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Year *</label>
                                        {academicYears.length === 0 ? (
                                            <p className="text-xs text-orange-400">No academic years found.</p>
                                        ) : (
                                            <select className="input-field w-full" value={selectedAcademicYearId} onChange={e => setSelectedAcademicYearId(e.target.value)}>
                                                <option value="">-- Select Year --</option>
                                                {academicYears.map(y => (
                                                    <option key={y.id} value={y.id}>{y.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term *</label>
                                        {!selectedAcademicYearId ? (
                                            <p className="text-xs text-[var(--color-text-muted)]">Select a year first.</p>
                                        ) : filteredTerms.length === 0 ? (
                                            <p className="text-xs text-orange-400">No terms for this year.</p>
                                        ) : (
                                            <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
                                                <option value="">-- Select Term --</option>
                                                {filteredTerms.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Row: Grade + Stream */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade *</label>
                                        {grades.length === 0 ? (
                                            <p className="text-xs text-orange-400">No grades found.</p>
                                        ) : (
                                            <select className="input-field w-full" value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)}>
                                                <option value="">-- Select Grade --</option>
                                                {grades.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name_display}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Stream (optional)</label>
                                        {!selectedGradeId ? (
                                            <p className="text-xs text-[var(--color-text-muted)]">Select a grade first.</p>
                                        ) : filteredStreams.length === 0 ? (
                                            <select className="input-field w-full" disabled>
                                                <option>No streams for this grade</option>
                                            </select>
                                        ) : (
                                            <select className="input-field w-full" value={selectedStreamId} onChange={e => setSelectedStreamId(e.target.value)}>
                                                <option value="">-- All Streams --</option>
                                                {filteredStreams.map(s => (
                                                    <option key={s.id} value={s.id}>{s.full_name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Row: Max Score + Date */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Max Score *</label>
                                        <input
                                            type="number"
                                            className="input-field w-full"
                                            min={1} max={1000}
                                            value={maxScore}
                                            onChange={e => setMaxScore(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Date *</label>
                                        <input
                                            type="date"
                                            className="input-field w-full"
                                            value={examDate}
                                            onChange={e => setExamDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Feedback */}
                        {saveMessage && (
                            <div
                                className={`mb-4 p-3 rounded-md text-sm ${saveMessage.type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                    }`}
                            >
                                {saveMessage.text}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn-secondary"
                                onClick={() => { setShowCreateModal(false); setSaveMessage(null); }}
                                disabled={creating}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary disabled:opacity-50"
                                onClick={handleCreateExam}
                                disabled={creating || dropdownsLoading}
                            >
                                {creating ? 'Creating...' : 'Create Exam'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
