"use client";

import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { FileText } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import { TermComparisonModal, type ComparisonTerm } from '@/components/reports/TermComparisonModal';
import { StudentCommentsSection, type CommentField, type StudentComment } from '@/components/reports/StudentCommentsSection';
import { SMSModal, type SMSResult } from '@/components/reports/SMSModal';
import { StudentPickerModal } from '@/components/reports/StudentPickerModal';
import { ReportActionCards } from '@/components/reports/ReportActionCards';
import { ReportSettings } from '@/components/reports/ReportSettings';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useAuth } from '@/components/AuthProvider';
import type { ReportCardData } from '@/lib/pdfGenerator';
import { DEFAULT_TEMPLATE, type ReportTemplateId } from '@/lib/pdf/templateMeta';
import { findActiveTermId } from '@/lib/term-calendar';
import { MANAGED_STREAMS_URL, type ManagedStream } from '@/lib/managed-streams';
import type { ReportRound, ReportRoundsResponse } from '@/lib/reports/exam-round';
import { toRosterLearner, type RosterLearner } from '@/lib/reports/class-roster';
import { toast } from 'sonner';

interface AcademicYearOption { id: string; name: string }

type Dialog = 'student' | 'sms' | 'compare' | null;

/** A class's learners, loaded once per class and shared by the dialogs. */
type Roster = { streamId: string; learners: RosterLearner[] | null };

const sameComment = (a: StudentComment, b: StudentComment | undefined) =>
  !!b && a.comments_class_teacher === b.comments_class_teacher && a.comments_principal === b.comments_principal;

