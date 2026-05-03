"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { DeleteConfirmDialog } from '@/components/marks/DeleteConfirmDialog';
import { useAuth } from '@/components/AuthProvider';

interface ExamOption {
  id: string;
  name: string;
  exam_type: string;
  max_score: number;
  subject_name: string;
  subject_id?: string;
  grade_name: string;
}

interface MySubject {
  id: string;
  code: string;
  name: string;
  academic_level_id: string;
  category?: string;
  exams?: { id: string; name: string; exam_type: string; max_score: number }[];
}

export default function MarksPage() {
  const { profile, availableRoles } = useAuth();
  const isAlsoClassTeacher = profile?.role === 'SUBJECT_TEACHER' && availableRoles.includes('CLASS_TEACHER');

  const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(true);

  // Subject teacher subjects
  const [mySubjects, setMySubjects] = useState<MySubject[]>([]);
  const [loadingMySubjects, setLoadingMySubjects] = useState(false);

  // Modal & dialog state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preselectedSubjectId, setPreselectedSubjectId] = useState<string | undefined>(undefined);
  const [examToDelete, setExamToDelete] = useState<ExamOption | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  // Fetch all exams for this school
  const fetchExams = useCallback(async () => {
    try {
      const res = await fetch('/api/school/exams');
      if (res.ok) {
        const json = await res.json();
        const examList: ExamOption[] = json?.data || [];
        setExams(examList);
        if (examList.length > 0 && (!selectedExamId || !examList.find(e => e.id === selectedExamId))) {
          setSelectedExamId(examList[0].id);
        }
      } else {
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

  // FIX: fetch exams once, then map to subjects in memory — eliminates N+1
  const fetchMySubjects = useCallback(async () => {
    setLoadingMySubjects(true);
    try {
      const [subjectRes, examRes] = await Promise.all([
        fetch('/api/school/data?type=my_subjects'),
        fetch('/api/school/exams'),
      ]);

      const subjectJson = subjectRes.ok ? await subjectRes.json() : { data: [] };
      const examJson = examRes.ok ? await examRes.json() : { data: [] };

      const allExams: ExamOption[] = examJson?.data || [];
      const subjectList: MySubject[] = subjectJson?.data || [];

      const subjectsWithExams = subjectList.map(subject => ({
        ...subject,
        exams: allExams.filter(e => e.subject_id === subject.id),
      }));

      setMySubjects(subjectsWithExams);
    } catch (error) {
      console.error('Error fetching my subjects:', error);
      setMySubjects([]);
    }
    setLoadingMySubjects(false);
  }, []);

  useEffect(() => {
    if (profile?.role === 'SUBJECT_TEACHER') fetchMySubjects();
  }, [profile?.role, fetchMySubjects]);

  const handleExamCreated = useCallback(async (newExamId: string) => {
    await fetchExams();
    if (profile?.role === 'SUBJECT_TEACHER') await fetchMySubjects();
    setSelectedExamId(newExamId);
  }, [fetchExams, fetchMySubjects, profile?.role]);

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      setDeletingExamId(examToDelete.id);
      const res = await fetch(`/api/school/exams/${examToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = exams.filter(e => e.id !== examToDelete.id);
        setExams(remaining);
        if (selectedExamId === examToDelete.id) {
          setSelectedExamId(remaining.length > 0 ? remaining[0].id : '');
        }
      } else {
        const data = await res.json();
        alert(`Failed to delete exam: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting exam:', err);
    } finally {
      setDeletingExamId(null);
      setExamToDelete(null);
    }
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Mark Entry</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Upload marks in bulk or enter them manually for each exam</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => { setPreselectedSubjectId(undefined); setShowCreateModal(true); }}>+ Create Exam</button>
      </div>

      {/* Dual-role banner */}
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

      {/* Guide — collapsible, remembers state */}
      <details
        className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg"
        open={typeof window !== 'undefined' ? localStorage.getItem('marks-guide-open') !== 'false' : true}
        onToggle={e => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('marks-guide-open', String((e.target as HTMLDetailsElement).open));
          }
        }}
      >
        <summary className="p-4 cursor-pointer flex items-center gap-2 text-sm font-semibold select-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          How to enter marks
        </summary>
        <div className="px-4 pb-4 text-sm">
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li><strong>Step 1:</strong> Click <strong>+ Create Exam</strong> if you haven&apos;t created one yet.</li>
            <li><strong>Step 2:</strong> Select the exam from the dropdown below.</li>
            <li><strong>Step 3:</strong> Choose <strong>Bulk Upload</strong> (CSV) or <strong>Manual Entry</strong>.</li>
          </ul>
        </div>
      </details>

      {/* Subject Teacher — My Subjects */}
      {profile?.role === 'SUBJECT_TEACHER' && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">My Subjects</h2>
          {loadingMySubjects ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
              {[1,2,3].map(i => <div key={i} className="card animate-pulse" style={{ height: 140 }} />)}
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
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{subject.name}</h3>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{subject.code}</span>
                      {subject.category && (
                        <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 10, padding: '2px 6px', background: 'var(--color-surface-raised)', borderRadius: 4 }}>
                          {subject.category}
                        </span>
                      )}
                    </div>
                  </div>
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
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: 'var(--space-2) var(--space-3)',
                              background: selectedExamId === exam.id ? 'var(--color-accent-transparent)' : 'var(--color-surface-raised)',
                              borderRadius: 6,
                              border: selectedExamId === exam.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                              cursor: 'pointer',
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
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>+{subject.exams.length - 3} more exams</p>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No exams created yet</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="btn-primary flex-1"
                      style={{ fontSize: 12, padding: 'var(--space-2) var(--space-3)' }}
                      onClick={() => { setPreselectedSubjectId(subject.id); setShowCreateModal(true); }}
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden w-full md:w-auto">
          <button
            onClick={() => setMode('bulk')}
            className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${
              mode === 'bulk' ? 'bg-[var(--color-accent)] text-white' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
            }`}
            style={{ padding: 'var(--space-4) var(--space-6)' }}
          >
            📄 Bulk Upload
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${
              mode === 'manual' ? 'bg-[var(--color-accent)] text-white' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
            }`}
            style={{ padding: 'var(--space-4) var(--space-6)' }}
          >
            ✏️ Manual Entry
          </button>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Exam:</label>
          {loading ? (
            <div className="animate-pulse h-10 flex-1 md:w-64 rounded-lg bg-[var(--color-surface-raised)]" />
          ) : (
            <select
              className="input-field flex-1 md:w-64"
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              disabled={exams.length === 0}
            >
              {exams.length === 0
                ? <option value="">No exams — click &quot;+ Create Exam&quot;</option>
                : exams.map(exam => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} — {exam.subject_name || 'N/A'} ({exam.grade_name || 'N/A'})
                  </option>
                ))
              }
            </select>
          )}
        </div>
      </div>

      {/* Selected Exam Info */}
      {selectedExam && (
        <div className="mb-6 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex justify-between items-center flex-wrap gap-2">
          <div>
            <strong>Selected:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name || 'N/A'} · <strong>Grade:</strong> {selectedExam.grade_name || 'N/A'} · <strong>Max Score:</strong> {selectedExam.max_score}
          </div>
          {profile?.role === 'ADMIN' && (
            <button
              onClick={() => setExamToDelete(selectedExam)}
              className="text-xs px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors"
            >
              Delete Exam
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

      {/* Create Exam Modal */}
      {showCreateModal && (
        <CreateExamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleExamCreated}
          preselectedSubjectId={preselectedSubjectId}
        />
      )}

      {/* Delete Confirm Dialog */}
      {examToDelete && (
        <DeleteConfirmDialog
          examName={examToDelete.name}
          deleting={deletingExamId === examToDelete.id}
          onConfirm={handleDeleteExam}
          onCancel={() => setExamToDelete(null)}
        />
      )}
    </div>
  );
}
