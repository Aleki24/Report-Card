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
    subject_id: string;
    subject_name: string;
    grade_id: string;
    grade_name: string;
}

interface DropdownItem { id: string; name: string; }
interface GradeItem { id: string; name_display: string; code: string; academic_level_id: string; }
interface TermItem { id: string; name: string; academic_year_id: string; }
interface StreamItem { id: string; name: string; full_name: string; grade_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; category?: string; }
interface MySubject { id: string; code: string; name: string; academic_level_id: string; category?: string; exams?: ExamOption[]; }

const EXAM_TYPES = ['CBC', '844', 'MIDTERM', 'ENDTERM', 'END TERM', 'OPENER'];

export default function MarksPage() {
    const supabase = createSupabaseBrowserClient();
    const { user, profile, availableRoles } = useAuth();
    const isAlsoClassTeacher = profile?.role === 'SUBJECT_TEACHER' && availableRoles.includes('CLASS_TEACHER');

    // Existing exam list state
    const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loading, setLoading] = useState(true);

    // Exam filters
    const [filterGradeId, setFilterGradeId] = useState('');
    const [filterSubjectId, setFilterSubjectId] = useState('');
    const [filterExamType, setFilterExamType] = useState('');

    // Subject teacher view state
    const [mySubjects, setMySubjects] = useState<MySubject[]>([]);
    const [loadingMySubjects, setLoadingMySubjects] = useState(false);


    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
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
    const [academicLevels, setAcademicLevels] = useState<DropdownItem[]>([]);
    const [dropdownsLoading, setDropdownsLoading] = useState(false);

    // Inline quick-add state
    const [addingSubject, setAddingSubject] = useState(false);
    const [addingYear, setAddingYear] = useState(false);
    const [addingTerm, setAddingTerm] = useState(false);
    const [addingStream, setAddingStream] = useState(false);
    const [quickSaving, setQuickSaving] = useState(false);
    const [quickMsg, setQuickMsg] = useState('');
    const [qYear, setQYear] = useState({ name: '', start_date: '', end_date: '' });
    const [qTerm, setQTerm] = useState({ name: '', start_date: '', end_date: '' });
    const [qStream, setQStream] = useState({ name: '' });
    const [qSubject, setQSubject] = useState({ name: '', code: '', academic_level_id: '', grading_system_id: '' });
    const [gradingSystems, setGradingSystems] = useState<{ id: string; name: string; academic_level_id: string }[]>([]);

    // Fetch exams
    const fetchExams = useCallback(async () => {
        try {
            const res = await fetch('/api/school/exams');
            if (res.ok) {
                const json = await res.json();
                const examList = json?.data || [];
                if (examList.length > 0) {
                    setExams(examList as ExamOption[]);
                    if (!selectedExamId || !examList.find((e: any) => e.id === selectedExamId)) {
                        setSelectedExamId(examList[0].id);
                    }
                } else {
                    setExams([]);
                }
            } else {
                console.error('Failed to fetch exams');
                setExams([]);
            }
        } catch (error) {
            console.error('Error fetching exams:', error);
            setExams([]);
        }
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchExams(); }, [fetchExams]);

    // Fetch dropdown data for filters on page load
    const fetchFilterDropdowns = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/academic-structure');
            const data = await res.json();
            if (res.ok) {
                if (data.subjects) setSubjects(data.subjects);
                if (data.grades) setGrades(data.grades);
            }
        } catch (err) {
            console.error('Error fetching filter dropdowns:', err);
        }
    }, []);

    useEffect(() => { fetchFilterDropdowns(); }, [fetchFilterDropdowns]);

    // Fetch subject teacher's assigned subjects
    const fetchMySubjects = useCallback(async () => {
        setLoadingMySubjects(true);
        try {
            const res = await fetch('/api/school/data?type=my_subjects');
            if (res.ok) {
                const json = await res.json();
                const subjectList = json?.data || [];
                
                // Fetch exams for each subject
                const subjectsWithExams = await Promise.all(
                    subjectList.map(async (subject: MySubject) => {
                        const examRes = await fetch('/api/school/exams');
                        if (examRes.ok) {
                            const examJson = await examRes.json();
                            const subjectExams = (examJson?.data || []).filter((e: any) => e.subject_id === subject.id);
                            return { ...subject, exams: subjectExams };
                        }
                        return { ...subject, exams: [] };
                    })
                );
                setMySubjects(subjectsWithExams);
            } else {
                setMySubjects([]);
            }
        } catch (error) {
            console.error('Error fetching my subjects:', error);
            setMySubjects([]);
        }
        setLoadingMySubjects(false);
    }, []);

    useEffect(() => { 
        if (profile?.role === 'SUBJECT_TEACHER') {
            fetchMySubjects(); 
        }
    }, [profile?.role, fetchMySubjects]);

    // Fetch dropdown data when modal opens — via server API to bypass RLS
    const fetchDropdowns = useCallback(async () => {
        setDropdownsLoading(true);
        try {
            const res = await fetch('/api/admin/academic-structure');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load form data');

            if (data.subjects) setSubjects(data.subjects);
            if (data.academic_levels) setAcademicLevels(data.academic_levels);
            if (data.academic_years) {
                setAcademicYears(data.academic_years);
                if (data.academic_years.length > 0 && !selectedAcademicYearId) {
                    setSelectedAcademicYearId(data.academic_years[0].id);
                }
            }
            if (data.terms) setAllTerms(data.terms);
            if (data.grades) setGrades(data.grades);
            if (data.grade_streams) setAllStreams(data.grade_streams);
            if (data.grading_systems) setGradingSystems(data.grading_systems);
        } catch (err) {
            console.error('Error fetching dropdown data:', err);
        }
        setDropdownsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAcademicYearId]);

    useEffect(() => {
        if (showCreateModal) fetchDropdowns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCreateModal]);

    // Filter terms by selected year, streams by selected grade
    const filteredTerms = allTerms.filter(t => t.academic_year_id === selectedAcademicYearId);
    const filteredStreams = allStreams.filter(s => s.grade_id === selectedGradeId);

    // Reset dependent fields on parent change
    useEffect(() => { setSelectedTermId(''); }, [selectedAcademicYearId]);
    useEffect(() => { setSelectedStreamId(''); }, [selectedGradeId]);

    // Quick-add helper
    const quickAdd = async (type: string, payload: Record<string, unknown>) => {
        setQuickSaving(true);
        setQuickMsg('');
        try {
            const res = await fetch('/api/admin/academic-structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, user_id: profile?.id, ...payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setQuickMsg(`✅ Added!`);
            await fetchDropdowns(); // refresh dropdowns
            setTimeout(() => setQuickMsg(''), 2000);
            return data.data;
        } catch (err) {
            setQuickMsg(`❌ ${err instanceof Error ? err.message : 'Failed'}`);
            return null;
        } finally {
            setQuickSaving(false);
        }
    };

    const handleQuickAddYear = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qYear.name.trim() || !qYear.start_date || !qYear.end_date) return;
        const result = await quickAdd('academic_year', qYear);
        if (result) {
            setSelectedAcademicYearId(result.id);
            setQYear({ name: '', start_date: '', end_date: '' });
            setAddingYear(false);
        }
    };

    const handleQuickAddTerm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAcademicYearId || !qTerm.name.trim() || !qTerm.start_date || !qTerm.end_date) return;
        const result = await quickAdd('term', { academic_year_id: selectedAcademicYearId, ...qTerm });
        if (result) {
            setSelectedTermId(result.id);
            setQTerm({ name: '', start_date: '', end_date: '' });
            setAddingTerm(false);
        }
    };

    const handleQuickAddStream = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradeId || !qStream.name.trim()) return;
        const grade = grades.find(g => g.id === selectedGradeId);
        const fullName = `${grade?.name_display || ''} ${qStream.name.trim()}`.trim();
        const result = await quickAdd('stream', { grade_id: selectedGradeId, name: qStream.name.trim(), full_name: fullName });
        if (result) {
            setSelectedStreamId(result.id);
            setQStream({ name: '' });
            setAddingStream(false);
        }
    };

    const handleQuickAddSubject = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        if (!qSubject.name.trim() || !qSubject.code.trim() || !qSubject.academic_level_id) return;
        const result = await quickAdd('subject', qSubject);
        if (result) {
            setSelectedSubjectId(result.id);
            setQSubject({ name: '', code: '', academic_level_id: '', grading_system_id: '' });
            setAddingSubject(false);
        }
    };

    // Handle exam creation
    const handleCreateExam = async (overrideSubjectId?: string) => {
        const effectiveSubjectId = overrideSubjectId || selectedSubjectId;
        setSaveMessage(null);
        if (!examName.trim()) return setSaveMessage({ type: 'error', text: 'Exam name is required.' });
        if (!effectiveSubjectId) return setSaveMessage({ type: 'error', text: 'Please select a subject.' });
        if (!selectedAcademicYearId) return setSaveMessage({ type: 'error', text: 'Please select an academic year.' });
        if (!selectedTermId) return setSaveMessage({ type: 'error', text: 'Please select a term.' });
        if (!selectedGradeId) return setSaveMessage({ type: 'error', text: 'Please select a grade.' });
        if (!examDate) return setSaveMessage({ type: 'error', text: 'Please set an exam date.' });
        if (maxScore <= 0) return setSaveMessage({ type: 'error', text: 'Max score must be greater than 0.' });

        setCreating(true);

        const insertPayload: Record<string, unknown> = {
            name: examName.trim(),
            exam_type: examType,
            subject_id: effectiveSubjectId,
            academic_year_id: selectedAcademicYearId,
            term_id: selectedTermId,
            grade_id: selectedGradeId,
            max_score: maxScore,
            exam_date: examDate,
            created_by_teacher_id: user?.id || null,
        };
        if (selectedStreamId) insertPayload.grade_stream_id = selectedStreamId;

        const res = await fetch('/api/school/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(insertPayload),
        });

        if (!res.ok) {
            const errData = await res.json();
            setSaveMessage({ type: 'error', text: `Failed to create exam: ${errData.error || 'Unknown error'}` });
            setCreating(false);
            return;
        }

        const respData = await res.json();
        const newExamId = respData?.data?.id;

        setSaveMessage({ type: 'success', text: 'Exam created successfully!' });
        setCreating(false);

        // Reset form
        setExamName(''); setExamType('MIDTERM'); setMaxScore(100);
        setExamDate(new Date().toISOString().split('T')[0]);
        setSelectedSubjectId(''); setSelectedTermId(''); setSelectedGradeId(''); setSelectedStreamId('');

        // Refresh + select new exam
        if (newExamId) setSelectedExamId(newExamId);
        await fetchExams();
        if (profile?.role === 'SUBJECT_TEACHER') await fetchMySubjects();
        if (newExamId) setSelectedExamId(newExamId);

        setTimeout(() => { setShowCreateModal(false); setSaveMessage(null); }, 1200);
    };

    const handleDeleteExam = async (examId: string) => {
        if (!confirm('Are you sure you want to delete this exam? This action cannot be undone and all associated marks will be lost.')) return;
        
        try {
            setDeletingExamId(examId);
            const res = await fetch(`/api/school/exams/${examId}`, {
                method: 'DELETE',
            });
            
            if (res.ok) {
                setExams(prev => prev.filter(e => e.id !== examId));
                if (selectedExamId === examId) {
                    const remaining = exams.filter(e => e.id !== examId);
                    setSelectedExamId(remaining.length > 0 ? remaining[0].id : '');
                }
            } else {
                const data = await res.json();
                alert(`Failed to delete exam: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error deleting exam:', err);
            alert('An error occurred while deleting the exam.');
        } finally {
            setDeletingExamId(null);
        }
    };

    const selectedExam = exams.find(e => e.id === selectedExamId);

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div
                className="flex flex-col sm:flex-row sm:justify-between sm:items-start"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Mark Entry</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Upload marks in bulk or enter them manually for each exam
                    </p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => setShowCreateModal(true)}>+ Create Exam</button>
            </div>

            {/* Dual-role navigation banner */}
            {isAlsoClassTeacher && (
                <a
                    href="/dashboard/reports"
                    className="mb-6 flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.01]"
                    style={{
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))',
                        border: '1px solid rgba(139,92,246,0.25)',
                        textDecoration: 'none',
                        color: 'inherit',
                    }}
                >
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div style={{ flex: 1 }}>
                        <span className="font-semibold text-sm" style={{ color: 'rgb(167,139,250)' }}>Go to My Class</span>
                        <span className="text-xs block" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                            Switch to your class teacher dashboard to generate reports &amp; manage students
                        </span>
                    </div>
                    <span style={{ fontSize: 18, opacity: 0.6 }}>→</span>
                </a>
            )}

            {/* Guide */}
            <div className="my-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-8 rounded-xl flex items-start gap-5 leading-relaxed tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <div className="text-sm">
                    <h3 className="font-semibold mb-2 text-base">How to enter marks:</h3>
                    <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                        <li><strong>Step 1:</strong> Click <strong>+ Create Exam</strong> if you haven&apos;t created one yet.</li>
                        <li><strong>Step 2:</strong> Select the exam from the dropdown below.</li>
                        <li><strong>Step 3:</strong> Choose either <strong>Bulk Upload</strong> (via CSV) or <strong>Manual Entry</strong> (direct grid input).</li>
                    </ul>
                </div>
            </div>

            {/* Subject Teacher View - My Subjects */}
            {profile?.role === 'SUBJECT_TEACHER' && (
                <div className="mb-6">
                    <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">My Subjects</h2>
                    {loadingMySubjects ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                            <p style={{ color: 'var(--color-text-muted)' }}>Loading your subjects...</p>
                        </div>
                    ) : mySubjects.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                            <p style={{ color: 'var(--color-text-muted)' }}>No subjects assigned to you. Contact administrator.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                            {mySubjects.map(subject => (
                                <div key={subject.id} className="card" style={{ padding: 'var(--space-5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                                        <div>
                                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                                                {subject.name}
                                            </h3>
                                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                                {subject.code}
                                            </span>
                                            {subject.category && (
                                                <span style={{ 
                                                    display: 'inline-block', 
                                                    marginLeft: 8, 
                                                    fontSize: 10, 
                                                    padding: '2px 6px', 
                                                    background: 'var(--color-surface-raised)', 
                                                    borderRadius: 4 
                                                }}>
                                                    {subject.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Existing Exams */}
                                    <div style={{ marginBottom: 'var(--space-3)' }}>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                                            Exams ({subject.exams?.length || 0})
                                        </p>
                                        {subject.exams && subject.exams.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                {subject.exams.slice(0, 3).map(exam => (
                                                    <div 
                                                        key={exam.id}
                                                        style={{ 
                                                            display: 'flex', 
                                                            justifyContent: 'space-between', 
                                                            alignItems: 'center',
                                                            padding: 'var(--space-2) var(--space-3)',
                                                            background: selectedExamId === exam.id ? 'var(--color-accent-transparent)' : 'var(--color-surface-raised)',
                                                            borderRadius: 6,
                                                            border: selectedExamId === exam.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => setSelectedExamId(exam.id)}
                                                    >
                                                        <div>
                                                            <span style={{ fontSize: 13, fontWeight: 500 }}>{exam.name}</span>
                                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{exam.exam_type}</span>
                                                        </div>
                                                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Max: {exam.max_score}</span>
                                                    </div>
                                                ))}
                                                {subject.exams.length > 3 && (
                                                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                                        +{subject.exams.length - 3} more exams
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                                No exams created yet
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button 
                                            className="btn-primary flex-1"
                                            style={{ fontSize: 12, padding: 'var(--space-2) var(--space-3)' }}
                                            onClick={() => {
                                                setSelectedSubjectId(subject.id);
                                                setShowCreateModal(true);
                                            }}
                                        >
                                            + New Exam
                                        </button>
                                        {subject.exams && subject.exams.length > 0 && (
                                            <button 
                                                className="btn-secondary"
                                                style={{ fontSize: 12, padding: 'var(--space-2) var(--space-3)' }}
                                                onClick={() => setSelectedExamId(subject.exams![0].id)}
                                            >
                                                View Marks
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                    <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Filter:</label>
                    <select
                        className="input-field w-32"
                        value={filterGradeId}
                        onChange={(e) => { setFilterGradeId(e.target.value); setSelectedExamId(''); }}
                    >
                        <option value="">All Grades</option>
                        {grades.map(g => (
                            <option key={g.id} value={g.id}>{g.name_display}</option>
                        ))}
                    </select>
                    <select
                        className="input-field w-32"
                        value={filterSubjectId}
                        onChange={(e) => { setFilterSubjectId(e.target.value); setSelectedExamId(''); }}
                    >
                        <option value="">All Subjects</option>
                        {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <select
                        className="input-field w-28"
                        value={filterExamType}
                        onChange={(e) => { setFilterExamType(e.target.value); setSelectedExamId(''); }}
                    >
                        <option value="">All Types</option>
                        {EXAM_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

                {/* Filtered exams for selection */}
                {(() => {
                    const filteredExams = exams.filter(e => {
                        if (filterGradeId && e.grade_id !== filterGradeId) return false;
                        if (filterSubjectId && e.subject_id !== filterSubjectId) return false;
                        if (filterExamType && e.exam_type !== filterExamType) return false;
                        return true;
                    });

                    return (
                    <div className="flex items-center gap-3 w-full md:w-auto mb-4">
                        <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Exam:</label>
                        <select
                            className="input-field flex-1 md:w-64"
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            disabled={loading || filteredExams.length === 0}
                        >
                            {loading ? (
                                <option value="">Loading...</option>
                            ) : filteredExams.length === 0 ? (
                                <option value="">No matching exams</option>
                            ) : (
                                filteredExams.map(exam => (
                                    <option key={exam.id} value={exam.id}>
                                        {exam.name} — {exam.subject_name || 'N/A'} ({exam.grade_name || 'N/A'})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                );
            })()}

            {/* Selected Exam Info */}
            {selectedExam && (
                <div className="mb-6 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between items-center flex-wrap gap-2">
                    <div>
                        <strong>Selected:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name || 'N/A'} · <strong>Grade:</strong> {selectedExam.grade_name || 'N/A'} · <strong>Max Score:</strong> {selectedExam.max_score}
                    </div>
                    {profile?.role === 'ADMIN' && (
                        <button 
                            onClick={() => handleDeleteExam(selectedExam.id)}
                            disabled={deletingExamId === selectedExam.id}
                            className="text-xs px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                            {deletingExamId === selectedExam.id ? 'Deleting...' : 'Delete Exam'}
                        </button>
                    )}
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
                        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        style={{ animation: 'fadeIn .2s ease' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Create New Exam</h2>

                        {/* Quick-add feedback */}
                        {quickMsg && (
                            <div className={`mb-4 p-2 rounded text-xs ${quickMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {quickMsg}
                            </div>
                        )}

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
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs text-[var(--color-text-muted)]">Subject *</label>
                                        {/* Show quick-add only when subject is NOT pre-selected */}
                                        {!selectedSubjectId && (
                                            <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingSubject(!addingSubject)}>
                                                {addingSubject ? '✕ Cancel' : '+ Add'}
                                            </button>
                                        )}
                                    </div>

                                    {/* If subject is pre-selected (e.g. from subject teacher card), show read-only */}
                                    {selectedSubjectId && subjects.find(s => s.id === selectedSubjectId) ? (
                                        <div className="flex items-center gap-2">
                                            <div className="input-field w-full bg-[var(--color-surface-raised)] cursor-not-allowed opacity-80">
                                                {subjects.find(s => s.id === selectedSubjectId)?.name} ({subjects.find(s => s.id === selectedSubjectId)?.code})
                                            </div>
                                            <button type="button" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] whitespace-nowrap" onClick={() => setSelectedSubjectId('')}>
                                                Change
                                            </button>
                                        </div>
                                    ) : subjects.length === 0 && !addingSubject ? (
                                        <p className="text-xs text-orange-400">No subjects found. Click <strong>+ Add</strong> above.</p>
                                    ) : !addingSubject ? (
                                        <select className="input-field w-full" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                                            <option value="">-- Select Subject --</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                            ))}
                                        </select>
                                    ) : null}

                                    {/* Inline Add Subject Form */}
                                    {addingSubject && !selectedSubjectId && (
                                        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2 mt-1">
                                            <div className="flex gap-2">
                                                <input className="input-field flex-1 text-xs" placeholder="Subject Name, e.g. Mathematics" value={qSubject.name} onChange={e => setQSubject(p => ({ ...p, name: e.target.value }))} />
                                                <input className="input-field w-28 text-xs font-mono uppercase" placeholder="Code e.g. MAT" value={qSubject.code} onChange={e => setQSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                                            </div>
                                            <select className="input-field w-full text-xs" value={qSubject.academic_level_id} onChange={e => setQSubject(p => ({ ...p, academic_level_id: e.target.value, grading_system_id: '' }))}>
                                                <option value="">-- Select Academic Level --</option>
                                                {academicLevels.map(al => (
                                                    <option key={al.id} value={al.id}>{al.name}</option>
                                                ))}
                                            </select>
                                            {/* Grading System Selection - filtered by academic level */}
                                            <select 
                                                className="input-field w-full text-xs" 
                                                value={qSubject.grading_system_id} 
                                                onChange={e => setQSubject(p => ({ ...p, grading_system_id: e.target.value }))}
                                            >
                                                <option value="">-- Grading System (Optional) --</option>
                                                {gradingSystems
                                                    .filter(gs => gs.academic_level_id === qSubject.academic_level_id)
                                                    .map(gs => (
                                                        <option key={gs.id} value={gs.id}>{gs.name}</option>
                                                    ))
                                                }
                                            </select>
                                            <button type="button" onClick={handleQuickAddSubject} className="btn-primary text-xs py-1" disabled={quickSaving || !qSubject.name.trim() || !qSubject.code.trim() || !qSubject.academic_level_id}>
                                                {quickSaving ? '...' : '✓ Save Subject'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Row: Academic Year + Term */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-[var(--color-text-muted)]">Academic Year *</label>
                                            <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingYear(!addingYear)}>
                                                {addingYear ? '✕ Cancel' : '+ Add'}
                                            </button>
                                        </div>
                                        {academicYears.length === 0 && !addingYear ? (
                                            <p className="text-xs text-orange-400">No years found. Click <strong>+ Add</strong> above.</p>
                                        ) : !addingYear ? (
                                            <select className="input-field w-full" value={selectedAcademicYearId} onChange={e => setSelectedAcademicYearId(e.target.value)}>
                                                <option value="">-- Select Year --</option>
                                                {academicYears.map(y => (
                                                    <option key={y.id} value={y.id}>{y.name}</option>
                                                ))}
                                            </select>
                                        ) : null}

                                        {/* Inline Add Year Form */}
                                        {addingYear && (
                                            <form onSubmit={handleQuickAddYear} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2">
                                                <input className="input-field w-full text-xs" placeholder="Year name, e.g. 2026" value={qYear.name} onChange={e => setQYear(p => ({ ...p, name: e.target.value }))} />
                                                <div className="flex gap-2">
                                                    <input type="date" className="input-field flex-1 text-xs" value={qYear.start_date} onChange={e => setQYear(p => ({ ...p, start_date: e.target.value }))} />
                                                    <input type="date" className="input-field flex-1 text-xs" value={qYear.end_date} onChange={e => setQYear(p => ({ ...p, end_date: e.target.value }))} />
                                                </div>
                                                <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qYear.name.trim() || !qYear.start_date || !qYear.end_date}>
                                                    {quickSaving ? '...' : '✓ Save Year'}
                                                </button>
                                            </form>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-[var(--color-text-muted)]">Term *</label>
                                            {selectedAcademicYearId && (
                                                <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingTerm(!addingTerm)}>
                                                    {addingTerm ? '✕ Cancel' : '+ Add'}
                                                </button>
                                            )}
                                        </div>
                                        {!selectedAcademicYearId ? (
                                            <p className="text-xs text-[var(--color-text-muted)]">Select a year first.</p>
                                        ) : filteredTerms.length === 0 && !addingTerm ? (
                                            <p className="text-xs text-orange-400">No terms. Click <strong>+ Add</strong> above.</p>
                                        ) : !addingTerm ? (
                                            <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
                                                <option value="">-- Select Term --</option>
                                                {filteredTerms.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        ) : null}

                                        {/* Inline Add Term Form */}
                                        {addingTerm && selectedAcademicYearId && (
                                            <form onSubmit={handleQuickAddTerm} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2">
                                                <input className="input-field w-full text-xs" placeholder="e.g. Term 1" value={qTerm.name} onChange={e => setQTerm(p => ({ ...p, name: e.target.value }))} />
                                                <div className="flex gap-2">
                                                    <input type="date" className="input-field flex-1 text-xs" value={qTerm.start_date} onChange={e => setQTerm(p => ({ ...p, start_date: e.target.value }))} />
                                                    <input type="date" className="input-field flex-1 text-xs" value={qTerm.end_date} onChange={e => setQTerm(p => ({ ...p, end_date: e.target.value }))} />
                                                </div>
                                                <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qTerm.name.trim() || !qTerm.start_date || !qTerm.end_date}>
                                                    {quickSaving ? '...' : '✓ Save Term'}
                                                </button>
                                            </form>
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
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs text-[var(--color-text-muted)]">Stream (optional)</label>
                                            {selectedGradeId && (
                                                <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingStream(!addingStream)}>
                                                    {addingStream ? '✕ Cancel' : '+ Add'}
                                                </button>
                                            )}
                                        </div>
                                        {!selectedGradeId ? (
                                            <p className="text-xs text-[var(--color-text-muted)]">Select a grade first.</p>
                                        ) : addingStream ? null : filteredStreams.length === 0 ? (
                                            <select className="input-field w-full" disabled>
                                                <option>No streams — click + Add</option>
                                            </select>
                                        ) : (
                                            <select className="input-field w-full" value={selectedStreamId} onChange={e => setSelectedStreamId(e.target.value)}>
                                                <option value="">-- All Streams --</option>
                                                {filteredStreams.map(s => (
                                                    <option key={s.id} value={s.id}>{s.full_name}</option>
                                                ))}
                                            </select>
                                        )}

                                        {/* Inline Add Stream Form */}
                                        {addingStream && selectedGradeId && (
                                            <form onSubmit={handleQuickAddStream} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2 mt-1">
                                                <input className="input-field w-full text-xs" placeholder="Stream name, e.g. A" value={qStream.name} onChange={e => setQStream({ name: e.target.value })} />
                                                <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qStream.name.trim()}>
                                                    {quickSaving ? '...' : '✓ Save Stream'}
                                                </button>
                                            </form>
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
                                onClick={() => handleCreateExam()}
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
