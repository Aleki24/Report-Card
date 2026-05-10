"use client";

import React from 'react';

interface GradeItem { id: string; name_display: string; code: string; academic_level_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; category?: string; }
interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_id: string; subject_name: string; grade_id: string; grade_name: string; }

const EXAM_TYPES = ['CBC', '844', 'MIDTERM', 'ENDTERM', 'END TERM', 'OPENER'];

interface ExamFiltersProps {
  mode: 'bulk' | 'manual';
  setMode: (m: 'bulk' | 'manual') => void;
  filterGradeId: string;
  setFilterGradeId: (v: string) => void;
  filterSubjectId: string;
  setFilterSubjectId: (v: string) => void;
  filterExamType: string;
  setFilterExamType: (v: string) => void;
  grades: GradeItem[];
  subjects: SubjectItem[];
  exams: ExamOption[];
  selectedExamId: string;
  setSelectedExamId: (v: string) => void;
  loading: boolean;
}

export function ExamFilters({
  mode, setMode, filterGradeId, setFilterGradeId, filterSubjectId, setFilterSubjectId,
  filterExamType, setFilterExamType, grades, subjects, exams, selectedExamId, setSelectedExamId, loading,
}: ExamFiltersProps) {
  const filteredExams = exams.filter(e => {
    if (filterGradeId && e.grade_id !== filterGradeId) return false;
    if (filterSubjectId && e.subject_id !== filterSubjectId) return false;
    if (filterExamType && e.exam_type !== filterExamType) return false;
    return true;
  });

  return (
    <>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* Mode Toggle */}
        <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden w-full md:w-auto basis-full md:basis-auto">
          <button onClick={() => setMode('bulk')} className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'bulk' ? 'bg-[var(--color-accent)] text-white' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'}`} style={{ padding: 'var(--space-4) var(--space-6)' }}>📄 Bulk Upload</button>
          <button onClick={() => setMode('manual')} className={`flex-1 md:flex-none font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${mode === 'manual' ? 'bg-[var(--color-accent)] text-white' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'}`} style={{ padding: 'var(--space-4) var(--space-6)' }}>✏️ Manual Entry</button>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Filter:</label>
          <select className="input-field w-32" value={filterGradeId} onChange={e => { setFilterGradeId(e.target.value); setSelectedExamId(''); }}>
            <option value="">All Grades</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
          </select>
          <select className="input-field w-32" value={filterSubjectId} onChange={e => { setFilterSubjectId(e.target.value); setSelectedExamId(''); }}>
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input-field w-28" value={filterExamType} onChange={e => { setFilterExamType(e.target.value); setSelectedExamId(''); }}>
            <option value="">All Types</option>
            {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Exam Selector */}
      <div className="flex items-center gap-3 w-full md:w-auto mb-4">
        <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">Exam:</label>
        <select className="input-field flex-1 md:w-64" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} disabled={loading || filteredExams.length === 0}>
          {loading ? <option value="">Loading...</option> : filteredExams.length === 0 ? <option value="">No matching exams</option> : filteredExams.map(exam => <option key={exam.id} value={exam.id}>{exam.name} — {exam.subject_name || 'N/A'} ({exam.grade_name || 'N/A'})</option>)}
        </select>
      </div>
    </>
  );
}
