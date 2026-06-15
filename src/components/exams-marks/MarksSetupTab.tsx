"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { useAuth } from '@/components/AuthProvider';
import { ALL_EXAM_TYPES, STANDARD_TERM_EXAMS, getExamTypeLabel, type ExamTypeDefinition } from '@/lib/exam-types';
import { findActiveTermId, getCurrentTermName } from '@/lib/term-calendar';

interface Term { id: string; name: string; academic_year_id: string; is_current: boolean; }
interface AcademicLevel { id: string; code: string; name: string; }
interface GradeItem { id: string; name_display: string; academic_level_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; }
interface ExamSlot {
  id: string; name: string; exam_type: string; max_score: number;
  subject_id: string; subject_name: string; subject_code: string; subject_category: string;
  grade_id: string; grade_name: string; term_id: string;
}

export function MarksSetupTab() {
  const { profile, availableRoles } = useAuth();
  const isAlsoClassTeacher = profile?.role === 'SUBJECT_TEACHER' && availableRoles.includes('CLASS_TEACHER');

  // State
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [exams, setExams] = useState<ExamSlot[]>([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [filterGradeId, setFilterGradeId] = useState('');

  // Academic structure for level/grade filtering
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [allGrades, setAllGrades] = useState<GradeItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState<'manual' | 'bulk'>('manual');

  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Grade → academic level map (must be before derived state)
  const gradeLevelMap = new Map(allGrades.map(g => [g.id, g.academic_level_id]));

  // ── 0. Fetch academic structure (levels + grades) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/academic-structure');
        const data = await res.json();
        if (data.academic_levels) setAcademicLevels(data.academic_levels);
        if (data.grades) setAllGrades(data.grades);
        if (data.subjects) setAllSubjects(data.subjects);
      } catch (err) { console.error('Failed to fetch academic structure:', err); }
    })();
  }, []);

  // ── 1. Fetch terms & auto-select active ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=terms');
        const json = await res.json();
        const termList: Term[] = json.data || [];
        setTerms(termList);
        // Auto-select active term based on Kenyan calendar (Jan-Apr=T1, May-Jul=T2, Aug-Nov=T3)
        const activeId = findActiveTermId(termList);
        if (activeId) setSelectedTermId(activeId);
        else if (termList.length > 0) setSelectedTermId(termList[0].id);
      } catch (err) { console.error('Failed to fetch terms:', err); }
      setLoadingTerms(false);
    })();
  }, []);

  // ── 2. Fetch exams for selected term ──
  const refreshExams = useCallback(async (termId: string) => {
    if (!termId) { setExams([]); return; }
    setLoadingExams(true);
    try {
      const res = await fetch(`/api/school/exams?term_id=${termId}`);
      const json = await res.json();
      setExams(json.data || []);
    } catch (err) { console.error('Failed to fetch exams:', err); }
    setLoadingExams(false);
  }, []);

  useEffect(() => {
    setSelectedExamType('');
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedLevelId('');
    setFilterGradeId('');
    refreshExams(selectedTermId);
  }, [selectedTermId, refreshExams]);

  // ── Derived: available exam types from pre-defined list ──
  const existingTypes = new Set(exams.map(e => e.exam_type));
  const availableExamTypes = ALL_EXAM_TYPES.filter(
    et => existingTypes.has(et.code)
  );

  // Subjects for selected exam type, filtered by level and grade
  const examsByType = exams.filter(e => e.exam_type === selectedExamType);

  // Available levels from the exams (for the level filter dropdown)
  const examLevelIds = new Set(
    examsByType.map(e => gradeLevelMap.get(e.grade_id)).filter(Boolean)
  );
  const availableLevelsForType = academicLevels.filter(l => examLevelIds.has(l.id));

  // Available grades from the exams (for the grade filter dropdown), filtered by selected level
  const examGradeIds = new Set(examsByType.map(e => e.grade_id));
  const availableGradesForType = allGrades
    .filter(g => examGradeIds.has(g.id))
    .filter(g => !selectedLevelId || g.academic_level_id === selectedLevelId)
    .sort((a, b) => a.name_display.localeCompare(b.name_display));

  // Build subject list filtered by level + grade
  const filteredExamsByType = examsByType
    .filter(e => !selectedLevelId || gradeLevelMap.get(e.grade_id) === selectedLevelId)
    .filter(e => !filterGradeId || e.grade_id === filterGradeId);
  const subjectMap = new Map<string, ExamSlot>();
  filteredExamsByType.forEach(e => { if (!subjectMap.has(e.subject_id)) subjectMap.set(e.subject_id, e); });
  const subjects = [...subjectMap.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));



  // Find selected exam manually from selectedExamId
  const selectedExam = exams.find(e => e.id === selectedExamId);
  const examsForSelectedSubject = exams
    .filter(e => e.exam_type === selectedExamType && e.subject_id === selectedSubjectId)
    .filter(e => !selectedLevelId || gradeLevelMap.get(e.grade_id) === selectedLevelId)
    .filter(e => !filterGradeId || e.grade_id === filterGradeId)
    .sort((a, b) => a.grade_name.localeCompare(b.grade_name));



  useEffect(() => {
    // If the selected subject changes, auto-set level to match the subject's academic level and clear exam
    setSelectedExamId('');
    const subj = allSubjects.find(s => s.id === selectedSubjectId);
    setSelectedLevelId(subj?.academic_level_id || '');
  }, [selectedSubjectId, allSubjects]);

  useEffect(() => {
    // If the level changes, clear the selected exam ID
    setSelectedExamId('');
  }, [selectedLevelId]);

  // ── Seed exam slots (admin only) ──
  const handleSeedExams = async (examTypes?: string[]) => {
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
          examTypes,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSeedMsg({ type: 'success', text: `✅ Created ${json.created} exam slots (${json.skipped} already existed)` });
        await refreshExams(selectedTermId);
      } else {
        setSeedMsg({ type: 'error', text: `❌ ${json.error}` });
      }
    } catch { setSeedMsg({ type: 'error', text: '❌ Failed to seed exams' }); }
    setSeeding(false);
  };

  // Determine active term by Kenyan calendar (Jan-Apr=T1, May-Jul=T2, Aug-Nov=T3)
  const activeTermId = findActiveTermId(terms);
  const activeTermObj = terms.find(t => t.id === activeTermId);
  const selectedTermName = terms.find(t => t.id === selectedTermId)?.name || '';

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="flex-1">
          {/* Header removed as it is now a tab */}
        </div>
        {activeTermObj && (
          <div className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(52,211,153)', border: '1px solid rgba(16,185,129,0.3)' }}>
            🟢 Active: {getCurrentTermName()} ({activeTermObj.name})
          </div>
        )}
      </div>

      {isAlsoClassTeacher && (
        <a href="/dashboard/reports" className="mb-6 flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.01]" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.25)', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div style={{ flex: 1 }}><span className="font-semibold text-sm" style={{ color: 'rgb(167,139,250)' }}>Go to My Class</span><span className="text-xs block" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>Switch to class teacher dashboard for reports &amp; student management</span></div>
          <span style={{ fontSize: 18, opacity: 0.6 }}>→</span>
        </a>
      )}

      {/* ═══ STEP 1: Select Term ═══ */}
      <div className="card mb-4 p-5">
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
                    background: selectedTermId === t.id
                      ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                    color: selectedTermId === t.id ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${selectedTermId === t.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {t.name}
                  {t.id === activeTermId && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px]" style={{ background: 'rgba(16,185,129,0.2)', color: 'rgb(52,211,153)' }}>ACTIVE</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ STEP 2: Select Exam Type ═══ */}
      {selectedTermId && (
        <div className="card mb-4 p-5">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>② Exam</label>
            {loadingExams && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>}
          </div>

          {!loadingExams && availableExamTypes.length === 0 ? (
            // No exams yet — show initialization panel for admin
            <div className="p-4 rounded-lg" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                No exams initialized for <strong>{selectedTermName}</strong>.
                {profile?.role === 'ADMIN'
                  ? ' Select which exam types to create:'
                  : ' Ask your admin to initialize exams for this term.'}
              </p>
              {profile?.role === 'ADMIN' && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleSeedExams(STANDARD_TERM_EXAMS)} disabled={seeding} className="btn-primary text-xs px-4 py-2">
                    {seeding ? 'Creating...' : '🔧 Create Standard (Opener + Midterm + Endterm)'}
                  </button>
                  <button onClick={() => handleSeedExams(ALL_EXAM_TYPES.map(e => e.code))} disabled={seeding} className="btn-secondary text-xs px-4 py-2">
                    {seeding ? 'Creating...' : '📦 Create All Types'}
                  </button>
                </div>
              )}
            </div>
          ) : !loadingExams ? (
            // Show available exam types as clickable buttons
            <div className="flex flex-wrap gap-2">
              {availableExamTypes.map(et => {
                const count = exams.filter(e => e.exam_type === et.code).length;
                const isActive = selectedExamType === et.code;
                return (
                  <button
                    key={et.code}
                    onClick={() => { setSelectedExamType(et.code); setSelectedSubjectId(''); }}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                    title={et.description}
                    style={{
                      background: isActive ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                      color: isActive ? '#fff' : 'var(--color-text-secondary)',
                      border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {et.icon} {et.shortName}
                    <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}

              {/* Admin can add more exam types */}
              {profile?.role === 'ADMIN' && (
                <>
                  <div className="relative group">
                    <button className="px-3 py-2.5 rounded-lg text-xs transition-all" style={{ background: 'var(--color-surface-raised)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                      + Add Type
                    </button>
                    <div className="hidden group-hover:block absolute z-50 top-full left-0 mt-1 p-2 rounded-lg min-w-[200px]" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                      {ALL_EXAM_TYPES.filter(et => !existingTypes.has(et.code)).map(et => (
                        <button
                          key={et.code}
                          onClick={() => handleSeedExams([et.code])}
                          disabled={seeding}
                          className="w-full text-left px-3 py-2 rounded text-xs hover:bg-card transition-colors"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {et.icon} {et.name}
                          <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{et.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSeedExams(Array.from(existingTypes))}
                    disabled={seeding}
                    className="px-3 py-2.5 rounded-lg text-xs transition-all hover:bg-muted"
                    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                    title="Generate exams for newly added subjects"
                  >
                    {seeding ? 'Syncing...' : '🔄 Sync Missing'}
                  </button>
                </>
              )}
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-1 hover:text-white"
                style={{ background: 'var(--color-surface-raised)', border: '1px dashed rgba(99,102,241,0.5)', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                title="Manually create a single spontaneous exam (e.g. for a specific class)"
              >
                + Single Exam
              </button>
            </div>
          ) : null}

          {seedMsg && (
            <div className={`mt-3 text-xs px-3 py-2 rounded ${seedMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {seedMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 3: Filter by Level & Grade ═══ */}
      {selectedExamType && (
        <div className="card mb-4 p-5">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>③ Filter</label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Narrow down by level and grade
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Level filter */}
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Level</label>
              <select
                className="input-field w-full text-sm"
                value={selectedLevelId}
                onChange={e => { setSelectedLevelId(e.target.value); setFilterGradeId(''); setSelectedSubjectId(''); setSelectedExamId(''); }}
              >
                <option value="">— All Levels —</option>
                {availableLevelsForType.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            {/* Grade filter */}
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Grade / Class</label>
              <select
                className="input-field w-full text-sm"
                value={filterGradeId}
                onChange={e => { setFilterGradeId(e.target.value); setSelectedSubjectId(''); setSelectedExamId(''); }}
              >
                <option value="">— All Grades —</option>
                {availableGradesForType.map(g => (
                  <option key={g.id} value={g.id}>{g.name_display}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Select Subject ═══ */}
      {selectedExamType && (
        <div className="card mb-4 p-5">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>④ Subject</label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''} available
              {selectedLevelId || filterGradeId ? ' (filtered)' : ''}
            </span>
          </div>
          {subjects.length === 0 ? (
            <p className="text-xs text-orange-400">
              {selectedLevelId || filterGradeId
                ? 'No subjects found for the selected level/grade. Try widening your filter.'
                : 'No subjects found for this exam type.'}
            </p>
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 5: Select Grade / Class for this subject ═══ */}
      {selectedSubjectId && (
        <div className="card mb-4 p-5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>⑤ Class</label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {examsForSelectedSubject.length} class{examsForSelectedSubject.length !== 1 ? 'es' : ''} available
            </span>
          </div>

          {examsForSelectedSubject.length === 0 ? (
            <p className="text-xs text-orange-400">No exam slots found for this subject{selectedLevelId || filterGradeId ? ' with the current filters' : ''}.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {examsForSelectedSubject.map(exam => {
                const isActive = selectedExamId === exam.id;
                return (
                  <button
                    key={exam.id}
                    onClick={() => setSelectedExamId(exam.id)}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                    style={{
                      background: isActive ? 'var(--color-primary)' : 'var(--color-surface-raised)',
                      color: isActive ? '#fff' : 'var(--color-text)',
                      border: isActive ? '1px solid transparent' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    {exam.grade_name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ MARK ENTRY ═══ */}
      {selectedExamId && selectedExam && (
        <div>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3" style={{ padding: 'var(--space-3) var(--space-4)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06))' }}>
            <div className="text-sm">
              <strong>{selectedTermName}</strong> · <strong>{getExamTypeLabel(selectedExamType)}</strong> · <strong>{selectedExam.subject_name}</strong> · {selectedExam.grade_name} · Max: {selectedExam.max_score}
            </div>
            <div className="flex gap-2">
              {(['manual', 'bulk'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                  style={{
                    background: mode === m ? 'var(--color-accent)' : 'transparent',
                    color: mode === m ? '#fff' : 'var(--color-text-muted)',
                    border: mode === m ? 'none' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {m === 'manual' ? '✏️ Manual Entry' : '📤 Bulk Upload'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'manual'
            ? <ManualEntryGrid examId={selectedExamId} maxScore={selectedExam.max_score} />
            : <BulkUpload examId={selectedExamId} />}
        </div>
      )}

      {/* Empty states */}
      {!selectedTermId && !loadingTerms && (
        <div className="card text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-4xl mb-3">📝</p>
          <p className="text-sm">Select a term above to start entering marks</p>
        </div>
      )}
      {selectedTermId && !selectedExamType && !loadingExams && availableExamTypes.length > 0 && (
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
      
      {showCreateModal && (
        <CreateExamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newExamId) => {
            setShowCreateModal(false);
            refreshExams(selectedTermId);
          }}
        />
      )}
    </div>
  );
}
