"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Camera, ChevronDown, FileSpreadsheet, History, Keyboard, Layers, RefreshCw, Search, Settings2 } from 'lucide-react';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ScanSheet } from '@/components/marks/ScanSheet';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { PaperSchemeModal } from '@/components/marks/PaperSchemeModal';
import { isMultiPaper } from '@/lib/multi-paper';
import type { ExamSubjectComponentScheme } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { ALL_EXAM_TYPES, STANDARD_TERM_EXAMS, getExamTypeLabel } from '@/lib/exam-types';
import { findActiveTermId } from '@/lib/term-calendar';
import { isSubjectOfferedAtGrade } from '@/lib/curriculum-bands';
import { cn } from '@/lib/utils';

interface MySubjectItem { id: string; code: string; name: string; academic_level_id: string; category?: string; }
interface Term { id: string; name: string; academic_year_id: string; is_current: boolean; }
interface AcademicLevel { id: string; code: string; name: string; }
interface GradeItem { id: string; name_display: string; academic_level_id: string; }
interface ExamSlot {
  id: string; name: string; exam_type: string; max_score: number;
  subject_id: string; subject_name: string; subject_code: string; subject_category: string;
  grade_id: string; grade_name: string; term_id: string;
  grade_stream_id?: string | null; grade_stream_name?: string | null;
}
/** A subject shown in the picker; `hasExam` is false for a teacher's subject with no exam slot yet. */
interface SubjectChoice { subject_id: string; subject_name: string; subject_code: string; subject_category: string; hasExam: boolean; }

type EntryMode = 'manual' | 'bulk' | 'scan';

/** The last exam opened here, so a teacher can pick up where they left off. */
interface LastExam { termId: string; examId: string; label: string; }
const LAST_EXAM_KEY = 'skulbase:mark-entry:last:v1';

function readLastExam(): LastExam | null {
  try {
    const raw = window.localStorage.getItem(LAST_EXAM_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LastExam>) : null;
    return parsed?.termId && parsed.examId && parsed.label ? { termId: parsed.termId, examId: parsed.examId, label: parsed.label } : null;
  } catch {
    return null;
  }
}

function writeLastExam(value: LastExam): void {
  try { window.localStorage.setItem(LAST_EXAM_KEY, JSON.stringify(value)); } catch { /* private mode: nothing to remember */ }
}

async function fetchTermExams(termId: string): Promise<ExamSlot[]> {
  const res = await fetch(`/api/school/exams?term_id=${encodeURIComponent(termId)}`, { cache: 'no-store' });
  const json = (await res.json()) as { data?: ExamSlot[] };
  return json.data ?? [];
}

const CATEGORY_ORDER: Record<string, number> = { LANGUAGE: 1, MATHEMATICS: 2, SCIENCE: 3, HUMANITY: 4, TECHNICAL: 5, CREATIVE: 6 };
const CATEGORY_LABELS: Record<string, string> = {
  LANGUAGE: 'Languages',
  MATHEMATICS: 'Mathematics',
  SCIENCE: 'Sciences',
  HUMANITY: 'Humanities',
  TECHNICAL: 'Technical & Applied',
  CREATIVE: 'Creative Arts & Sports',
  OTHER: 'Other subjects',
};

const MODES: { id: EntryMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'manual', label: 'Type marks', hint: 'Type or correct marks learner by learner', icon: <Keyboard size={15} aria-hidden /> },
  { id: 'bulk', label: 'Upload file', hint: 'Import a spreadsheet of marks', icon: <FileSpreadsheet size={15} aria-hidden /> },
  { id: 'scan', label: 'Scan sheet', hint: 'Photograph a paper marksheet and review what was read', icon: <Camera size={15} aria-hidden /> },
];

/* ── Small building blocks ─────────────────────────────── */

