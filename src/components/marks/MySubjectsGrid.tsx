"use client";

import React from 'react';

interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_id: string; subject_name: string; grade_id: string; grade_name: string; }
interface MySubject { id: string; code: string; name: string; academic_level_id: string; category?: string; exams?: ExamOption[]; }

interface MySubjectsGridProps {
  mySubjects: MySubject[];
  loadingMySubjects: boolean;
  selectedExamId: string;
  setSelectedExamId: (id: string) => void;
  onNewExam: (subjectId: string) => void;
}

export function MySubjectsGrid({ mySubjects, loadingMySubjects, selectedExamId, setSelectedExamId, onNewExam }: MySubjectsGridProps) {
  if (loadingMySubjects) {
    return <div className="card mb-6" style={{ textAlign: 'center', padding: 'var(--space-8)' }}><p style={{ color: 'var(--color-text-muted)' }}>Loading your subjects...</p></div>;
  }

  if (mySubjects.length === 0) {
    return <div className="card mb-6" style={{ textAlign: 'center', padding: 'var(--space-8)' }}><p style={{ color: 'var(--color-text-muted)' }}>No subjects assigned to you. Contact administrator.</p></div>;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] mb-4">My Subjects</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {mySubjects.map(subject => (
          <div key={subject.id} className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{subject.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{subject.code}</span>
                {subject.category && (
                  <span style={{ display: 'inline-block', marginLeft: 8, fontSize: 10, padding: '2px 6px', background: 'var(--color-surface-raised)', borderRadius: 4 }}>{subject.category}</span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Exams ({subject.exams?.length || 0})</p>
              {subject.exams && subject.exams.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {subject.exams.slice(0, 3).map(exam => (
                    <div key={exam.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: selectedExamId === exam.id ? 'var(--color-accent-transparent)' : 'var(--color-surface-raised)', borderRadius: 6, border: selectedExamId === exam.id ? '1px solid var(--color-accent)' : '1px solid transparent', cursor: 'pointer' }} onClick={() => setSelectedExamId(exam.id)}>
                      <div><span style={{ fontSize: 13, fontWeight: 500 }}>{exam.name}</span><span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{exam.exam_type}</span></div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Max: {exam.max_score}</span>
                    </div>
                  ))}
                  {subject.exams.length > 3 && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>+{subject.exams.length - 3} more exams</p>}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No exams created yet</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn-primary flex-1" style={{ fontSize: 12, padding: 'var(--space-2) var(--space-3)' }} onClick={() => onNewExam(subject.id)}>+ New Exam</button>
              {subject.exams && subject.exams.length > 0 && (
                <button className="btn-secondary" style={{ fontSize: 12, padding: 'var(--space-2) var(--space-3)' }} onClick={() => setSelectedExamId(subject.exams![0].id)}>View Marks</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
