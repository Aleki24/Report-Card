"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from '@/components/dashboard/PageHeader';
import { TermComparisonModal } from '@/components/reports/TermComparisonModal';
import { StudentCommentsSection } from '@/components/reports/StudentCommentsSection';
import { SMSModal } from '@/components/reports/SMSModal';
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
import { toast } from 'sonner';

interface SMSStudent { id: string; admission_number: string; guardian_phone: string | null; guardian_name: string | null; users: { first_name: string; last_name: string } | null; selected: boolean; }
interface StudentOption { id: string; admission_number: string; users: { first_name: string; last_name: string } | null; }
interface StudentComment { student_id: string; admission_number: string; student_name: string; comments_class_teacher: string; comments_principal: string; }
interface AcademicYearOption { id: string; name: string; }
interface TermOption { id: string; name: string; academic_year_id?: string; }

export default function ReportsPage() {
  const { schoolName, role } = useAuth();

  const [selectedGradeStream, setSelectedGradeStream] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [availableExamTypes, setAvailableExamTypes] = useState<string[]>([]);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);
  const [generating, setGenerating] = useState(false);
  const [generatingMarkSheet, setGeneratingMarkSheet] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [gradeStreams, setGradeStreams] = useState<ManagedStream[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showTermComparison, setShowTermComparison] = useState(false);
  const [studentComments, setStudentComments] = useState<StudentComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsStudents, setSmsStudents] = useState<SMSStudent[]>([]);
  const [loadingSMSStudents, setLoadingSMSStudents] = useState(false);
  const [smsSearch, setSmsSearch] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number; skipped: number; failureReasons: string[] } | null>(null);
  const [hasCombinations, setHasCombinations] = useState(false);
  const [splitByCombination, setSplitByCombination] = useState(false);
  const [groupThreshold, setGroupThreshold] = useState(15);

  const isConfigured = selectedGradeStream && selectedAcademicYear && selectedTerm;
  const showToastMsg = (msg: string, tone: 'success' | 'error' | 'warning' | 'info' = 'info') => { toast[tone](msg); };

  // ── Data fetching ──
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [gsRes, ayRes, tRes] = await Promise.all([fetch(MANAGED_STREAMS_URL), fetch('/api/school/data?type=academic_years'), fetch('/api/school/data?type=terms')]);
        const [gsJson, ayJson, tJson] = await Promise.all([gsRes.json(), ayRes.json(), tRes.json()]);
        const termList: TermOption[] = tJson.data || [];
        const yearList: AcademicYearOption[] = ayJson.data || [];
        // Only the classes this user runs: a teacher's list used to include
        // classes they only teach a subject in, which every report refuses.
        const streamList: ManagedStream[] = gsJson.data || [];
        setGradeStreams(streamList); setAcademicYears(yearList); setTerms(termList);
        if (streamList.length === 1) setSelectedGradeStream(streamList[0].id);
        // Pre-select the current term (Kenyan calendar) and its year — fewer clicks
        const activeId = findActiveTermId(termList);
        if (activeId) {
          setSelectedTerm(activeId);
          const activeTerm = termList.find(t => t.id === activeId);
          if (activeTerm?.academic_year_id) setSelectedAcademicYear(activeTerm.academic_year_id);
        }
        if (yearList.length === 1) setSelectedAcademicYear(yearList[0].id);
      } catch (err) { console.error('Failed to fetch dropdown data:', err); }
    };
    fetchDropdownData();

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
    fetchPathwayConfig();
  }, []);

  // Only offer terms that belong to the selected academic year
  const termsForYear = useMemo(
    () => terms.filter(t => !selectedAcademicYear || !t.academic_year_id || t.academic_year_id === selectedAcademicYear),
    [terms, selectedAcademicYear]
  );
  useEffect(() => {
    if (selectedTerm && !termsForYear.some(t => t.id === selectedTerm)) setSelectedTerm('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsForYear]);

  // Which rounds of exams (CAT, Midterm, End Term, Mock...) exist for this
  // class + term — a term can hold several per subject, so let the admin
  // pick which one the report card should be based on.
  useEffect(() => {
    setSelectedExamType('');
    if (!selectedGradeStream || !selectedTerm) { setAvailableExamTypes([]); return; }
    const stream = gradeStreams.find(s => s.id === selectedGradeStream);
    (async () => {
      try {
        const paramsObj: Record<string, string> = { stream_id: selectedGradeStream, term_id: selectedTerm };
        // Many exams are grade-wide (no specific stream assigned) — the API
        // only matches those when grade_id is passed alongside stream_id.
        if (stream?.grade_id) paramsObj.grade_id = stream.grade_id;
        const params = new URLSearchParams(paramsObj);
        const res = await fetch(`/api/school/exams?${params.toString()}`);
        if (!res.ok) { setAvailableExamTypes([]); return; }
        const json = await res.json();
        const types = Array.from(new Set((json.data || []).map((e: any) => e.exam_type).filter(Boolean))) as string[];
        setAvailableExamTypes(types);
      } catch (err) {
        console.error('Failed to fetch exam types:', err);
        setAvailableExamTypes([]);
      }
    })();
  }, [selectedGradeStream, selectedTerm, gradeStreams]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch('/api/school/data?type=students', { cache: 'no-store' }); const json = await res.json();
      const data = (json.data || []) as any[];
      setStudents(selectedGradeStream ? data.filter((s: any) => s.current_grade_stream_id === selectedGradeStream) : data);
    } catch (err) { console.error('Failed to fetch students:', err); }
    setLoadingStudents(false);
  };

  useEffect(() => { if (showStudentPicker) fetchStudents(); }, [showStudentPicker]);

  const filteredStudents = studentSearch.trim()
    ? students.filter(s => `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(studentSearch.toLowerCase()) || s.admission_number.toLowerCase().includes(studentSearch.toLowerCase()))
    : students;

  const handleStudentSelect = (studentId: string) => {
    setShowStudentPicker(false); setStudentSearch('');
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
    if (!isConfigured) { showToastMsg('Choose the academic year, term and class first.', 'warning'); return; }
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
      showToastMsg(wantsSplit
        ? 'Preparing your reports as a zip — the download will start shortly.'
        : 'Preparing your reports — the download will start shortly.', 'success');

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
    } catch (err: unknown) { showToastMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.', 'error'); }
    finally { setGenerating(false); setProgress({ current: 0, total: 0, message: '' }); }
  };

  const handleGenerateMarkSheet = async () => {
    if (!isConfigured) { showToastMsg('Choose the academic year, term and class first.', 'warning'); return; }
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
      showToastMsg('Mark sheet ready — check your downloads.', 'success');
    } catch (err: unknown) { showToastMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.', 'error'); }
    finally { setGeneratingMarkSheet(false); setProgress({ current: 0, total: 0, message: '' }); }
  };

  // ── Comments ──
  const fetchComments = async () => {
    if (!isConfigured) return;
    setLoadingComments(true);
    try {
      const params = new URLSearchParams({ grade_stream_id: selectedGradeStream, term_id: selectedTerm, academic_year_id: selectedAcademicYear });
      const res = await fetch(`/api/reports/comments?${params.toString()}`); const json = await res.json();
      setStudentComments(json.data || []);
    } catch (err) { console.error('Failed to fetch comments:', err); }
    setLoadingComments(false);
  };

  useEffect(() => { if (showComments && isConfigured) fetchComments(); }, [showComments, selectedGradeStream, selectedAcademicYear, selectedTerm]);

  const handleSaveComment = async (sc: StudentComment) => {
    setSavingCommentId(sc.student_id);
    try {
      const res = await fetch('/api/reports/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: sc.student_id, term_id: selectedTerm, academic_year_id: selectedAcademicYear, grade_stream_id: selectedGradeStream, comments_class_teacher: sc.comments_class_teacher, comments_principal: sc.comments_principal }) });
      if (!res.ok) { const errJson = await res.json(); throw new Error(errJson.error || 'Save failed'); }
      showToastMsg(`Comments saved for ${sc.student_name}.`, 'success');
    } catch (err: unknown) { showToastMsg(err instanceof Error ? err.message : 'Failed to save comment', 'error'); }
    setSavingCommentId(null);
  };

  const handleSaveAllComments = async () => {
    setSavingCommentId('all');
    // Fire the saves in parallel instead of one awaited request at a time —
    // a 45-student class went from ~45 sequential round-trips to one batch.
    const results = await Promise.all(studentComments.map(async sc => {
      try {
        const res = await fetch('/api/reports/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: sc.student_id, term_id: selectedTerm, academic_year_id: selectedAcademicYear, grade_stream_id: selectedGradeStream, comments_class_teacher: sc.comments_class_teacher, comments_principal: sc.comments_principal }) });
        return res.ok;
      } catch { return false; }
    }));
    const successCount = results.filter(Boolean).length;
    const failed = studentComments.length - successCount;
    // Say plainly when some did not save, rather than a tick over a partial result.
    if (failed === 0) showToastMsg(`Saved comments for all ${successCount} students.`, 'success');
    else showToastMsg(`Saved ${successCount} of ${studentComments.length}. ${failed} did not save — try Save all again.`, successCount === 0 ? 'error' : 'warning');
    setSavingCommentId(null);
  };

  const filteredComments = commentSearch.trim()
    ? studentComments.filter(sc => sc.student_name.toLowerCase().includes(commentSearch.toLowerCase()) || sc.admission_number.toLowerCase().includes(commentSearch.toLowerCase()))
    : studentComments;

  // ── SMS ──
  const fetchSMSStudents = useCallback(async () => {
    if (!selectedGradeStream) return;
    setLoadingSMSStudents(true);
    try {
      const res = await fetch('/api/school/data?type=students', { cache: 'no-store' }); const json = await res.json();
      setSmsStudents(((json.data || []) as any[]).filter((s: any) => s.current_grade_stream_id === selectedGradeStream).map((s: any) => ({
        id: s.id, admission_number: s.admission_number, guardian_phone: s.guardian_phone || null, guardian_name: s.guardian_name || null, users: s.users, selected: !!s.guardian_phone,
      })));
    } catch (err) { console.error('Failed to fetch SMS students:', err); }
    setLoadingSMSStudents(false);
  }, [selectedGradeStream]);

  useEffect(() => { if (showSMSModal) { fetchSMSStudents(); setSmsResult(null); } }, [showSMSModal, fetchSMSStudents]);

  const filteredSMSStudents = smsSearch.trim() ? smsStudents.filter(s => `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(smsSearch.toLowerCase()) || s.admission_number.toLowerCase().includes(smsSearch.toLowerCase())) : smsStudents;
  const smsSelectedCount = smsStudents.filter(s => s.selected && s.guardian_phone).length;
  const smsMissingPhoneCount = smsStudents.filter(s => !s.guardian_phone).length;

  const handleSendSMS = async () => {
    const selected = smsStudents.filter(s => s.selected && s.guardian_phone);
    if (!selected.length) { showToastMsg('No students with valid phone numbers selected.', 'warning'); return; }
    setSendingSMS(true); setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds: selected.map(s => s.id), termId: selectedTerm, academicYearId: selectedAcademicYear, gradeStreamId: selectedGradeStream }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to send SMS');
      const failureReasons = [...new Set(((json.results || []) as { success: boolean; error?: string }[]).filter(r => !r.success && r.error).map(r => r.error as string))];
      setSmsResult({ sent: json.sent || 0, failed: json.failed || 0, skipped: json.skipped?.length || 0, failureReasons });
      if ((json.sent || 0) === 0) {
        showToastMsg(`SMS failed to send${failureReasons.length ? `: ${failureReasons[0]}` : ''}`, 'error');
      } else if ((json.failed || 0) > 0) {
        showToastMsg(`SMS sent: ${json.sent} delivered, ${json.failed} failed`, 'warning');
      } else {
        showToastMsg(`SMS sent: ${json.sent} delivered`, 'success');
      }
    } catch (err: unknown) { showToastMsg(err instanceof Error ? err.message : 'SMS send failed', 'error'); }
    setSendingSMS(false);
  };

  const smsMessagePreview = `${schoolName || 'Your School'} Student Results\n[Student Name] - ${gradeStreams.find(g => g.id === selectedGradeStream)?.full_name || 'Class'}\n${terms.find(t => t.id === selectedTerm)?.name || 'Term'} ${academicYears.find(y => y.id === selectedAcademicYear)?.name || ''}\nMath: 85% (A) | Eng: 72% (B+) | Sci: 80% (A-) | ...\nAvg: 78.5% | Grade: B+ | Rank: 5/40`;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader 
          title="Academic Reports" 
          description="Generate and download professional PDF report cards, bulk class sheets, and compare term performance with advanced analytics."
      />

      {/* Report Settings */}
      <ReportSettings selectedAcademicYear={selectedAcademicYear} setSelectedAcademicYear={setSelectedAcademicYear} selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm} selectedGradeStream={selectedGradeStream} setSelectedGradeStream={setSelectedGradeStream} customReportTitle={customReportTitle} setCustomReportTitle={setCustomReportTitle} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} selectedExamType={selectedExamType} setSelectedExamType={setSelectedExamType} availableExamTypes={availableExamTypes} academicYears={academicYears} terms={termsForYear} gradeStreams={gradeStreams} />

      {hasCombinations && (
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={splitByCombination} onChange={e => setSplitByCombination(e.target.checked)} />
            <span className="font-medium">Split bulk reports by subject combination</span>
          </label>
          {splitByCombination && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Groups with at least</span>
              <input
                type="number"
                min={1}
                max={200}
                className="input-field w-16 text-center"
                value={groupThreshold}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v) && v > 0) setGroupThreshold(v); }}
              />
              <span>learners get their own document (ministry minimum is 15); smaller groups and unassigned students are combined into one document.</span>
            </div>
          )}
        </div>
      )}

      <ReportActionCards isConfigured={!!isConfigured} generating={generating} generatingMarkSheet={generatingMarkSheet} onSelectStudent={() => setShowStudentPicker(true)} onBulkGenerate={handleGenerateAndDownload} onTermComparison={() => setShowTermComparison(true)} onMarkSheet={handleGenerateMarkSheet} onSMS={() => setShowSMSModal(true)} />

      <StudentCommentsSection isConfigured={!!isConfigured} showComments={showComments} setShowComments={setShowComments} loadingComments={loadingComments} studentComments={studentComments} filteredComments={filteredComments} commentSearch={commentSearch} setCommentSearch={setCommentSearch} savingCommentId={savingCommentId} onSaveComment={handleSaveComment} onSaveAllComments={handleSaveAllComments} onUpdateComment={(id, field, val) => setStudentComments(prev => prev.map(sc => sc.student_id === id ? { ...sc, [field]: val } : sc))} canEditPrincipalComment={role === 'ADMIN'} />

      {(generating || generatingMarkSheet) && progress.message && <ProgressOverlay message={progress.message} current={progress.current} total={progress.total} />}

      {showStudentPicker && <StudentPickerModal students={students} filteredStudents={filteredStudents} loading={loadingStudents} search={studentSearch} setSearch={setStudentSearch} onSelect={handleStudentSelect} onClose={() => { setShowStudentPicker(false); setStudentSearch(''); }} />}

      {showSMSModal && <SMSModal onClose={() => { setShowSMSModal(false); setSmsSearch(''); }} streamLabel={gradeStreams.find(g => g.id === selectedGradeStream)?.full_name || ''} smsStudents={smsStudents} filteredSMSStudents={filteredSMSStudents} loadingSMSStudents={loadingSMSStudents} smsSearch={smsSearch} setSmsSearch={setSmsSearch} smsSelectedCount={smsSelectedCount} smsMissingPhoneCount={smsMissingPhoneCount} sendingSMS={sendingSMS} smsResult={smsResult} onToggle={id => setSmsStudents(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))} onSelectAll={() => setSmsStudents(prev => prev.map(s => ({ ...s, selected: !!s.guardian_phone })))} onDeselectAll={() => setSmsStudents(prev => prev.map(s => ({ ...s, selected: false })))} onSend={handleSendSMS} messagePreview={smsMessagePreview} />}


      <TermComparisonModal isOpen={showTermComparison} onClose={() => setShowTermComparison(false)} academicYears={academicYears} terms={terms} gradeStreams={gradeStreams} />
    </div>
  );
}
