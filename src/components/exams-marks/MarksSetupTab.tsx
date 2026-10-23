"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, History, Lock, Search } from 'lucide-react';
import { ManualEntryGrid } from '@/components/marks/ManualEntryGrid';
import { BulkUpload } from '@/components/marks/BulkUpload';
import { ScanSheet } from '@/components/marks/ScanSheet';
import { CreateExamModal } from '@/components/marks/CreateExamModal';
import { PaperSchemeModal } from '@/components/marks/PaperSchemeModal';
import { isMultiPaper } from '@/lib/multi-paper';
import type { ExamSubjectComponentScheme } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { ALL_EXAM_TYPES, STANDARD_TERM_EXAMS, getExamTypeLabel, isAnytimeExamType } from '@/lib/exam-types';
import type { ExamWindowsResponse } from '@/lib/exam-windows';
import { findActiveTermId } from '@/lib/term-calendar';
import { localToday } from '@/lib/assignments';
import { currentExamType, examDay, examTypeDates, examTypeOrder } from '@/lib/exam-schedule';
import { isSubjectOfferedAtGrade } from '@/lib/curriculum-bands';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ExamSetupMenu } from './ExamSetupMenu';
import { ExamWindowsPanel } from './ExamWindowsPanel';
import { MarkingProgressBoard } from './MarkingProgressBoard';
import { TermLockCard } from './TermLockCard';
import { SUBJECT_CATEGORY_THEME, subjectCategory, type SubjectCategory } from './examTheme';
import {
  COLUMN_CLASS, balanceColumns, fetchTermExams, loadSubjects, readLastExam, windowMap, writeLastExam,
  type AcademicLevel, type EntryMode, type ExamSlot, type GradeItem, type LastExam, type MySubjectItem, type SubjectChoice, type Term,
} from './mark-setup/model';
import { ChoiceChip, ExamTiming, LoadError, RequestExamNotice, StepCard } from './mark-setup/parts';
import { SheetHeader } from './mark-setup/SheetHeader';
import { OutOfTurnNotice } from './mark-setup/OutOfTurnNotice';
import { MarkingNowCard } from './mark-setup/MarkingNowCard';




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
  // Exams outside the open one that the teacher has confirmed they mean to mark.
  const [confirmedEarly, setConfirmedEarly] = useState<ReadonlySet<string>>(new Set());
  // The exam each class is marking now (grade id → exam type), and for those
  // who can open exams, every class and who is waiting.
  const [windowInfo, setWindowInfo] = useState<ExamWindowsResponse | null>(null);
  const [windowsVersion, setWindowsVersion] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  // A teacher choosing an exam themselves: corrections, CATs, another term.
  const [pickAnyExam, setPickAnyExam] = useState(false);

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
  const [termsError, setTermsError] = useState('');
  const [examsError, setExamsError] = useState('');
  const [examsReloadToken, setExamsReloadToken] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // An exam to open once its term's exams have loaded.
  const pendingExamRef = useRef<{ termId: string; examId: string } | null>(null);
  const handledLinkRef = useRef('');


  // Read after mount: localStorage is not available during server render.
  useEffect(() => {
     
    setLastExam(readLastExam());
  }, []);

  const gradeLevelMap = new Map(allGrades.map(g => [g.id, g.academic_level_id]));

  // Terms by academic year, newest year first: "Term 1" repeats every year.
  const termGroups = (() => {
    const groups = new Map<string, { yearId: string; yearName: string; terms: Term[] }>();
    for (const t of terms) {
      const group = groups.get(t.academic_year_id) ?? { yearId: t.academic_year_id, yearName: t.academic_year_name || 'Other', terms: [] };
      group.terms.push(t);
      groups.set(t.academic_year_id, group);
    }
    return [...groups.values()].reverse();
  })();

  // ── Academic structure (levels + grades) ──
  useEffect(() => {
    (async () => {
      try {
        // Only the curricula and grades this school has classes in.
        const res = await fetch('/api/admin/academic-structure?scope=school', { cache: 'no-store' });
        const data = (await res.json()) as { academic_levels?: AcademicLevel[]; grades?: GradeItem[] };
        setAcademicLevels(data.academic_levels ?? []);
        setAllGrades(data.grades ?? []);
      } catch (err) { console.error('Failed to fetch academic structure:', err); }
    })();
  }, []);

  // ── Subjects to offer beyond those with exams: a teacher's assigned ones.
  // An admin's are loaded per class further down. ──
  useEffect(() => {
    if (!profile?.role || isAdmin) return;
    void loadSubjects('/api/school/data?type=my_subjects').then(setMySubjects);
  }, [profile?.role, isAdmin]);

  // ── Terms: open the linked term, else the active one ──
  const loadTerms = useCallback(async () => {
      setLoadingTerms(true);
      setTermsError('');
      try {
        const res = await fetch('/api/school/data?type=terms', { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as { data?: Term[]; error?: string } | null;
        if (!res.ok) throw new Error(json?.error || 'Could not load terms.');
        const termList = json?.data ?? [];
        setTerms(termList);
        const linkedTermExists = !!linkedTermId && termList.some(t => t.id === linkedTermId);
        const initial = linkedTermExists ? linkedTermId : findActiveTermId(termList) ?? termList[0]?.id ?? '';
        if (linkedExamId && initial) {
          pendingExamRef.current = { termId: initial, examId: linkedExamId };
          handledLinkRef.current = `${linkedTermId}:${linkedExamId}`;
        }
        setSelectedTermId(prev => prev || initial);
      } catch (err) {
        setTermsError(err instanceof Error ? err.message : 'Could not load terms.');
      }
      setLoadingTerms(false);
    // Reads the deep link once: later link changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadTerms(); }, [loadTerms]);

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
      let failure = '';
      try { list = await fetchTermExams(selectedTermId); } catch (err) { failure = err instanceof Error ? err.message : 'Could not load this term’s exams.'; }
      if (cancelled) return;
      setExamsError(failure);
      setExams(list);
      const pending = pendingExamRef.current;
      const target = pending?.termId === selectedTermId ? list.find(e => e.id === pending.examId) : undefined;
      if (pending?.termId === selectedTermId) pendingExamRef.current = null;
      if (target) applyExam(target); else resetSelection();
      setLoadingExams(false);
    })();
    return () => { cancelled = true; };
  }, [selectedTermId, applyExam, resetSelection, examsReloadToken]);

  // ── The open exam per class for the selected term ──
  useEffect(() => {
    if (!selectedTermId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/school/exam-windows?term_id=${encodeURIComponent(selectedTermId)}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as ExamWindowsResponse | null;
        if (!cancelled) setWindowInfo(res.ok ? json : null);
      } catch {
        if (!cancelled) setWindowInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTermId, windowsVersion]);
  const windows = windowMap(windowInfo?.termId === selectedTermId ? windowInfo.data : []);
  const canOpenExams = windowInfo?.canOpen ?? false;
  const termLock = windowInfo?.termId === selectedTermId ? windowInfo.lock : null;
  const myRequests = new Set(windowInfo?.myRequests ?? []);

  /** Ask whoever opens exams to open one for these classes. */
  const requestExam = async (gradeIds: string[]) => {
    if (!selectedTermId || gradeIds.length === 0) return;
    setRequesting(true);
    setRequestError('');
    try {
      const res = await fetch('/api/school/exam-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: selectedTermId, gradeIds }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error || 'Could not send your request.');
      setWindowsVersion(v => v + 1);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not send your request.');
    }
    setRequesting(false);
  };

  const reloadExams = async () => {
    if (!selectedTermId) return;
    try { setExams(await fetchTermExams(selectedTermId)); setExamsError(''); } catch (err) { setExamsError(err instanceof Error ? err.message : 'Could not load this term’s exams.'); }
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
  const today = localToday();
  const typeDates = examTypeDates(exams.filter(e => !isAnytimeExamType(e.exam_type)));
  const openTypes = new Set(windows.values());
  // Until the school chooses, the exam the term is on is read from exam dates.
  const nowExamType = windows.size > 0 ? null : currentExamType(typeDates, today);
  const openTypeFor = (gradeId: string): string => windows.get(gradeId) ?? '';
  // Once the school has opened an exam, teachers skip choosing one: class →
  // subject → the open exam's sheet. "Another exam" brings the full picker back.
  const followOpen = !isAdmin && !pickAnyExam && windows.size > 0;
  const examsByType = exams.filter(e => e.exam_type === selectedExamType);

  // Teachers only see the classes they have exams in; an admin sees every
  // class, since they can create an exam for one that has none yet.
  const gradesWithExams = new Set((followOpen ? exams : examsByType).map(e => e.grade_id));
  const availableGrades = allGrades
    .filter(g => !selectedLevelId || g.academic_level_id === selectedLevelId)
    .filter(g => isAdmin || gradesWithExams.has(g.id))
    .sort((a, b) => a.name_display.localeCompare(b.name_display, undefined, { numeric: true }));
  // With only one class to choose from, it is chosen.
  const effectiveGradeId = filterGradeId || (availableGrades.length === 1 ? availableGrades[0].id : '');

  // For an admin, every subject the class takes, so one with no exams yet
  // (e.g. newly added Pre-primary areas) still lists its subjects. Per class:
  // a Senior School class only takes the electives its learners chose.
  useEffect(() => {
    if (!isAdmin || !effectiveGradeId) return;
    let cancelled = false;
    void loadSubjects(`/api/school/data?type=subjects&grade_id=${encodeURIComponent(effectiveGradeId)}`).then(list => { if (!cancelled) setMySubjects(list); });
    return () => { cancelled = true; };
  }, [isAdmin, effectiveGradeId]);

  // An exam opened on purpose (a link, "Other exams") wins; choosing a class
  // clears it, so the class's open exam takes over again.
  const effectiveExamType = followOpen ? selectedExamType || openTypeFor(effectiveGradeId) : selectedExamType;
  // A class the school hasn't opened an exam for: its teacher picks from that class's exams.
  const classExamTypes = availableExamTypes.filter(et => exams.some(e => e.grade_id === effectiveGradeId && e.exam_type === et.code));

  const filteredExamsByType = exams
    .filter(e => e.exam_type === effectiveExamType)
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

  // A subject added after this term's exams were set up has none yet. For an
  // admin, give it the term's exam types (seeding only fills gaps) instead of
  // making them create each one by hand; once per term, type and class.
  const autoFilledRef = useRef(new Set<string>());
  const missingExamSubjects = isAdmin && effectiveExamType && effectiveGradeId ? subjects.filter(s => !s.hasExam).length : 0;
  useEffect(() => {
    if (!missingExamSubjects || !selectedTermId) return;
    const key = `${selectedTermId}|${selectedExamType}|${effectiveGradeId}`;
    if (autoFilledRef.current.has(key)) return;
    autoFilledRef.current.add(key);
    const term = terms.find(t => t.id === selectedTermId);
    void fetch('/api/school/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', termId: selectedTermId, academicYearId: term?.academic_year_id, examTypes: [...existingTypes] }),
    }).then(res => (res.ok ? fetchTermExams(selectedTermId).then(setExams) : undefined)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the gap appears, keyed by the ref
  }, [missingExamSubjects, selectedTermId, selectedExamType, effectiveGradeId]);
  const subjectNeedle = subjectQuery.trim().toLowerCase();
  const shownSubjects = subjectNeedle
    ? subjects.filter(s => s.subject_name.toLowerCase().includes(subjectNeedle) || s.subject_code.toLowerCase().includes(subjectNeedle))
    : subjects;

  const subjectGroups: [SubjectCategory, SubjectChoice[]][] = (() => {
    const map = new Map<SubjectCategory, SubjectChoice[]>();
    for (const s of shownSubjects) {
      const key = subjectCategory(s.subject_category);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort((a, b) => SUBJECT_CATEGORY_THEME[a[0]].order - SUBJECT_CATEGORY_THEME[b[0]].order);
  })();

  // Subject categories in balanced columns (Tailwind's md and xl breakpoints).
  const isMd = useMediaQuery('(min-width: 768px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const subjectColumns = balanceColumns(
    subjectGroups,
    Math.min(subjectGroups.length, isXl ? 3 : isMd ? 2 : 1),
    // A heading weighs about half a card.
    ([, group]) => group.length + 0.5,
  );

  const examsForSelectedSubject = exams
    .filter(e => e.exam_type === effectiveExamType && e.subject_id === selectedSubjectId)
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

  const selectedTerm = terms.find(t => t.id === selectedTermId);
  const selectedTermName = selectedTerm
    ? `${selectedTerm.name}${termGroups.length > 1 && selectedTerm.academic_year_name ? ` ${selectedTerm.academic_year_name}` : ''}`
    : '';
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
    const slots = exams.filter(e => e.exam_type === effectiveExamType && e.subject_id === subjectId && (!effectiveGradeId || e.grade_id === effectiveGradeId));
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

  // Every exam of the term exists from day one, so an End-Term sheet is open
  // in week 5 and Mid-Term marks were landing in it. An exam that isn't the
  // one open for its class (or, before the school has chosen, isn't due yet)
  // is checked for marks before its sheet opens: an empty one asks first, one
  // with marks is a correction. Exams given any time skip this, and so does
  // the open exam — the usual path makes no extra request.
  const checkExam = (() => {
    if (!selectedExam || pickerOpen || isAnytimeExamType(selectedExam.exam_type) || confirmedEarly.has(selectedExam.id)) return '';
    const open = openTypeFor(selectedExam.grade_id);
    return (open ? selectedExam.exam_type !== open : selectedExam.exam_date > today) ? selectedExam.id : '';
  })();
  const [examHasMarks, setExamHasMarks] = useState<Readonly<Record<string, boolean>>>({});
  useEffect(() => {
    if (!checkExam || checkExam in examHasMarks) return;
    let live = true;
    fetch(`/api/school/exam-marks?exam_id=${encodeURIComponent(checkExam)}`, { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<{ data?: unknown[] }>) : null))
      // If the check fails, don't stand in the way of the sheet.
      .then(json => { if (live) setExamHasMarks(prev => ({ ...prev, [checkExam]: json ? (json.data?.length ?? 0) > 0 : true })); })
      .catch(() => { if (live) setExamHasMarks(prev => ({ ...prev, [checkExam]: true })); });
    return () => { live = false; };
  }, [checkExam, examHasMarks]);

  // A teacher's classes this term, each with their own subjects in the exam open there.
  const myClasses = allGrades
    .filter(g => exams.some(e => e.grade_id === g.id))
    .sort((a, b) => a.name_display.localeCompare(b.name_display, undefined, { numeric: true }))
    .map(g => {
      const type = openTypeFor(g.id);
      const subjectNames = [...new Set(exams.filter(e => e.grade_id === g.id && e.exam_type === type).map(e => e.subject_name))].sort();
      return { id: g.id, name: g.name_display, type, subjectNames };
    });
  // Classes with nothing open that this teacher hasn't asked about yet.
  const unaskedClasses = myClasses.filter(c => !c.type && !myRequests.has(c.id)).map(c => c.id);
  const subjectStep = followOpen ? (openTypeFor(effectiveGradeId) ? 2 : 3) : 4;

  const lastExamAvailable = !!lastExam && terms.some(t => t.id === lastExam.termId) && lastExam.examId !== selectedExam?.id;

  /* ── Folded view: the chosen exam and its mark sheet ── */
  if (showSheet && selectedExam) {
    const openType = openTypeFor(selectedExam.grade_id);
    const checking = checkExam === selectedExam.id && !(selectedExam.id in examHasMarks);
    const outOfTurn = checkExam === selectedExam.id && examHasMarks[selectedExam.id] === false;
    const siblings = exams
      .filter(e => e.id !== selectedExam.id && e.subject_id === selectedExam.subject_id && e.grade_id === selectedExam.grade_id && (e.grade_stream_id ?? null) === (selectedExam.grade_stream_id ?? null))
      .sort((a, b) => examTypeOrder(a.exam_type) - examTypeOrder(b.exam_type));
    const suggestedType = openType || nowExamType;
    const nowSlot = suggestedType ? siblings.find(e => e.exam_type === suggestedType) : undefined;
    const examLabel = getExamTypeLabel(selectedExam.exam_type);
    return (
      <div className="w-full">
        <SheetHeader
          exam={selectedExam}
          examLabel={examLabel}
          classLabel={selectedClassName}
          termName={selectedTermName}
          paperCodes={examIsMultiPaper ? (examScheme?.components ?? []).map(c => c.component_code) : null}
          paperSummary={examPaperSummary}
          mode={mode}
          onModeChange={setMode}
          siblings={siblings}
          openType={openType}
          onSetUpPapers={() => setShowPaperModal(true)}
          onChangeExam={() => setPickerOpen(true)}
          onPickSibling={e => { if (!isAdmin && e.exam_type !== openType) setPickAnyExam(true); applyExam(e); }}
        />

        {selectedExam.status === 'APPROVED' && (
          <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong className="font-semibold">These results are already released.</strong>{' '}
              Changes you save here show straight away on report cards and on the page parents open from the QR code.
              To make several corrections quietly, withdraw the results on the <em>Release Results</em> tab first.
            </p>
          </div>
        )}


        {checking ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted/60" aria-busy aria-label="Checking this exam" />
        ) : outOfTurn ? (
          <OutOfTurnNotice
            examLabel={examLabel}
            examDate={selectedExam.exam_date}
            classLabel={selectedClassName}
            openType={openType}
            nowSlot={nowSlot}
            onOpenNow={applyExam}
            onConfirm={() => setConfirmedEarly(prev => new Set(prev).add(selectedExam.id))}
          />
        ) : <>
        {mode === 'manual' && (
          <ManualEntryGrid
            key={`${effectiveSelectedExamId}-${schemeVersion}`}
            examId={effectiveSelectedExamId}
            maxScore={selectedExam.max_score}
            gradeId={selectedExam.grade_id}
            gradeStreamId={selectedExam.grade_stream_id ?? null}
            subjectId={selectedExam.subject_id}
            subjectName={selectedExam.subject_name}
            released={selectedExam.status === 'APPROVED'}
            locked={!!termLock}
            onReleased={() => setExams(prev => prev.map(e => (e.id === selectedExam.id ? { ...e, status: 'APPROVED' } : e)))}
          />
        )}
        {mode === 'bulk' && <BulkUpload examId={effectiveSelectedExamId} subjectId={selectedExam.subject_id} gradeStreamId={selectedExam.grade_stream_id ?? null} gradeId={selectedExam.grade_id} />}
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
        </>}

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

      {/* Admins, the principal, deputy, DOS and exams officer (marking.open). */}
      {canOpenExams && windowInfo && windowInfo.termId === selectedTermId && windowInfo.classes.length > 0 && (
        <ExamWindowsPanel
          key={selectedTermId}
          termId={selectedTermId}
          termName={selectedTermName}
          classes={windowInfo.classes}
          windows={windows}
          requests={windowInfo.requests}
          onSaved={(rows, created) => {
            // Shown straight away; answered requests drop off.
            setWindowInfo(prev => prev && {
              ...prev,
              data: rows,
              requests: prev.requests.filter(r => !rows.some(w => w.grade_id === r.grade_id)),
            });
            // A newly opened exam created papers: reload what lists them.
            if (created > 0) {
              setWindowsVersion(v => v + 1);
              void reloadExams();
            }
          }}
          onDateSaved={({ gradeIds, examType, date }) => {
            setWindowInfo(prev => prev && {
              ...prev,
              classes: prev.classes.map(c => (gradeIds.includes(c.grade_id) ? { ...c, dates: { ...c.dates, [examType]: date } } : c)),
            });
            // Which exam is "due" follows the papers' dates.
            void reloadExams();
          }}
        />
      )}

      {/* Who is behind on the open exams, for whoever opens them. */}
      {canOpenExams && windows.size > 0 && (
        <MarkingProgressBoard
          termId={selectedTermId}
          termName={selectedTermName}
          version={[...windows].map(([g, t]) => `${g}:${t}`).sort().join(',')}
          onOpenExam={openExam}
        />
      )}

      {/* Lock a finished term's marks; unlock it for a correction. */}
      {canOpenExams && windowInfo?.termId === selectedTermId && (
        <TermLockCard
          key={`lock-${selectedTermId}`}
          termId={selectedTermId}
          termName={selectedTermName}
          lock={termLock}
          onChange={lock => setWindowInfo(prev => prev && { ...prev, lock })}
        />
      )}
      {!canOpenExams && termLock && (
        <p className="flex items-center gap-2 rounded-xl border border-slate-500/30 bg-slate-500/[0.06] px-4 py-3 text-sm text-foreground">
          <Lock size={16} className="shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
          {selectedTermName} marks are locked. You can view them; ask the admin or DOS to unlock the term to change one.
        </p>
      )}

      {/* Nothing opened yet anywhere: a teacher can ask for it instead of guessing. */}
      {!isAdmin && !canOpenExams && windows.size === 0 && myClasses.length > 0 && selectedTermId === activeTermId && (
        <RequestExamNotice
          title="Your school hasn’t chosen which exam is being marked"
          asked={unaskedClasses.length === 0}
          busy={requesting}
          error={requestError}
          onRequest={() => void requestExam(unaskedClasses)}
        />
      )}

      {!isAdmin && pickAnyExam && windows.size > 0 && (
        <button type="button" onClick={() => { setPickAnyExam(false); resetSelection(); }} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={15} aria-hidden /> Back to the exam open for marking
        </button>
      )}

      {followOpen ? (
        <>
        <div className="grid gap-3 lg:grid-cols-2">
          <MarkingNowCard
            termName={selectedTermName}
            classes={myClasses}
            asked={myRequests}
            onPickAny={() => { setPickAnyExam(true); resetSelection(); }}
          />

          <StepCard step={1} title="Class" done={!!effectiveGradeId} hint="Classes you have exams for">
            {loadingExams ? <p className="text-xs text-muted-foreground">Loading…</p> : examsError ? (
              <LoadError message={examsError} onRetry={() => setExamsReloadToken(t => t + 1)} />
            ) : availableGrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no exams this term. Ask your admin if that looks wrong.</p>
            ) : (
              <select
                className="input-field h-10 w-full text-sm"
                value={effectiveGradeId}
                onChange={e => { setFilterGradeId(e.target.value); setSelectedExamType(''); setSelectedSubjectId(''); setSelectedExamId(''); }}
                aria-label="Class"
              >
                <option value="">Choose a class…</option>
                {availableGrades.map(g => {
                  const type = openTypeFor(g.id);
                  return <option key={g.id} value={g.id}>{g.name_display} — {type ? getExamTypeLabel(type) : 'choose the exam'}</option>;
                })}
              </select>
            )}
          </StepCard>
        </div>

        {effectiveGradeId && !openTypeFor(effectiveGradeId) && (
          <StepCard step={2} title="Exam" hint="Your school hasn’t opened an exam for this class yet" done={!!selectedExamType}>
            <RequestExamNotice
              title="Not sure which exam this is?"
              asked={myRequests.has(effectiveGradeId)}
              busy={requesting}
              error={requestError}
              onRequest={() => void requestExam([effectiveGradeId])}
            />
            <p className="mb-2 mt-3 text-xs text-muted-foreground">Or choose it yourself:</p>
            <div className="flex flex-wrap gap-2">
              {classExamTypes.map(et => (
                <ChoiceChip key={et.code} active={selectedExamType === et.code} onClick={() => { setSelectedExamType(et.code); setSelectedSubjectId(''); setSelectedExamId(''); }} title={et.description}>
                  <span aria-hidden>{et.icon}</span> {et.shortName}
                  <ExamTiming active={selectedExamType === et.code} isNow={false} anytime={isAnytimeExamType(et.code)} date={typeDates.get(et.code)} today={today} />
                </ChoiceChip>
              ))}
            </div>
          </StepCard>
        )}
        </>
      ) : (
      <>
      {/* The card above sets the exam for teachers; these steps are for marking yourself. */}
      {canOpenExams && windowInfo?.classes.length ? (
        <h3 className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Enter or correct marks yourself</h3>
      ) : null}
      {/* ①–③ side by side from lg: each holds only a few controls. */}
      <div className="grid gap-3 lg:grid-cols-3">
      {/* ① Term */}
      <StepCard step={1} title="Term" done={!!selectedTermId}>
        {loadingTerms ? (
          <p className="text-xs text-muted-foreground">Loading terms…</p>
        ) : termsError ? (
          <LoadError message={termsError} onRetry={() => void loadTerms()} />
        ) : terms.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">No terms found. Ask your admin to set up the academic calendar.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {termGroups.map(group => (
              <div key={group.yearId} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                {termGroups.length > 1 && (
                  <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">{group.yearName}</span>
                )}
                <div className="flex flex-wrap gap-2">
                  {group.terms.map(t => (
                    <ChoiceChip key={t.id} active={selectedTermId === t.id} onClick={() => setSelectedTermId(t.id)}>
                      {t.name}
                      {t.id === activeTermId && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', selectedTermId === t.id ? 'bg-white/20' : 'bg-primary/10 text-primary')}>NOW</span>
                      )}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </StepCard>

      {/* ② Exam */}
        <StepCard step={2} title="Exam" hint={selectedTermId && loadingExams ? 'Loading…' : undefined} done={!!selectedExamType}>
          {!selectedTermId ? <p className="text-sm text-muted-foreground">Choose a term first.</p> : <>
          {!loadingExams && examsError ? (
            <LoadError message={examsError} onRetry={() => setExamsReloadToken(t => t + 1)} />
          ) : !loadingExams && availableExamTypes.length === 0 ? (
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
                  title={`${et.description}${typeDates.get(et.code) ? ` · scheduled ${examDay(typeDates.get(et.code)!)}` : ''}`}
                >
                  <span aria-hidden>{et.icon}</span> {et.shortName}
                  <ExamTiming active={selectedExamType === et.code} isNow={openTypes.has(et.code) || et.code === nowExamType} anytime={isAnytimeExamType(et.code)} date={typeDates.get(et.code)} today={today} />
                </ChoiceChip>
              ))}

              {isAdmin && (
                <ExamSetupMenu
                  existingTypes={existingTypes}
                  seeding={seeding}
                  onAddRound={code => void handleSeedExams([code])}
                  onAddMissingSubjects={() => void handleSeedExams(Array.from(existingTypes))}
                  onCreateManually={() => setShowCreateModal(true)}
                />
              )}
            </div>
          ) : null}

          {seedMsg && (
            <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', seedMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400')}>
              {seedMsg.text}
            </p>
          )}
          </>}
        </StepCard>

      {/* ③ Class */}
        <StepCard step={3} title="Class" done={!!effectiveGradeId} hint={selectedExamType && !isAdmin ? 'Classes you have exams for' : undefined}>
          {!selectedExamType ? <p className="text-sm text-muted-foreground">Choose an exam first.</p> : (
          <div className="grid gap-2">
            {academicLevels.length > 1 && (
              <select
                className="input-field h-10 w-full text-sm"
                value={selectedLevelId}
                onChange={e => { setSelectedLevelId(e.target.value); setFilterGradeId(''); setSelectedSubjectId(''); setSelectedExamId(''); }}
                aria-label="Curriculum level"
              >
                <option value="">All levels</option>
                {academicLevels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <select
              className="input-field h-10 w-full text-sm"
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
          )}
        </StepCard>
      </div>
      </>
      )}

      {/* ④ Subject */}
      {effectiveExamType && effectiveGradeId && (
        <StepCard
          step={subjectStep}
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
            // Categories differ a lot in size. A grid row is as tall as its
            // biggest group, and CSS columns can't split a group, so each
            // category goes to whichever column is shortest so far.
            <div className={cn('grid gap-x-4 gap-y-5', COLUMN_CLASS[subjectColumns.length])}>
              {subjectColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="flex min-w-0 flex-col gap-5">
              {column.map(([category, groupSubjects]) => {
                const theme = SUBJECT_CATEGORY_THEME[category];
                const CategoryIcon = theme.icon;
                return (
                <div key={category}>
                  {subjectGroups.length > 1 && (
                    <h4 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <span aria-hidden className={cn('size-2 rounded-full', theme.tone.dot)} />
                      {theme.label}
                      <span className="font-normal normal-case tracking-normal opacity-70">{groupSubjects.length}</span>
                    </h4>
                  )}
                  <div className={cn('grid grid-cols-1 gap-2', subjectGroups.length === 1 && 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
                    {groupSubjects.map(s => {
                      const active = selectedSubjectId === s.subject_id;
                      if (!s.hasExam) {
                        return (
                          <div key={s.subject_id} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border/70 px-3 py-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground/70" aria-hidden><CategoryIcon className="size-4" /></span>
                            <span className="min-w-0 flex-1">
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
                            'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? theme.tone.selected : cn('border-border/70 bg-card', theme.tone.hover),
                          )}
                        >
                          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', theme.tone.tile)} aria-hidden><CategoryIcon className="size-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{s.subject_name}</span>
                            <span className="block font-mono text-[10px] text-muted-foreground">{s.subject_code}</span>
                          </span>
                          <ArrowRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
              </div>
              ))}
            </div>
          )}
        </StepCard>
      )}

      {/* ⑤ Only when the subject has several exam slots in this class (e.g. one per stream) */}
      {selectedSubjectId && examsForSelectedSubject.length > 1 && (
        <StepCard step={subjectStep + 1} title="Which one?" hint={`This subject has ${examsForSelectedSubject.length} exams in this class`} done={!!selectedExamId}>
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