function ChoiceChip({ active, onClick, children, title, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function StepCard({ step, title, hint, done, children, aside }: { step: number; title: string; hint?: string; done?: boolean; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {step}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/* ── Tab ───────────────────────────────────────────────── */

export function MarksSetupTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';

  // ?exam=<id>&term=<id> opens one exam's mark sheet straight away — used by
  // the teacher dashboard and the Results tab's "Correct marks" link.
  const searchParams = useSearchParams();
  const linkedExamId = searchParams.get('exam') ?? '';
  const linkedTermId = searchParams.get('term') ?? '';

  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [exams, setExams] = useState<ExamSlot[]>([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [filterGradeId, setFilterGradeId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');
  // Once an exam is chosen the pickers fold into one summary line so the
  // mark sheet gets the screen; "Change" opens them again.
  const [pickerOpen, setPickerOpen] = useState(true);
  const [lastExam, setLastExam] = useState<LastExam | null>(null);

  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [allGrades, setAllGrades] = useState<GradeItem[]>([]);
  const [mySubjects, setMySubjects] = useState<MySubjectItem[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubjectId, setCreateSubjectId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<EntryMode>('manual');
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [schemeVersion, setSchemeVersion] = useState(0); // bump to remount the sheet after the paper set-up changes
  const [examScheme, setExamScheme] = useState<ExamSubjectComponentScheme | null>(null);

  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // An exam to open once its term's exams have loaded.
  const pendingExamRef = useRef<{ termId: string; examId: string } | null>(null);
  const handledLinkRef = useRef('');

  // Tap-to-open menu (not CSS :hover, which never fires on touch screens).
  useEffect(() => {
    if (!showMoreMenu) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMoreMenu(false); };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreMenu]);

  // Read after mount: localStorage is not available during server render.
  useEffect(() => {
     
    setLastExam(readLastExam());
  }, []);

  const gradeLevelMap = new Map(allGrades.map(g => [g.id, g.academic_level_id]));

  // ── Academic structure (levels + grades) ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/academic-structure', { cache: 'no-store' });
        const data = (await res.json()) as { academic_levels?: AcademicLevel[]; grades?: GradeItem[] };
        setAcademicLevels(data.academic_levels ?? []);
        setAllGrades(data.grades ?? []);
      } catch (err) { console.error('Failed to fetch academic structure:', err); }
    })();
  }, []);

  // ── A teacher's assigned subjects ──
  useEffect(() => {
    if (!profile?.role || profile.role === 'ADMIN') return;
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=my_subjects', { cache: 'no-store' });
        const json = (await res.json()) as { data?: MySubjectItem[] };
        setMySubjects(json.data ?? []);
      } catch (err) { console.error('Failed to fetch my subjects:', err); }
    })();
  }, [profile?.role]);

  // ── Terms: open the linked term, else the active one ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/data?type=terms', { cache: 'no-store' });
        const json = (await res.json()) as { data?: Term[] };
        const termList = json.data ?? [];
        setTerms(termList);
        const linkedTermExists = !!linkedTermId && termList.some(t => t.id === linkedTermId);
        const initial = linkedTermExists ? linkedTermId : findActiveTermId(termList) ?? termList[0]?.id ?? '';
        if (linkedExamId && initial) {
          pendingExamRef.current = { termId: initial, examId: linkedExamId };
          handledLinkRef.current = `${linkedTermId}:${linkedExamId}`;
        }
        setSelectedTermId(initial);
      } catch (err) { console.error('Failed to fetch terms:', err); }
      setLoadingTerms(false);
    })();
    // Runs once: later link changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedExamType('');
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedLevelId('');
    setFilterGradeId('');
    setPickerOpen(true);
  }, []);

  const applyExam = useCallback((exam: ExamSlot) => {
    setSelectedExamType(exam.exam_type);
    setSelectedLevelId('');
    setFilterGradeId(exam.grade_id);
    setSelectedSubjectId(exam.subject_id);
    setSelectedExamId(exam.id);
    setPickerOpen(false);
  }, []);

  // ── Exams for the selected term; open a pending exam once they arrive ──
  useEffect(() => {
    if (!selectedTermId) return;
    let cancelled = false;
     
    setLoadingExams(true);
    (async () => {
      let list: ExamSlot[] = [];
      try { list = await fetchTermExams(selectedTermId); } catch (err) { console.error('Failed to fetch exams:', err); }
      if (cancelled) return;
      setExams(list);
      const pending = pendingExamRef.current;
      const target = pending?.termId === selectedTermId ? list.find(e => e.id === pending.examId) : undefined;
      if (pending?.termId === selectedTermId) pendingExamRef.current = null;
      if (target) applyExam(target); else resetSelection();
      setLoadingExams(false);
    })();
    return () => { cancelled = true; };
  }, [selectedTermId, applyExam, resetSelection]);

  const reloadExams = async () => {
    if (!selectedTermId) return;
    try { setExams(await fetchTermExams(selectedTermId)); } catch (err) { console.error('Failed to fetch exams:', err); }
  };

  const openExam = useCallback((termId: string, examId: string) => {
    if (termId === selectedTermId) {
      const exam = exams.find(e => e.id === examId);
      if (exam) applyExam(exam);
      return;
    }
    pendingExamRef.current = { termId, examId };
    setSelectedTermId(termId);
  }, [selectedTermId, exams, applyExam]);

  // A new deep link while this tab is already open.
  useEffect(() => {
    if (!linkedExamId || loadingTerms) return;
    const key = `${linkedTermId}:${linkedExamId}`;
    if (handledLinkRef.current === key) return;
    handledLinkRef.current = key;
    openExam(linkedTermId || selectedTermId, linkedExamId);
  }, [linkedExamId, linkedTermId, loadingTerms, openExam, selectedTermId]);

  // ── Derived choices ──
  const existingTypes = new Set(exams.map(e => e.exam_type));
  const availableExamTypes = ALL_EXAM_TYPES.filter(et => existingTypes.has(et.code));
  const examsByType = exams.filter(e => e.exam_type === selectedExamType);

  // Teachers only see the classes they have exams in; an admin sees every
  // class, since they can create an exam for one that has none yet.
  const gradesWithExams = new Set(examsByType.map(e => e.grade_id));
  const availableGrades = allGrades
    .filter(g => !selectedLevelId || g.academic_level_id === selectedLevelId)
    .filter(g => isAdmin || gradesWithExams.has(g.id))
    .sort((a, b) => a.name_display.localeCompare(b.name_display, undefined, { numeric: true }));
  // With only one class to choose from, it is chosen.
  const effectiveGradeId = filterGradeId || (availableGrades.length === 1 ? availableGrades[0].id : '');

  const filteredExamsByType = examsByType
    .filter(e => !selectedLevelId || gradeLevelMap.get(e.grade_id) === selectedLevelId)
    .filter(e => !effectiveGradeId || e.grade_id === effectiveGradeId);
  // Keeps subjects from other bands of the same curriculum out of the picker —
  // CBC shares one academic level from Pre-Primary to Grade 12.
  const filterGrade = effectiveGradeId ? allGrades.find(g => g.id === effectiveGradeId) ?? null : null;

  const subjectMap = new Map<string, SubjectChoice>();
  for (const e of filteredExamsByType) {
    if (!subjectMap.has(e.subject_id) && isSubjectOfferedAtGrade({ name: e.subject_name, code: e.subject_code }, filterGrade)) {
      subjectMap.set(e.subject_id, { subject_id: e.subject_id, subject_name: e.subject_name, subject_code: e.subject_code, subject_category: e.subject_category, hasExam: true });
    }
  }
  const resolvedFilterLevelId = effectiveGradeId ? gradeLevelMap.get(effectiveGradeId) ?? '' : selectedLevelId;
  for (const ms of mySubjects) {
    if (subjectMap.has(ms.id)) continue;
    if (resolvedFilterLevelId && ms.academic_level_id !== resolvedFilterLevelId) continue;
    if (!isSubjectOfferedAtGrade(ms, filterGrade)) continue;
    subjectMap.set(ms.id, { subject_id: ms.id, subject_name: ms.name, subject_code: ms.code, subject_category: ms.category ?? '', hasExam: false });
  }
  const subjects = [...subjectMap.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  const subjectNeedle = subjectQuery.trim().toLowerCase();
  const shownSubjects = subjectNeedle
    ? subjects.filter(s => s.subject_name.toLowerCase().includes(subjectNeedle) || s.subject_code.toLowerCase().includes(subjectNeedle))
    : subjects;

  const subjectGroups: [string, SubjectChoice[]][] = (() => {
    const map = new Map<string, SubjectChoice[]>();
    for (const s of shownSubjects) {
      const cat = (s.subject_category || 'OTHER').toUpperCase();
      const key = CATEGORY_ORDER[cat] ? cat : 'OTHER';
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort((a, b) => (CATEGORY_ORDER[a[0]] ?? 99) - (CATEGORY_ORDER[b[0]] ?? 99));
  })();

  const examsForSelectedSubject = exams
    .filter(e => e.exam_type === selectedExamType && e.subject_id === selectedSubjectId)
    .filter(e => !effectiveGradeId || e.grade_id === effectiveGradeId)
    .sort((a, b) => (a.grade_stream_name ?? a.grade_name).localeCompare(b.grade_stream_name ?? b.grade_name));

  // Only one exam type in the term → select it.
  useEffect(() => {
    if (loadingExams || selectedExamType) return;
    const types = [...new Set(exams.map(e => e.exam_type))];
     
    if (types.length === 1) setSelectedExamType(types[0]);
  }, [loadingExams, exams, selectedExamType]);

  // An explicit pick only counts while it still belongs to the current
  // subject/class; otherwise fall back to the sole exam slot, if there is one.
  const soleExamId = examsForSelectedSubject.length === 1 ? examsForSelectedSubject[0].id : '';
  const effectiveSelectedExamId = examsForSelectedSubject.some(e => e.id === selectedExamId) ? selectedExamId : soleExamId;
  const selectedExam = exams.find(e => e.id === effectiveSelectedExamId);
  const showSheet = !!selectedExam && !pickerOpen;

  // ── Paper set-up for the selected exam ──
  useEffect(() => {
    if (!effectiveSelectedExamId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/school/exams/${effectiveSelectedExamId}/components`, { cache: 'no-store' });
        const json = (await res.json()) as { data?: ExamSubjectComponentScheme | null };
        if (!cancelled) setExamScheme(json.data ?? null);
      } catch {
        if (!cancelled) setExamScheme(null);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveSelectedExamId, schemeVersion]);

  const examIsMultiPaper = !!effectiveSelectedExamId && isMultiPaper(examScheme);
  const examPaperSummary = examIsMultiPaper
    ? (examScheme?.components ?? []).map(c => `${c.component_code}/${Number(c.max_score)}`).join(' + ')
    : '';

  const selectedTermName = terms.find(t => t.id === selectedTermId)?.name ?? '';
  const activeTermId = findActiveTermId(terms);
  const selectedClassName = selectedExam ? selectedExam.grade_stream_name || selectedExam.grade_name : '';

  // Remember the open exam so the next visit can resume it in one tap.
  useEffect(() => {
    if (!selectedExam || pickerOpen) return;
    const value: LastExam = {
      termId: selectedExam.term_id,
      examId: selectedExam.id,
      label: `${selectedExam.subject_name} · ${selectedExam.grade_stream_name || selectedExam.grade_name} · ${getExamTypeLabel(selectedExam.exam_type)}`,
    };
    writeLastExam(value);
     
    setLastExam(value);
  }, [selectedExam, pickerOpen]);

  const chooseSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedExamId('');
    const slots = exams.filter(e => e.exam_type === selectedExamType && e.subject_id === subjectId && (!effectiveGradeId || e.grade_id === effectiveGradeId));
    if (slots.length === 1) setPickerOpen(false);
  };

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
        body: JSON.stringify({ action: 'seed', termId: selectedTermId, academicYearId: term?.academic_year_id, examTypes }),
      });
      const json = (await res.json()) as { created?: number; skipped?: number; error?: string };
      if (res.ok) {
        setSeedMsg({ type: 'success', text: `Created ${json.created ?? 0} exam slots (${json.skipped ?? 0} already existed).` });
        await reloadExams();
      } else {
        setSeedMsg({ type: 'error', text: json.error ?? 'Failed to set up exams' });
      }
    } catch { setSeedMsg({ type: 'error', text: 'Failed to set up exams' }); }
    setSeeding(false);
  };

  const lastExamAvailable = !!lastExam && terms.some(t => t.id === lastExam.termId) && lastExam.examId !== selectedExam?.id;

  /* ── Folded view: the chosen exam and its mark sheet ── */
  if (showSheet && selectedExam) {
    return (
      <div className="w-full">
        <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Entering marks for</p>
            <h2 className="mt-1 truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
              {selectedExam.subject_name} <span className="text-muted-foreground">·</span> {selectedClassName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTermName} · {getExamTypeLabel(selectedExam.exam_type)} · {examIsMultiPaper ? <span className="font-medium text-primary">Papers {examPaperSummary}</span> : <>Out of {selectedExam.max_score}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPaperModal(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                examIsMultiPaper ? 'border-primary/40 bg-primary/10 text-primary' : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
              title="Some subjects are examined in several papers (e.g. Maths Paper 1 & 2, Sciences with a practical). Set that up here — the papers combine into one final subject score."
            >
              <Layers size={14} aria-hidden />
              {examIsMultiPaper ? `Papers: ${(examScheme?.components ?? []).map(c => c.component_code).join(' + ')}` : 'Split into papers'}
            </button>
            <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40">
              <RefreshCw size={14} aria-hidden /> Change exam, class or subject
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1 sm:inline-grid sm:w-auto" role="tablist" aria-label="How to enter marks">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
                mode === m.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.icon}<span className="truncate">{m.label}</span>
            </button>
          ))}
        </div>

        {mode === 'manual' && (
          <ManualEntryGrid
            key={`${effectiveSelectedExamId}-${schemeVersion}`}
            examId={effectiveSelectedExamId}
            maxScore={selectedExam.max_score}
            gradeId={selectedExam.grade_id}
            gradeStreamId={selectedExam.grade_stream_id ?? null}
            subjectId={selectedExam.subject_id}
          />
        )}
        {mode === 'bulk' && <BulkUpload examId={effectiveSelectedExamId} subjectId={selectedExam.subject_id} />}
        {mode === 'scan' && (
          <>
            {examIsMultiPaper && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                This subject uses several papers. Scanning records <strong>final scores only</strong> — use <em>Type marks</em> for per-paper scores.
              </div>
            )}
            <ScanSheet
              key={`scan-${effectiveSelectedExamId}`}
              examId={effectiveSelectedExamId}
              maxScore={selectedExam.max_score}
              gradeId={selectedExam.grade_id}
              gradeStreamId={selectedExam.grade_stream_id ?? null}
              subjectId={selectedExam.subject_id}
            />
          </>
        )}

        {showPaperModal && (
          <PaperSchemeModal
            examId={effectiveSelectedExamId}
            subjectName={selectedExam.subject_name}
            onClose={() => setShowPaperModal(false)}
            onSaved={() => setSchemeVersion(v => v + 1)}
          />
        )}
      </div>
    );
  }

  /* ── Pickers ── */
  return (
    <div className="flex w-full flex-col gap-4">
      {lastExamAvailable && lastExam && (
        <button
          type="button"
          onClick={() => openExam(lastExam.termId, lastExam.examId)}
          className="group flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><History size={18} aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-muted-foreground">Pick up where you left off</span>
            <span className="block truncate text-sm font-semibold text-foreground">{lastExam.label}</span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      )}

      {/* ① Term */}
      <StepCard step={1} title="Term" done={!!selectedTermId}>
        {loadingTerms ? (
          <p className="text-xs text-muted-foreground">Loading terms…</p>
        ) : terms.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">No terms found. Ask your admin to set up the academic calendar.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {terms.map(t => (
              <ChoiceChip key={t.id} active={selectedTermId === t.id} onClick={() => setSelectedTermId(t.id)}>
                {t.name}
                {t.id === activeTermId && (
                  <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', selectedTermId === t.id ? 'bg-white/20' : 'bg-primary/10 text-primary')}>NOW</span>
                )}
              </ChoiceChip>
            ))}
          </div>
        )}
      </StepCard>

      {/* ② Exam */}
      {selectedTermId && (
        <StepCard step={2} title="Exam" hint={loadingExams ? 'Loading…' : undefined} done={!!selectedExamType}>
          {!loadingExams && availableExamTypes.length === 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                No exams set up yet for <strong className="text-foreground">{selectedTermName}</strong>.
                {!isAdmin && ' Ask your admin to set up exams for this term.'}
              </p>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => handleSeedExams(STANDARD_TERM_EXAMS)} disabled={seeding} className="btn-primary px-4 py-2">
                    {seeding ? 'Setting up…' : 'Set up this term’s exams'}
                  </button>
                  <button type="button" onClick={() => handleSeedExams(ALL_EXAM_TYPES.map(e => e.code))} disabled={seeding} className="text-xs text-primary hover:underline">
                    Need every exam type instead?
                  </button>
                </div>
              )}
            </div>
          ) : !loadingExams ? (
            <div className="flex flex-wrap items-center gap-2">
              {availableExamTypes.map(et => (
                <ChoiceChip
                  key={et.code}
                  active={selectedExamType === et.code}
                  onClick={() => { setSelectedExamType(et.code); setSelectedSubjectId(''); setSelectedExamId(''); }}
                  title={et.description}
                >
                  <span aria-hidden>{et.icon}</span> {et.shortName}
                </ChoiceChip>
              ))}

              {isAdmin && (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(v => !v)}
                    aria-expanded={showMoreMenu}
                    className={cn(
                      'inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs font-medium transition-colors',
                      showMoreMenu ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    <Settings2 size={14} aria-hidden /> More <ChevronDown size={12} aria-hidden />
                  </button>
                  {showMoreMenu && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-[60vh] w-64 max-w-[90vw] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
                      {ALL_EXAM_TYPES.filter(et => !existingTypes.has(et.code)).map(et => (
                        <button
                          key={et.code}
                          type="button"
                          onClick={() => { void handleSeedExams([et.code]); setShowMoreMenu(false); }}
                          disabled={seeding}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          + {et.icon} {et.name}
                          <span className="mt-0.5 block text-[10px] opacity-70">{et.description}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => { void handleSeedExams(Array.from(existingTypes)); setShowMoreMenu(false); }}
                        disabled={seeding}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        {seeding ? 'Working…' : 'Add exams for any new subjects'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowCreateModal(true); setShowMoreMenu(false); }}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
            <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', seedMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400')}>
              {seedMsg.text}
            </p>
          )}
        </StepCard>
      )}

      {/* ③ Class */}
      {selectedExamType && (
        <StepCard step={3} title="Class" done={!!effectiveGradeId} hint={!isAdmin ? 'Only classes you have exams for are listed' : undefined}>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            {academicLevels.length > 1 && (
              <select
                className="input-field h-10 text-sm sm:w-48"
                value={selectedLevelId}
                onChange={e => { setSelectedLevelId(e.target.value); setFilterGradeId(''); setSelectedSubjectId(''); setSelectedExamId(''); }}
                aria-label="Curriculum level"
              >
                <option value="">All levels</option>
                {academicLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <select
              className="input-field h-10 text-sm sm:w-56"
              value={effectiveGradeId}
              onChange={e => { setFilterGradeId(e.target.value); setSelectedSubjectId(''); setSelectedExamId(''); }}
              aria-label="Class"
            >
              <option value="">Choose a class…</option>
              {availableGrades.map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
            </select>
            {availableGrades.length === 0 && (
              <span className="text-xs text-muted-foreground">No classes have a {getExamTypeLabel(selectedExamType)} exam this term.</span>
            )}
          </div>
        </StepCard>
      )}

      {/* ④ Subject */}
      {selectedExamType && effectiveGradeId && (
        <StepCard
          step={4}
          title="Subject"
          done={!!selectedSubjectId}
          hint={`${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
          aside={subjects.length > 8 ? (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={subjectQuery}
                onChange={e => setSubjectQuery(e.target.value)}
                placeholder="Find a subject"
                aria-label="Find a subject"
                className="h-9 w-44 rounded-lg border border-border bg-background pl-8 pr-2 text-sm outline-none focus:border-primary sm:w-56"
              />
            </div>
          ) : undefined}
        >
          {subjects.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">No subjects found for this class.</p>
          ) : shownSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subject matches &ldquo;{subjectQuery}&rdquo;.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {subjectGroups.map(([category, groupSubjects]) => (
                <div key={category}>
                  {subjectGroups.length > 1 && (
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{CATEGORY_LABELS[category] ?? category}</h4>
                  )}
                  <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {groupSubjects.map(s => {
                      const active = selectedSubjectId === s.subject_id;
                      if (!s.hasExam) {
                        return (
                          <div key={s.subject_id} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border/70 px-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-muted-foreground">{s.subject_name}</span>
                              <span className="block text-[11px] text-muted-foreground/80">No exam set up yet</span>
                            </span>
                            {isAdmin && (
                              <button type="button" onClick={() => { setCreateSubjectId(s.subject_id); setShowCreateModal(true); }} className="shrink-0 text-xs font-semibold text-primary hover:underline">
                                + Create
                              </button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={s.subject_id}
                          type="button"
                          onClick={() => chooseSubject(s.subject_id)}
                          aria-pressed={active}
                          className={cn(
                            'group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                            active ? 'border-primary bg-primary/10' : 'border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.03]',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">{s.subject_name}</span>
                            <span className="block font-mono text-[10px] text-muted-foreground">{s.subject_code}</span>
                          </span>
                          <ArrowRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </StepCard>
      )}

      {/* ⑤ Only when the subject has several exam slots in this class (e.g. one per stream) */}
      {selectedSubjectId && examsForSelectedSubject.length > 1 && (
        <StepCard step={5} title="Which one?" hint={`This subject has ${examsForSelectedSubject.length} exams in this class`} done={!!selectedExamId}>
          <div className="flex flex-wrap gap-2">
            {examsForSelectedSubject.map(exam => (
              <ChoiceChip key={exam.id} active={effectiveSelectedExamId === exam.id} onClick={() => { setSelectedExamId(exam.id); setPickerOpen(false); }}>
                {exam.grade_stream_name || exam.name || exam.grade_name}
              </ChoiceChip>
            ))}
          </div>
        </StepCard>
      )}
      {selectedSubjectId && examsForSelectedSubject.length === 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm text-amber-700 dark:text-amber-400">No exam found for this subject in the selected class.</p>
      )}

      {selectedExam && pickerOpen && (
        <button type="button" onClick={() => setPickerOpen(false)} className="btn-primary inline-flex items-center justify-center gap-2 self-start px-5 py-2.5">
          Open mark sheet <ArrowRight size={16} aria-hidden />
        </button>
      )}

      {showCreateModal && (
        <CreateExamModal
          onClose={() => { setShowCreateModal(false); setCreateSubjectId(undefined); }}
          onCreated={() => {
            setShowCreateModal(false);
            setCreateSubjectId(undefined);
            void reloadExams();
          }}
          preselectedSubjectId={createSubjectId}
        />
      )}
    </div>
  );
}
