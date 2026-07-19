"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ScanSheet } from '@/components/marks/ScanSheet';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { PaperSchemeModal } from '@/components/marks/PaperSchemeModal';
import { isMultiPaper } from '@/lib/multi-paper';
import type { ExamSubjectComponentScheme } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { ALL_EXAM_TYPES, STANDARD_TERM_EXAMS, getExamTypeLabel, type ExamTypeDefinition } from '@/lib/exam-types';
import { findActiveTermId, getCurrentTermName } from '@/lib/term-calendar';

interface MySubjectItem { id: string; code: string; name: string; academic_level_id: string; category?: string; }

interface Term { id: string; name: string; academic_year_id: string; is_current: boolean; }
interface AcademicLevel { id: string; code: string; name: string; }
interface GradeItem { id: string; name_display: string; academic_level_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; }
interface ExamSlot {
  id: string; name: string; exam_type: string; max_score: number;
  subject_id: string; subject_name: string; subject_code: string; subject_category: string;
  grade_id: string; grade_name: string; term_id: string; grade_stream_id?: string | null;
}

export function MarksSetupTab() {
  const { profile, availableRoles } = useAuth();
  const isAlsoSubjectTeacher = profile?.role === 'CLASS_TEACHER' && availableRoles.includes('SUBJECT_TEACHER');

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

  const [mySubjects, setMySubjects] = useState<MySubjectItem[]>([]);
  const [loadingMySubjects, setLoadingMySubjects] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubjectId, setCreateSubjectId] = useState<string | undefined>(undefined);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState<'manual' | 'bulk' | 'scan'>('manual');
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [schemeVersion, setSchemeVersion] = useState(0); // bump to remount entry grid after papers config changes
  const [examScheme, setExamScheme] = useState<ExamSubjectComponentScheme | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null); // subject group currently open

  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Tap-to-open menu (not CSS :hover, which never fires on touch screens) —
  // close on outside tap/click or Escape.
  useEffect(() => {
    if (!showMoreMenu) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

  // Grade → academic level map (must be before derived state)
  const gradeLevelMap = new Map(allGrades.map(g => [g.id, g.academic_level_id]));

  // ── 0a. Fetch academic structure (levels + grades) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/academic-structure', { cache: 'no-store' });
        const data = await res.json();
        if (data.academic_levels) setAcademicLevels(data.academic_levels);
        if (data.grades) setAllGrades(data.grades);
        if (data.subjects) setAllSubjects(data.subjects);
      } catch (err) { console.error('Failed to fetch academic structure:', err); }
    })();
  }, []);

  // ── 0b. Fetch teacher's assigned subjects (for non-admin) ──
  useEffect(() => {
    if (profile?.role === 'ADMIN') { setLoadingMySubjects(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=my_subjects', { cache: 'no-store' });
        const json = await res.json();
        setMySubjects(json.data || []);
      } catch (err) { console.error('Failed to fetch my subjects:', err); }
      setLoadingMySubjects(false);
    })();
  }, [profile?.role]);

  // ── 1. Fetch terms & auto-select active ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=terms', { cache: 'no-store' });
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
      const res = await fetch(`/api/school/exams?term_id=${termId}`, { cache: 'no-store' });
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

  // Available levels (show all levels to allow free navigation)
  const availableLevelsForType = academicLevels;

  // Available grades (show all grades for the selected level)
  const availableGradesForType = allGrades
    .filter(g => !selectedLevelId || g.academic_level_id === selectedLevelId)
    .sort((a, b) => a.name_display.localeCompare(b.name_display));

  // Build subject list from exams filtered by level + grade
  const filteredExamsByType = examsByType
    .filter(e => !selectedLevelId || gradeLevelMap.get(e.grade_id) === selectedLevelId)
    .filter(e => !filterGradeId || e.grade_id === filterGradeId);
  const subjectMap = new Map<string, ExamSlot>();
  filteredExamsByType.forEach(e => { if (!subjectMap.has(e.subject_id)) subjectMap.set(e.subject_id, e); });

  // Intelligently filter teacher's assigned subjects by the selected level/grade
  const resolvedFilterLevelId = filterGradeId
    ? gradeLevelMap.get(filterGradeId) || ''
    : selectedLevelId;
  const myFilteredSubjects = mySubjects.filter(ms =>
    !resolvedFilterLevelId || ms.academic_level_id === resolvedFilterLevelId
  );
  for (const ms of myFilteredSubjects) {
    if (!subjectMap.has(ms.id)) {
      subjectMap.set(ms.id, {
        id: '',
        name: '',
        exam_type: '',
        max_score: 0,
        subject_id: ms.id,
        subject_name: ms.name,
        subject_code: ms.code,
        subject_category: ms.category || '',
        grade_id: '',
        grade_name: '',
        term_id: '',
      });
    }
  }

  const subjects = [...subjectMap.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  // Group the (already class-filtered) subjects by category for display
  const CATEGORY_ORDER: Record<string, number> = {
    LANGUAGE: 1, MATHEMATICS: 2, SCIENCE: 3, HUMANITY: 4, TECHNICAL: 5, CREATIVE: 6,
  };
  const CATEGORY_LABELS: Record<string, string> = {
    LANGUAGE: '🗣️ Languages',
    MATHEMATICS: '🔢 Mathematics',
    SCIENCE: '🔬 Sciences',
    HUMANITY: '🌍 Humanities',
    TECHNICAL: '🛠️ Technical & Applied',
    CREATIVE: '🎨 Creative Arts & Sports',
    OTHER: '📦 Other Subjects',
  };
  const subjectGroups: [string, ExamSlot[]][] = (() => {
    const map = new Map<string, ExamSlot[]>();
    for (const s of subjects) {
      const cat = (s.subject_category || 'OTHER').toUpperCase();
      const key = CATEGORY_ORDER[cat] ? cat : 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort(
      (a, b) => (CATEGORY_ORDER[a[0]] || 99) - (CATEGORY_ORDER[b[0]] || 99)
    );
  })();

  // With a single group there's nothing to choose — open it directly
  const effectiveExpandedCategory = subjectGroups.length === 1 ? subjectGroups[0][0] : expandedCategory;

  // The chosen subject (collapses the picker once set)
  const selectedSubjectSlot = subjects.find(s => s.subject_id === selectedSubjectId);



  // Find selected exam manually from selectedExamId
  const selectedExam = exams.find(e => e.id === selectedExamId);
  const examsForSelectedSubject = exams
    .filter(e => e.exam_type === selectedExamType && e.subject_id === selectedSubjectId)
    .filter(e => !selectedLevelId || gradeLevelMap.get(e.grade_id) === selectedLevelId)
    .filter(e => !filterGradeId || e.grade_id === filterGradeId)
    .sort((a, b) => a.grade_name.localeCompare(b.grade_name));



  useEffect(() => {
    // If the selected subject changes, clear the selected exam ID.
    // We intentionally DO NOT auto-set the level here, because a subject might have a default
    // level (e.g. Primary) but the teacher is assigned to teach it in a different level (e.g. Secondary).
    setSelectedExamId('');
  }, [selectedSubjectId, allSubjects]); // allSubjects kept purely to prevent React hot-reload crash

  useEffect(() => {
    // If the level changes, clear the selected exam ID
    setSelectedExamId('');
  }, [selectedLevelId]);

  // Close any open subject group when the exam type or class changes
  useEffect(() => {
    setExpandedCategory(null);
  }, [selectedExamType, filterGradeId]);

  // ── Fewer clicks: auto-select when there's only one choice ──
  // Only one exam type in the term → select it
  useEffect(() => {
    if (!loadingExams && !selectedExamType) {
      const types = [...new Set(exams.map(e => e.exam_type))];
      if (types.length === 1) setSelectedExamType(types[0]);
    }
  }, [loadingExams, exams, selectedExamType]);

  // Only one class/exam slot for the chosen subject → select it
  const soleExamId = examsForSelectedSubject.length === 1 ? examsForSelectedSubject[0].id : '';
  useEffect(() => {
    if (selectedSubjectId && !selectedExamId && soleExamId) {
      setSelectedExamId(soleExamId);
    }
  }, [selectedSubjectId, selectedExamId, soleExamId]);

  // ── Papers configuration status for the selected exam ──
  useEffect(() => {
    if (!selectedExamId) { setExamScheme(null); return; }
    (async () => {
      try {
        const res = await fetch(`/api/school/exams/${selectedExamId}/components`, { cache: 'no-store' });
        const json = await res.json();
        setExamScheme(json.data || null);
      } catch {
        setExamScheme(null);
      }
    })();
  }, [selectedExamId, schemeVersion]);

  const examIsMultiPaper = isMultiPaper(examScheme);
  const examPaperSummary = examIsMultiPaper
    ? (examScheme?.components || []).map(c => `${c.component_code}/${Number(c.max_score)}`).join(' + ')
    : '';

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
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--viz-good)' }} />
            Active: {getCurrentTermName()} ({activeTermObj.name})
          </div>
        )}
      </div>

      {/* ═══ STEP 1: Select Term ═══ */}
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold" style={{ minWidth: 70 }}>① Term</label>
          {loadingTerms ? (
            <span className="text-xs text-muted-foreground">Loading terms...</span>
          ) : terms.length === 0 ? (
            <span className="text-xs text-orange-400">No terms found. Ask admin to set up terms.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {terms.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTermId(t.id)}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-all ${selectedTermId === t.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                >
                  {t.name}
                  {t.id === activeTermId && <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-inherit opacity-90">ACTIVE</span>}
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
            {loadingExams && <span className="text-xs text-muted-foreground">Loading...</span>}
          </div>

          {!loadingExams && availableExamTypes.length === 0 ? (
            // No exams yet — one clear primary action for admin
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
              <p className="text-sm mb-3 text-muted-foreground">
                No exams set up yet for <strong>{selectedTermName}</strong>.
                {profile?.role !== 'ADMIN' && ' Ask your admin to set up exams for this term.'}
              </p>
              {profile?.role === 'ADMIN' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => handleSeedExams(STANDARD_TERM_EXAMS)} disabled={seeding} className="btn-primary text-xs px-4 py-2">
                    {seeding ? 'Setting up...' : '🔧 Set Up This Term’s Exams'}
                  </button>
                  <button onClick={() => handleSeedExams(ALL_EXAM_TYPES.map(e => e.code))} disabled={seeding} className="text-xs text-primary hover:underline">
                    Need every exam type instead?
                  </button>
                </div>
              )}
            </div>
          ) : !loadingExams ? (
            // Show available exam types as clickable buttons
            <div className="flex flex-wrap items-center gap-2">
              {availableExamTypes.map(et => {
                const count = exams.filter(e => e.exam_type === et.code).length;
                const isActive = selectedExamType === et.code;
                return (
                  <button
                    key={et.code}
                    onClick={() => { setSelectedExamType(et.code); setSelectedSubjectId(''); }}
                    className={`cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                    title={et.description}
                  >
                    {et.icon} {et.shortName}
                    <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}

              {/* Admin: one compact menu for the less-common exam-setup actions */}
              {profile?.role === 'ADMIN' && (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(v => !v)}
                    aria-expanded={showMoreMenu}
                    className={`cursor-pointer rounded-xl border border-dashed px-3 py-2.5 text-xs transition-colors ${showMoreMenu ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                    title="More exam setup options"
                  >
                    ⚙️ More
                  </button>
                  {showMoreMenu && (
                    <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] max-w-[90vw] max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
                      {ALL_EXAM_TYPES.filter(et => !existingTypes.has(et.code)).map(et => (
                        <button
                          key={et.code}
                          onClick={() => { handleSeedExams([et.code]); setShowMoreMenu(false); }}
                          disabled={seeding}
                          className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          + {et.icon} {et.name}
                          <span className="mt-0.5 block text-[10px] opacity-70">{et.description}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => { handleSeedExams(Array.from(existingTypes)); setShowMoreMenu(false); }}
                        disabled={seeding}
                        className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        {seeding ? 'Working...' : '🔄 Add exams for any new subjects'}
                      </button>
                      <button
                        onClick={() => { setShowCreateModal(true); setShowMoreMenu(false); }}
                        className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        + Create one exam manually
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {seedMsg && (
            <div className={`mt-3 text-xs px-3 py-2 rounded ${seedMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {seedMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 3: Class & Subject (one step — pick a class, its subjects load right below) ═══ */}
      {selectedExamType && (
        <div className="card mb-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>③ Class</label>
            <select
              className="input-field text-sm"
              style={{ padding: '8px 12px', maxWidth: 180 }}
              value={selectedLevelId}
              onChange={e => { setSelectedLevelId(e.target.value); setFilterGradeId(''); setSelectedSubjectId(''); setSelectedExamId(''); }}
              title="Filter classes by level"
            >
              <option value="">— All Levels —</option>
              {availableLevelsForType.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select
              className="input-field text-sm"
              style={{ padding: '8px 12px', maxWidth: 200 }}
              value={filterGradeId}
              onChange={e => { setFilterGradeId(e.target.value); setSelectedSubjectId(''); setSelectedExamId(''); }}
            >
              <option value="">— Select Class —</option>
              {availableGradesForType.map(g => (
                <option key={g.id} value={g.id}>{g.name_display}</option>
              ))}
            </select>
            {!filterGradeId && (
              <span className="text-xs text-muted-foreground">
                👈 Pick a class to load its subjects
              </span>
            )}
          </div>

          {filterGradeId && selectedSubjectSlot && (
            /* A subject is chosen: collapse the picker to a single chip + change */
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">④ Subject</span>
                <span className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-sm font-semibold">
                  {selectedSubjectSlot.subject_name}
                  <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">{selectedSubjectSlot.subject_code}</span>
                </span>
                <button
                  onClick={() => { setSelectedSubjectId(''); setSelectedExamId(''); }}
                  className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-muted"
                >
                  ↺ Change subject
                </button>
              </div>
            </div>
          )}
          {filterGradeId && !selectedSubjectSlot && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {subjects.length} subject{subjects.length !== 1 ? 's' : ''} in this class — tap a group, then pick the subject
                </span>
              </div>
              {subjects.length === 0 ? (
                <p className="text-xs text-orange-400">
                  No subjects found for the selected level/grade. Try widening your filter.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subjectGroups.map(([category, groupSubjects]) => {
                    const isOpen = effectiveExpandedCategory === category;
                    return (
                    <div key={category}>
                      <button
                        onClick={() => setExpandedCategory(isOpen ? null : category)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 transition-all ${isOpen
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/70 bg-card/70 hover:border-primary/30'}`}
                      >
                        <span className={`text-sm font-semibold ${isOpen ? 'text-primary' : ''}`}>
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <span className="rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {groupSubjects.length}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                      <div className="grid gap-2 mt-2 mb-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        {groupSubjects.map(s => {
                          const isActive = selectedSubjectId === s.subject_id;
                          const hasExams = filteredExamsByType.some(e => e.subject_id === s.subject_id);
                          return (
                            <div
                              key={s.subject_id}
                              className={`rounded-xl border p-3 transition-all ${isActive
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-border/70 bg-card/70 hover:border-primary/30'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm">{s.subject_name}</span>
                                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{s.subject_code}</span>
                              </div>
                              {hasExams ? (
                                <button
                                  onClick={() => setSelectedSubjectId(s.subject_id)}
                                  className="btn-primary text-[10px] px-2 py-1"
                                >
                                  Select & Enter Marks
                                </button>
                              ) : profile?.role === 'ADMIN' ? (
                                <button
                                  onClick={() => { setCreateSubjectId(s.subject_id); setShowCreateModal(true); }}
                                  className="btn-secondary text-[10px] px-2 py-1"
                                >
                                  + Create Exam
                                </button>
                              ) : (
                                <span className="text-[10px] text-orange-400/80 italic">No exams yet</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Extra: choose the exam slot (only when the subject has several for this class) ═══ */}
      {selectedSubjectId && examsForSelectedSubject.length === 0 && (
        <div className="card mb-4 p-5 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs text-orange-400">No exam slots found for this subject in the selected class.</p>
        </div>
      )}
      {selectedSubjectId && examsForSelectedSubject.length > 1 && (
        <div className="card mb-4 p-5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm font-semibold" style={{ minWidth: 70 }}>Slot</label>
            <span className="text-xs text-muted-foreground">
              This subject has {examsForSelectedSubject.length} exam slots — choose one
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {examsForSelectedSubject.map(exam => {
              const isActive = selectedExamId === exam.id;
              return (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-all ${isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 bg-card/70 text-foreground hover:border-primary/40'}`}
                >
                  {exam.name || exam.grade_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ MARK ENTRY ═══ */}
      {selectedExamId && selectedExam && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
            <div className="text-sm">
              <strong>{selectedTermName}</strong> · <strong>{getExamTypeLabel(selectedExamType)}</strong> · <strong>{selectedExam.subject_name}</strong> · {selectedExam.grade_name} · {examIsMultiPaper ? <span className="text-primary">Papers: {examPaperSummary}</span> : <>Max: {selectedExam.max_score}</>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPaperModal(true)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${examIsMultiPaper
                  ? 'border border-primary/40 bg-primary/10 text-primary'
                  : 'border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                title="Some subjects are examined in several papers (e.g. Maths Paper 1 & Paper 2, Sciences with a practical). Set that up here — the papers automatically combine into one final subject score."
              >
                {examIsMultiPaper
                  ? `📑 Papers: ${(examScheme?.components || []).map(c => c.component_code).join(' + ')} ✓`
                  : '✂️ Split into Papers (P1, P2…)'}
              </button>
              {(['manual', 'bulk', 'scan'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                  title={m === 'scan' ? 'Photograph a paper marksheet and let the app read the marks for review' : undefined}
                >
                  {m === 'manual' ? '✏️ Manual Entry' : m === 'bulk' ? '📤 Bulk Upload' : '📷 Scan Sheet'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'manual' && (
            <ManualEntryGrid
              key={`${selectedExamId}-${schemeVersion}`}
              examId={selectedExamId}
              maxScore={selectedExam.max_score}
              gradeId={selectedExam.grade_id}
              gradeStreamId={selectedExam.grade_stream_id || null}
              subjectId={selectedExam.subject_id}
            />
          )}
          {mode === 'bulk' && <BulkUpload examId={selectedExamId} subjectId={selectedExam.subject_id} />}
          {mode === 'scan' && (
            <>
              {examIsMultiPaper && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                  📑 This subject uses multiple papers. Scanning records <strong>final scores only</strong> — use Manual Entry for per-paper (P1/P2/P3) scores.
                </div>
              )}
              <ScanSheet
                key={`scan-${selectedExamId}`}
                examId={selectedExamId}
                maxScore={selectedExam.max_score}
                gradeId={selectedExam.grade_id}
                gradeStreamId={selectedExam.grade_stream_id || null}
                subjectId={selectedExam.subject_id}
              />
            </>
          )}
        </div>
      )}

      {/* Empty states */}
      {!selectedTermId && !loadingTerms && (
        <div className="card text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-sm">Select a term above to start entering marks</p>
        </div>
      )}
      {selectedTermId && !selectedExamType && !loadingExams && availableExamTypes.length > 0 && (
        <div className="card text-center py-12 text-muted-foreground">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Select an exam type to continue</p>
        </div>
      )}
      {selectedExamType && !filterGradeId && (
        <div className="card text-center py-12 text-muted-foreground">
          <p className="text-2xl mb-2">🏫</p>
          <p className="text-sm">Select a <strong>class</strong> above to load its subjects</p>
        </div>
      )}
      {selectedExamType && filterGradeId && !selectedSubjectId && subjects.length > 0 && (
        <div className="card text-center py-12 text-muted-foreground">
          <p className="text-2xl mb-2">📚</p>
          <p className="text-sm">{effectiveExpandedCategory ? 'Select a subject to enter marks' : 'Tap a subject group above to see its subjects'}</p>
        </div>
      )}
      
      {showPaperModal && selectedExamId && (
        <PaperSchemeModal
          examId={selectedExamId}
          subjectName={selectedExam?.subject_name}
          onClose={() => setShowPaperModal(false)}
          onSaved={() => setSchemeVersion(v => v + 1)}
        />
      )}

      {showCreateModal && (
        <CreateExamModal
          onClose={() => { setShowCreateModal(false); setCreateSubjectId(undefined); }}
          onCreated={(newExamId) => {
            setShowCreateModal(false);
            setCreateSubjectId(undefined);
            refreshExams(selectedTermId);
          }}
          preselectedSubjectId={createSubjectId}
        />
      )}
    </div>
  );
}