export default function ReportsPage() {
  const { schoolName, role } = useAuth();
  const splitId = useId();

  const [selectedGradeStream, setSelectedGradeStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [rounds, setRounds] = useState<ReportRound[] | null>([]);
  const [suggestedRound, setSuggestedRound] = useState<string | null>(null);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);
  const [generating, setGenerating] = useState(false);
  const [generatingMarkSheet, setGeneratingMarkSheet] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [gradeStreams, setGradeStreams] = useState<ManagedStream[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [terms, setTerms] = useState<ComparisonTerm[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [comments, setComments] = useState<StudentComment[] | null>(null);
  const [savedComments, setSavedComments] = useState<ReadonlyMap<string, StudentComment>>(new Map());
  const [savingComments, setSavingComments] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState<SMSResult | null>(null);
  const [hasCombinations, setHasCombinations] = useState(false);
  const [splitByCombination, setSplitByCombination] = useState(false);
  const [groupThreshold, setGroupThreshold] = useState(15);

  // The year comes with the term: the term picker groups terms by year.
  const selectedAcademicYear = terms.find(t => t.id === selectedTerm)?.academic_year_id ?? '';
  // The exam is part of the scope: every document states the round it shows.
  const isConfigured = Boolean(selectedGradeStream && selectedAcademicYear && selectedTerm && selectedExamType);
  const classLabel = gradeStreams.find(g => g.id === selectedGradeStream)?.full_name ?? '';
  const termLabel = terms.find(t => t.id === selectedTerm)?.name ?? '';
  const roundLabel = rounds?.find(r => r.exam_type === selectedExamType)?.label ?? '';
  const yearLabel = academicYears.find(y => y.id === selectedAcademicYear)?.name ?? '';
  const examLabel = [termLabel, roundLabel, yearLabel].filter(Boolean).join(' ');

  // ── Data fetching ──
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [gsRes, ayRes, tRes] = await Promise.all([fetch(MANAGED_STREAMS_URL), fetch('/api/school/data?type=academic_years'), fetch('/api/school/data?type=terms')]);
        const [gsJson, ayJson, tJson] = await Promise.all([gsRes.json(), ayRes.json(), tRes.json()]);
        const termList: ComparisonTerm[] = tJson.data || [];
        // Only the classes this user runs: a teacher's list used to include
        // classes they only teach a subject in, which every report refuses.
        const streamList: ManagedStream[] = gsJson.data || [];
        setGradeStreams(streamList); setAcademicYears(ayJson.data || []); setTerms(termList);
        if (streamList.length === 1) setSelectedGradeStream(streamList[0].id);
        // Pre-select the current term (Kenyan calendar) — fewer clicks.
        const activeId = findActiveTermId(termList);
        if (activeId) setSelectedTerm(activeId);
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
        toast.error('Could not load your classes and terms. Refresh to try again.');
      }
    };
    void fetchDropdownData();

    // CBC pathway support: split class reports per subject combination
    const fetchPathwayConfig = async () => {
      try {
        const [comboRes, profileRes] = await Promise.all([
          fetch('/api/school/data?type=subject_combinations'),
          fetch('/api/school/data?type=school_profile'),
        ]);
        if (comboRes.ok) {
          const comboJson = await comboRes.json();
          setHasCombinations((comboJson.data || []).length > 0);
        }
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          const size = profileJson?.data?.min_combination_group_size;
          if (typeof size === 'number' && size > 0) setGroupThreshold(size);
        }
      } catch { /* pathway extras are optional */ }
    };
    void fetchPathwayConfig();
  }, []);

  // Which rounds (Opener, Midterm, End Term, …) this class sat this term, how
  // much of each is entered, and which is the most recent. That one is chosen
  // for the user, and the choice is always sent: leaving it to the report
  // routes hid which exam a document showed.
  useEffect(() => {
    if (!selectedGradeStream || !selectedTerm) { setRounds([]); setSuggestedRound(null); setSelectedExamType(''); return; }
    const controller = new AbortController();
    setRounds(null);
    (async () => {
      try {
        const params = new URLSearchParams({ grade_stream_id: selectedGradeStream, term_id: selectedTerm });
        const res = await fetch(`/api/reports/rounds?${params.toString()}`, { signal: controller.signal });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load this class’s exams.'));
        const data = json as ReportRoundsResponse;
        setRounds(data.rounds);
        setSuggestedRound(data.suggested);
        // No marks anywhere yet: wait for a choice rather than pick an empty round.
        setSelectedExamType(prev => (data.rounds.some(r => r.exam_type === prev) ? prev : data.suggested ?? ''));
      } catch (err) {
        if (controller.signal.aborted) return;
        setRounds([]); setSuggestedRound(null); setSelectedExamType('');
        toast.error(err instanceof Error ? err.message : 'Could not load this class’s exams.');
      }
    })();
    return () => controller.abort();
  }, [selectedGradeStream, selectedTerm]);

  /*
    The chosen class's learners, for the learner picker and the SMS dialog.

    Both used to download every learner in the school, with all their
    relations, and filter to the class in the browser — on every opening.
    The endpoint filters by class itself.
  */
  const loadRoster = useCallback(async (streamId: string) => {
    setRoster({ streamId, learners: null });
    try {
      const res = await fetch(`/api/school/data?type=students&grade_stream_id=${encodeURIComponent(streamId)}`, { cache: 'no-store' });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load this class.'));
      const rows = ((json as { data?: unknown[] } | null)?.data ?? [])
        .map(toRosterLearner)
        .filter((l): l is RosterLearner => l !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      setRoster(prev => (prev?.streamId === streamId ? { streamId, learners: rows } : prev));
    } catch (err) {
      setRoster(prev => (prev?.streamId === streamId ? { streamId, learners: [] } : prev));
      toast.error(err instanceof Error ? err.message : 'Could not load this class.');
    }
  }, []);

  const openDialog = (next: Exclude<Dialog, null>) => {
    if ((next === 'student' || next === 'sms') && selectedGradeStream && roster?.streamId !== selectedGradeStream) {
      void loadRoster(selectedGradeStream);
    }
    if (next === 'sms') setSmsResult(null);
    setDialog(next);
  };
  const learners = roster?.streamId === selectedGradeStream ? roster.learners : null;

  const handleStudentSelect = (studentId: string) => {
    setDialog(null);
    const params = new URLSearchParams();
    if (selectedAcademicYear) params.append('year', selectedAcademicYear);
    if (selectedTerm) params.append('term', selectedTerm);
    if (customReportTitle) params.append('customTitle', customReportTitle);
    if (selectedTemplate !== DEFAULT_TEMPLATE) params.append('template', selectedTemplate);
    if (selectedExamType) params.append('examType', selectedExamType);
    window.open(`/api/reports/student/${studentId}?${params.toString()}`, '_blank');
  };

  // ── Bulk generation ──
  const handleGenerateAndDownload = async () => {
    if (!isConfigured) { toast.warning('Choose the class, term and exam first.'); return; }
    setGenerating(true); setProgress({ current: 0, total: 0, message: 'Step 1 of 3: Aggregating database grades...' });
    try {
      // Aggregate through the server route, which checks the caller is the
      // admin or this class's teacher. This used to call the RPC straight from
      // the browser with the anonymous key, where no such check can run.
      try {
        const aggRes = await fetch('/api/school/generate-reports', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term_id: selectedTerm, grade_stream_id: selectedGradeStream }),
        });
        if (!aggRes.ok) console.warn('Grade aggregation warning:', apiErrorMessage(await aggRes.json().catch(() => null)));
      } catch (aggErr) {
        console.warn('Grade aggregation step skipped (non-blocking):', aggErr);
      }
      setProgress({ current: 0, total: 0, message: 'Step 2 of 3: Fetching report data...' });
      const params = new URLSearchParams(); params.append('yearId', selectedAcademicYear); params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);
      if (selectedExamType) params.append('examType', selectedExamType);
      const response = await fetch(`/api/reports/class/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) { const errJson = await response.json(); throw new Error(errJson.error || 'Failed to fetch report data'); }
      const reportCardsData: ReportCardData[] = await response.json();
      if (!reportCardsData?.length) throw new Error('No students or grades found for this setup. Ensure marks are entered.');

      /*
        Hand the download to the browser rather than building it here.

        A class of thirty-five report cards is the heaviest document this app
        produces, and it used to be rendered in the page and passed over as a
        blob URL — the slowest way to make it and the least reliable way to
        deliver it, which is what a class teacher on a phone ran into.

        Splitting by combination was worse still: one download per group,
        spaced 500ms apart, with a message warning the reader that their
        browser might keep only the first. Browsers block exactly that, and
        mobile ones almost always do. The server now returns a single zip.

        The fetch above stays as the check, so an empty class reaches the toast
        instead of appearing as raw JSON in a tab. Navigating to an attachment
        does not leave the page.
      */
      const wantsSplit = splitByCombination && reportCardsData.some(r => r.combinationCode);
      setProgress({
        current: 0,
        total: reportCardsData.length,
        message: `Step 3 of 3: Preparing ${reportCardsData.length} report cards...`,
      });

      params.set('format', wantsSplit ? 'zip' : 'pdf');
      if (selectedTemplate !== DEFAULT_TEMPLATE) params.set('template', selectedTemplate);
      if (wantsSplit) {
        params.set('splitByCombination', 'true');
        params.set('groupThreshold', String(groupThreshold));
      }
      window.location.assign(`/api/reports/class/${selectedGradeStream}?${params.toString()}`);
      toast.success(wantsSplit
        ? 'Preparing your reports as a zip — the download will start shortly.'
        : 'Preparing your reports — the download will start shortly.');

      /*
        Hold the overlay after navigating.

        A class this size takes the server several seconds, and a download
        navigation reports nothing back: no load event, no progress. Clearing
        the overlay the moment we navigate would tell the teacher it was done
        while the server had barely started, and would re-arm a button whose
        second press costs another full render. Waiting is the honest state to
        show, so show it — and leave it to the toast, not the overlay, to say
        where the file went.
      */
      await new Promise(resolve => setTimeout(resolve, 8000));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setGenerating(false); setProgress({ current: 0, total: 0, message: '' }); }
  };

  const handleGenerateMarkSheet = async () => {
    if (!isConfigured) { toast.warning('Choose the class, term and exam first.'); return; }
    setGeneratingMarkSheet(true); setProgress({ current: 0, total: 0, message: 'Fetching mark sheet data...' });
    try {
      const params = new URLSearchParams(); params.append('yearId', selectedAcademicYear); params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);
      // The marksheet must describe the same sitting as the report cards.
      if (selectedExamType) params.append('examType', selectedExamType);
      const response = await fetch(`/api/reports/marksheet/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) { const errJson = await response.json(); throw new Error(errJson.error || 'Failed to fetch mark sheet data'); }
      // The call above was the check: it proves the sheet has data and lets a
      // real problem reach the toast below rather than appearing as raw JSON
      // in a new tab. Read it so the response is consumed, then let the
      // browser fetch the file itself.
      await response.json();

      /*
        Hand the download to the browser rather than building it here.

        This used to render the PDF in the page with @react-pdf/renderer and
        pass it over as a blob URL. On a phone that is the slowest possible
        place to render it and the least reliable way to deliver it, which is
        how a class teacher came to watch a mark sheet fail to save. Pointing
        the browser at a URL that answers with Content-Disposition makes it an
        ordinary download, handled by the download manager like any other.

        Navigating to an attachment does not leave the page.
      */
      setProgress({ current: 0, total: 0, message: 'Preparing download...' });
      params.set('format', 'pdf');
      window.location.assign(`/api/reports/marksheet/${selectedGradeStream}?${params.toString()}`);
      toast.success('Mark sheet ready — check your downloads.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setGeneratingMarkSheet(false); setProgress({ current: 0, total: 0, message: '' }); }
  };

  // ── Comments ──
  // Comments belong to the term, not the exam, so they load with class and term.
  const commentsScopeReady = Boolean(selectedGradeStream && selectedTerm && selectedAcademicYear);
  useEffect(() => {
    if (!showComments || !commentsScopeReady) return;
    const controller = new AbortController();
    setComments(null);
    (async () => {
      try {
        const params = new URLSearchParams({ grade_stream_id: selectedGradeStream, term_id: selectedTerm, academic_year_id: selectedAcademicYear });
        const res = await fetch(`/api/reports/comments?${params.toString()}`, { signal: controller.signal });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load the comments.'));
        const rows = ((json as { data?: StudentComment[] } | null)?.data) ?? [];
        setComments(rows);
        setSavedComments(new Map(rows.map(r => [r.student_id, r])));
      } catch (err) {
        if (controller.signal.aborted) return;
        setComments([]); setSavedComments(new Map());
        toast.error(err instanceof Error ? err.message : 'Could not load the comments.');
      }
    })();
    return () => controller.abort();
  }, [showComments, commentsScopeReady, selectedGradeStream, selectedTerm, selectedAcademicYear]);

  const dirtyCommentIds = useMemo(
    () => new Set((comments ?? []).filter(c => !sameComment(c, savedComments.get(c.student_id))).map(c => c.student_id)),
    [comments, savedComments],
  );

  // Unsaved remarks are easy to lose by closing the tab; the browser asks first.
  useEffect(() => {
    if (dirtyCommentIds.size === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCommentIds.size]);

  const updateComment = (studentId: string, field: CommentField, value: string) =>
    setComments(prev => prev?.map(c => (c.student_id === studentId ? { ...c, [field]: value } : c)) ?? prev);

  const saveComments = async (studentIds?: string[]) => {
    const ids = new Set(studentIds ?? dirtyCommentIds);
    const toSave = (comments ?? []).filter(c => ids.has(c.student_id));
    if (toSave.length === 0) return;
    setSavingComments(studentIds?.length === 1 ? studentIds[0] : 'all');
    try {
      const res = await fetch('/api/reports/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term_id: selectedTerm, academic_year_id: selectedAcademicYear, grade_stream_id: selectedGradeStream,
          comments: toSave.map(c => ({ student_id: c.student_id, comments_class_teacher: c.comments_class_teacher, comments_principal: c.comments_principal })),
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the comments.'));
      setSavedComments(prev => {
        const next = new Map(prev);
        for (const c of toSave) next.set(c.student_id, c);
        return next;
      });
      toast.success(toSave.length === 1 ? `Saved ${toSave[0].student_name}'s comments.` : `Saved comments for ${toSave.length} learners.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save the comments.');
    } finally {
      setSavingComments(null);
    }
  };

  // ── SMS ──
  const handleSendSMS = async (studentIds: string[]): Promise<boolean> => {
    setSendingSMS(true); setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds, termId: selectedTerm, academicYearId: selectedAcademicYear, gradeStreamId: selectedGradeStream, examType: selectedExamType || null }) });
      const json = await res.json().catch(() => null) as { error?: string; sent?: number; failed?: number; skipped?: unknown[]; results?: { success: boolean; error?: string }[] } | null;
      if (!res.ok || json?.error) throw new Error(json?.error || 'Could not send the texts.');
      const sent = json?.sent ?? 0;
      const failed = json?.failed ?? 0;
      const failureReasons = [...new Set((json?.results ?? []).filter(r => !r.success && r.error).map(r => r.error as string))];
      setSmsResult({ sent, failed, skipped: json?.skipped?.length ?? 0, failureReasons });
      if (sent === 0) toast.error(`No texts went out${failureReasons.length ? `: ${failureReasons[0]}` : '.'}`);
      else if (failed > 0) toast.warning(`${sent} texts sent, ${failed} failed.`);
      else toast.success(`${sent} text${sent === 1 ? '' : 's'} sent.`);
      return sent > 0;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not send the texts.');
      return false;
    } finally {
      setSendingSMS(false);
    }
  };

  const smsMessagePreview = `${schoolName || 'Your School'} Student Results\n[Learner name] - ${classLabel || 'Class'}\n${examLabel || 'Term'}\nMathematics: 85% (A) | English: 72% (B+) | ...\nAvg: 78.5% | Grade: B+ | Rank: 5/40`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Report cards"
        eyebrow="Academics"
        icon={FileText}
        hue="violet"
        description="Download report cards and mark sheets, text results to parents and compare terms."
      />

      <ReportSettings selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm} selectedGradeStream={selectedGradeStream} setSelectedGradeStream={setSelectedGradeStream} customReportTitle={customReportTitle} setCustomReportTitle={setCustomReportTitle} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} selectedExamType={selectedExamType} setSelectedExamType={setSelectedExamType} rounds={rounds} suggestedRound={suggestedRound} academicYears={academicYears} terms={terms} gradeStreams={gradeStreams} />

      {hasCombinations && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={splitByCombination} onChange={e => setSplitByCombination(e.target.checked)} />
            <span className="font-medium">Split the class download by subject combination</span>
          </label>
          {splitByCombination && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <label htmlFor={splitId}>Groups with at least</label>
              <input
                id={splitId}
                type="number"
                min={1}
                max={200}
                className="input-field h-9 w-20 text-center"
                value={groupThreshold}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v > 0) setGroupThreshold(v); }}
              />
              <span>learners get their own file; smaller groups share one. The ministry minimum is 15.</span>
            </div>
          )}
        </div>
      )}

      <ReportActionCards isConfigured={isConfigured} generating={generating} generatingMarkSheet={generatingMarkSheet} onSelectStudent={() => openDialog('student')} onBulkGenerate={handleGenerateAndDownload} onTermComparison={() => openDialog('compare')} onMarkSheet={handleGenerateMarkSheet} onSMS={() => openDialog('sms')} />

      {commentsScopeReady && (
        <StudentCommentsSection open={showComments} setOpen={setShowComments} comments={comments} dirtyIds={dirtyCommentIds} saving={savingComments} onChange={updateComment} onSave={ids => void saveComments(ids)} canEditPrincipalComment={role === 'ADMIN'} />
      )}

      {(generating || generatingMarkSheet) && progress.message && <ProgressOverlay message={progress.message} current={progress.current} total={progress.total} />}

      {dialog === 'student' && <StudentPickerModal learners={learners} classLabel={classLabel} onSelect={handleStudentSelect} onClose={() => setDialog(null)} />}

      {dialog === 'sms' && <SMSModal onClose={() => setDialog(null)} classLabel={classLabel} examLabel={examLabel} learners={learners} sending={sendingSMS} result={smsResult} onSend={handleSendSMS} messagePreview={smsMessagePreview} />}

      {dialog === 'compare' && <TermComparisonModal onClose={() => setDialog(null)} academicYears={academicYears} terms={terms} gradeStreams={gradeStreams} initialStreamId={selectedGradeStream} initialTermId={selectedTerm} />}
    </div>
  );
}
