"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { useAuth } from '@/components/AuthProvider';

interface Term { id: string; name: string; academic_year_id: string; is_current: boolean; }
interface ExamSlot {
  id: string; name: string; exam_type: string; max_score: number;
  subject_id: string; subject_name: string; subject_code: string; subject_category: string;
  grade_id: string; grade_name: string; term_id: string;
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  OPENER: '📝 Opener',
  MIDTERM: '📋 Midterm',
  ENDTERM: '📊 End Term',
  CAT: '📌 CAT',
};

const EXAM_TYPE_ORDER = ['OPENER', 'MIDTERM', 'ENDTERM', 'CAT'];

export default function MarksPage() {
  const { profile, availableRoles } = useAuth();
  const isAlsoClassTeacher = profile?.role === 'SUBJECT_TEACHER' && availableRoles.includes('CLASS_TEACHER');

  // Step state
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [exams, setExams] = useState<ExamSlot[]>([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState<'manual' | 'bulk'>('manual');

  // Loading / messages
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── 1. Fetch terms ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=terms');
        const json = await res.json();
        const termList: Term[] = json.data || [];
        setTerms(termList);
        // Auto-select current term
        const current = termList.find(t => t.is_current);
        if (current) setSelectedTermId(current.id);
        else if (termList.length > 0) setSelectedTermId(termList[0].id);
      } catch (err) { console.error('Failed to fetch terms:', err); }
      setLoadingTerms(false);
    })();
  }, []);

  // ── 2. Fetch exams when term changes ──
  useEffect(() => {
    if (!selectedTermId) { setExams([]); return; }
    setLoadingExams(true);
    setSelectedExamType('');
    setSelectedSubjectId('');
    setSelectedExamId('');

    (async () => {
      try {
        const res = await fetch(`/api/school/exams?term_id=${selectedTermId}`);
        const json = await res.json();
        setExams(json.data || []);
      } catch (err) { console.error('Failed to fetch exams:', err); }
      setLoadingExams(false);
    })();
  }, [selectedTermId]);

  // ── Derived data ──
  const examTypes = [...new Set(exams.map(e => e.exam_type))].sort(
    (a, b) => EXAM_TYPE_ORDER.indexOf(a) - EXAM_TYPE_ORDER.indexOf(b)
  );

  const examsByType = exams.filter(e => e.exam_type === selectedExamType);

  // Group subjects (unique by subject_id)
  const subjectMap = new Map<string, ExamSlot>();
  examsByType.forEach(e => {
    if (!subjectMap.has(e.subject_id)) subjectMap.set(e.subject_id, e);
  });
  const subjects = [...subjectMap.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  // Find the actual exam for the selected subject
  const selectedExam = exams.find(e =>
    e.exam_type === selectedExamType &&
    e.subject_id === selectedSubjectId
  );

  // Auto-select exam when subject changes
  useEffect(() => {
    if (selectedExam) setSelectedExamId(selectedExam.id);
    else setSelectedExamId('');
  }, [selectedExam]);

  // ── Seed exam slots ──
  const handleSeedExams = async () => {
    if (!selectedTermId) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const term = terms.find(t => t.id === selectedTermId);
      const res = await fetch('/api/school/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'seed',
          termId: selectedTermId,
          academicYearId: term?.academic_year_id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSeedMsg({ type: 'success', text: `✅ Created ${json.created} exam slots (${json.skipped} already existed)` });
        // Refresh exams
        const r2 = await fetch(`/api/school/exams?term_id=${selectedTermId}`);
        const j2 = await r2.json();
        setExams(j2.data || []);
      } else {
        setSeedMsg({ type: 'error', text: `❌ ${json.error}` });
      }
    } catch { setSeedMsg({ type: 'error', text: '❌ Failed to seed exams' }); }
    setSeeding(false);
  };

  const selectedTermName = terms.find(t => t.id === selectedTermId)?.name || '';

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Mark Entry</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Select term → exam type → subject, then enter marks</p>
        </div>
      </div>

      {isAlsoClassTeacher && (
        <a href="/dashboard/reports" className="mb-6 flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.25)', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div style={{ flex: 1 }}><span className="font-semibold text-sm" style={{ color: 'rgb(167,139,250)' }}>Go to My Class</span><span className="text-xs block" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>Switch to your class teacher dashboard to generate reports &amp; manage students</span></div>
          <span style={{ fontSize: 18, opacity: 0.6 }}>→</span>
        </a>
      )}

      {/* ══════ STEP 1: Select Term ══════ */}
      <div className="card mb-4" style={{ padding: 'var(--space-5)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold" style={{ minWidth: 70 }}>① Term</label>
          {loadingTerms ? (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading terms...</span>
          ) : terms.length === 0 ? (
            <span className="text-xs text-orange-400">No terms found. Ask admin to set up terms.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {terms.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTermId(t.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: selectedTermId === t.id ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                    color: selectedTermId === t.id ? '#fff' : 'var(--color-text-secondary)',
                    border: selectedTermId === t.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {t.name} {t.is_current && <span style={{ fontSize: 10, opacity: 0.8 }}>(current)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════ STEP 2: Select Exam Type ══════ */}
      {selectedTermId && (
        <div className="card mb-4" style={{ padding: 'var(--space-5)' }}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>② Exam</label>
            {loadingExams ? (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
            ) : examTypes.length === 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-orange-400">No exams for {selectedTermName}.</span>
                {profile?.role === 'ADMIN' && (
                  <button onClick={handleSeedExams} disabled={seeding} className="btn-primary text-xs px-4 py-2">
                    {seeding ? 'Creating...' : '🔧 Initialize Exams for this Term'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {examTypes.map(type => {
                  const count = exams.filter(e => e.exam_type === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => { setSelectedExamType(type); setSelectedSubjectId(''); }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: selectedExamType === type ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                        color: selectedExamType === type ? '#fff' : 'var(--color-text-secondary)',
                        border: selectedExamType === type ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      {EXAM_TYPE_LABELS[type] || type}
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>({count})</span>
                    </button>
                  );
                })}
                {profile?.role === 'ADMIN' && (
                  <button onClick={handleSeedExams} disabled={seeding} className="px-3 py-2 rounded-lg text-xs transition-all" style={{ background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    {seeding ? '...' : '+ Reseed'}
                  </button>
                )}
              </div>
            )}
          </div>
          {seedMsg && (
            <div className={`mt-3 text-xs px-3 py-2 rounded ${seedMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {seedMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ══════ STEP 3: Select Subject ══════ */}
      {selectedExamType && (
        <div className="card mb-4" style={{ padding: 'var(--space-5)' }}>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>③ Subject</label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''} available
            </span>
          </div>
          {subjects.length === 0 ? (
            <p className="text-xs text-orange-400">No subjects found for this exam type.</p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {subjects.map(s => {
                const isActive = selectedSubjectId === s.subject_id;
                return (
                  <button
                    key={s.subject_id}
                    onClick={() => setSelectedSubjectId(s.subject_id)}
                    className="text-left p-3 rounded-lg transition-all"
                    style={{
                      background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : 'var(--color-surface-raised)',
                      border: isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{s.subject_name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>{s.subject_code}</span>
                    </div>
                    {s.subject_category && (
                      <span className="text-[10px] mt-1 block" style={{ color: 'var(--color-text-muted)' }}>{s.subject_category}</span>
                    )}
                    <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.grade_name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════ MARK ENTRY ══════ */}
      {selectedExamId && selectedExam && (
        <div>
          {/* Info bar */}
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3" style={{ padding: 'var(--space-3) var(--space-4)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06))' }}>
            <div className="text-sm">
              <strong>{selectedTermName}</strong> · <strong>{EXAM_TYPE_LABELS[selectedExamType] || selectedExamType}</strong> · <strong>{selectedExam.subject_name}</strong> · {selectedExam.grade_name} · Max: {selectedExam.max_score}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('manual')}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: mode === 'manual' ? 'var(--color-accent)' : 'transparent',
                  color: mode === 'manual' ? '#fff' : 'var(--color-text-muted)',
                  border: mode === 'manual' ? 'none' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                ✏️ Manual Entry
              </button>
              <button
                onClick={() => setMode('bulk')}
                className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: mode === 'bulk' ? 'var(--color-accent)' : 'transparent',
                  color: mode === 'bulk' ? '#fff' : 'var(--color-text-muted)',
                  border: mode === 'bulk' ? 'none' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                📤 Bulk Upload
              </button>
            </div>
          </div>

          {/* Grid or Upload */}
          {mode === 'manual'
            ? <ManualEntryGrid examId={selectedExamId} maxScore={selectedExam.max_score} />
            : <BulkUpload examId={selectedExamId} />
          }
        </div>
      )}

      {/* Empty state */}
      {!selectedTermId && !loadingTerms && (
        <div className="card text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-4xl mb-3">📝</p>
          <p className="text-sm">Select a term above to start entering marks</p>
        </div>
      )}

      {selectedTermId && !selectedExamType && !loadingExams && examTypes.length > 0 && (
        <div className="card text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Select an exam type to continue</p>
        </div>
      )}

      {selectedExamType && !selectedSubjectId && subjects.length > 0 && (
        <div className="card text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-2xl mb-2">📚</p>
          <p className="text-sm">Select a subject to enter marks</p>
        </div>
      )}
    </div>
  );
}
