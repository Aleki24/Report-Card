"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { MySubjectsGrid } from '@/components/marks/MySubjectsGrid';
import { ExamFilters } from '@/components/marks/ExamFilters';
import { useAuth } from '@/components/AuthProvider';

interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_id: string; subject_name: string; grade_id: string; grade_name: string; }
interface GradeItem { id: string; name_display: string; code: string; academic_level_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; category?: string; }
interface MySubject { id: string; code: string; name: string; academic_level_id: string; category?: string; exams?: ExamOption[]; }

export default function MarksPage() {
    const { profile, availableRoles } = useAuth();
    const isAlsoClassTeacher = profile?.role === 'SUBJECT_TEACHER' && availableRoles.includes('CLASS_TEACHER');

    const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loading, setLoading] = useState(true);
    const [filterGradeId, setFilterGradeId] = useState('');
    const [filterSubjectId, setFilterSubjectId] = useState('');
    const [filterExamType, setFilterExamType] = useState('');
    const [mySubjects, setMySubjects] = useState<MySubject[]>([]);
    const [loadingMySubjects, setLoadingMySubjects] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [preselectedSubjectId, setPreselectedSubjectId] = useState<string | undefined>(undefined);
    const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [grades, setGrades] = useState<GradeItem[]>([]);

    const fetchExams = useCallback(async () => {
        try {
            const res = await fetch('/api/school/exams');
            if (res.ok) {
                const json = await res.json();
                const examList = json?.data || [];
                setExams(examList as ExamOption[]);
                if (examList.length > 0 && (!selectedExamId || !examList.find((e: any) => e.id === selectedExamId))) {
                    setSelectedExamId(examList[0].id);
                }
            } else { setExams([]); }
        } catch { setExams([]); }
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchExams(); }, [fetchExams]);

    const fetchFilterDropdowns = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/academic-structure');
            const data = await res.json();
            if (res.ok) {
                if (data.subjects) setSubjects(data.subjects);
                if (data.grades) setGrades(data.grades);
            }
        } catch (err) { console.error('Error fetching filter dropdowns:', err); }
    }, []);

    useEffect(() => { fetchFilterDropdowns(); }, [fetchFilterDropdowns]);

    const fetchMySubjects = useCallback(async () => {
        setLoadingMySubjects(true);
        try {
            const res = await fetch('/api/school/data?type=my_subjects');
            if (res.ok) {
                const json = await res.json();
                const subjectList = json?.data || [];
                const subjectsWithExams = await Promise.all(
                    subjectList.map(async (subject: MySubject) => {
                        const examRes = await fetch('/api/school/exams');
                        if (examRes.ok) {
                            const examJson = await examRes.json();
                            return { ...subject, exams: (examJson?.data || []).filter((e: any) => e.subject_id === subject.id) };
                        }
                        return { ...subject, exams: [] };
                    })
                );
                setMySubjects(subjectsWithExams);
            } else { setMySubjects([]); }
        } catch { setMySubjects([]); }
        setLoadingMySubjects(false);
    }, []);

    useEffect(() => { if (profile?.role === 'SUBJECT_TEACHER') fetchMySubjects(); }, [profile?.role, fetchMySubjects]);

    const handleDeleteExam = async (examId: string) => {
        if (!confirm('Are you sure you want to delete this exam? This action cannot be undone and all associated marks will be lost.')) return;
        try {
            setDeletingExamId(examId);
            const res = await fetch(`/api/school/exams/${examId}`, { method: 'DELETE' });
            if (res.ok) {
                setExams(prev => prev.filter(e => e.id !== examId));
                if (selectedExamId === examId) {
                    const remaining = exams.filter(e => e.id !== examId);
                    setSelectedExamId(remaining.length > 0 ? remaining[0].id : '');
                }
            } else { const data = await res.json(); alert(`Failed to delete exam: ${data.error || 'Unknown error'}`); }
        } catch { alert('An error occurred while deleting the exam.'); }
        finally { setDeletingExamId(null); }
    };

    const handleExamCreated = async (newExamId: string) => {
        setSelectedExamId(newExamId);
        await fetchExams();
        if (profile?.role === 'SUBJECT_TEACHER') await fetchMySubjects();
        setSelectedExamId(newExamId);
    };

    const selectedExam = exams.find(e => e.id === selectedExamId);

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Mark Entry</h1>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Upload marks in bulk or enter them manually for each exam</p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => { setPreselectedSubjectId(undefined); setShowCreateModal(true); }}>+ Create Exam</button>
            </div>

            {isAlsoClassTeacher && (
                <a href="/dashboard/reports" className="mb-6 flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.25)', textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div style={{ flex: 1 }}><span className="font-semibold text-sm" style={{ color: 'rgb(167,139,250)' }}>Go to My Class</span><span className="text-xs block" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>Switch to your class teacher dashboard to generate reports &amp; manage students</span></div>
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

            {profile?.role === 'SUBJECT_TEACHER' && (
                <MySubjectsGrid
                    mySubjects={mySubjects} loadingMySubjects={loadingMySubjects}
                    selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId}
                    onNewExam={(subjectId) => { setPreselectedSubjectId(subjectId); setShowCreateModal(true); }}
                />
            )}

            <ExamFilters
                mode={mode} setMode={setMode}
                filterGradeId={filterGradeId} setFilterGradeId={setFilterGradeId}
                filterSubjectId={filterSubjectId} setFilterSubjectId={setFilterSubjectId}
                filterExamType={filterExamType} setFilterExamType={setFilterExamType}
                grades={grades} subjects={subjects} exams={exams}
                selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId} loading={loading}
            />

            {selectedExam && (
                <div className="mb-6 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between items-center flex-wrap gap-2">
                    <div><strong>Selected:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name || 'N/A'} · <strong>Grade:</strong> {selectedExam.grade_name || 'N/A'} · <strong>Max Score:</strong> {selectedExam.max_score}</div>
                    {profile?.role === 'ADMIN' && (
                        <button onClick={() => handleDeleteExam(selectedExam.id)} disabled={deletingExamId === selectedExam.id} className="text-xs px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors disabled:opacity-50">
                            {deletingExamId === selectedExam.id ? 'Deleting...' : 'Delete Exam'}
                        </button>
                    )}
                </div>
            )}

            <div className="w-full">
                {mode === 'bulk' ? <BulkUpload examId={selectedExamId} /> : <ManualEntryGrid examId={selectedExamId} maxScore={selectedExam?.max_score || 100} />}
            </div>

            {showCreateModal && (
                <CreateExamModal
                    onClose={() => { setShowCreateModal(false); setPreselectedSubjectId(undefined); }}
                    onCreated={handleExamCreated}
                    preselectedSubjectId={preselectedSubjectId}
                />
            )}
        </div>
    );
}
