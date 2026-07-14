"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/dashboard/PageHeader';
import { TermComparisonModal } from '@/components/reports/TermComparisonModal';
import { StudentCommentsSection } from '@/components/reports/StudentCommentsSection';
import { SMSModal } from '@/components/reports/SMSModal';
import { StudentPickerModal } from '@/components/reports/StudentPickerModal';
import { ReportActionCards } from '@/components/reports/ReportActionCards';
import { ReportSettings } from '@/components/reports/ReportSettings';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { pdf } from '@react-pdf/renderer';
import { generateBulkReportCardsPDF, ReportCardData } from '@/lib/pdfGenerator';
import { DEFAULT_TEMPLATE, type ReportTemplateId } from '@/lib/pdf/templateMeta';
import { MarkSheetDocument, MarkSheetData } from '@/lib/marksheetPdfGenerator';
import { findActiveTermId } from '@/lib/term-calendar';
import { BookOpen, ArrowRight } from 'lucide-react';

interface SMSStudent { id: string; admission_number: string; guardian_phone: string | null; guardian_name: string | null; users: { first_name: string; last_name: string } | null; selected: boolean; }
interface StudentOption { id: string; admission_number: string; users: { first_name: string; last_name: string } | null; }
interface StudentComment { student_id: string; admission_number: string; student_name: string; comments_class_teacher: string; comments_principal: string; }
interface GradeStreamOption { id: string; full_name: string; }
interface AcademicYearOption { id: string; name: string; }
interface TermOption { id: string; name: string; academic_year_id?: string; }

export default function ReportsPage() {
  const { profile, availableRoles, schoolName } = useAuth();
  const isAlsoSubjectTeacher = profile?.role === 'CLASS_TEACHER' && availableRoles.includes('SUBJECT_TEACHER');

  const [selectedGradeStream, setSelectedGradeStream] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);
  const [generating, setGenerating] = useState(false);
  const [generatingMarkSheet, setGeneratingMarkSheet] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showTermComparison, setShowTermComparison] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const isConfigured = selectedGradeStream && selectedAcademicYear && selectedTerm;
  const showToastMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  // ── Data fetching ──
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [gsRes, ayRes, tRes] = await Promise.all([fetch('/api/school/data?type=grade_streams'), fetch('/api/school/data?type=academic_years'), fetch('/api/school/data?type=terms')]);
        const [gsJson, ayJson, tJson] = await Promise.all([gsRes.json(), ayRes.json(), tRes.json()]);
        const termList: TermOption[] = tJson.data || [];
        const yearList: AcademicYearOption[] = ayJson.data || [];
        setGradeStreams(gsJson.data || []); setAcademicYears(yearList); setTerms(termList);
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

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch('/api/school/data?type=students'); const json = await res.json();
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
    window.open(`/api/reports/student/${studentId}?${params.toString()}`, '_blank');
  };

  // ── Bulk generation ──
  const handleGenerateAndDownload = async () => {
    if (!isConfigured) { showToastMsg('Please select Academic Year, Term, and Grade Stream.'); return; }
    setGenerating(true); setProgress({ current: 0, total: 0, message: 'Step 1 of 3: Aggregating database grades...' });
    try {
      try {
        const { error } = await supabase.rpc('generate_term_reports', { p_academic_year_id: selectedAcademicYear, p_term_id: selectedTerm, p_grade_stream_id: selectedGradeStream });
        if (error) console.warn('Grade aggregation RPC warning:', error.message);
      } catch (aggErr) {
        console.warn('Grade aggregation step skipped (non-blocking):', aggErr);
      }
      setProgress({ current: 0, total: 0, message: 'Step 2 of 3: Fetching report data...' });
      const params = new URLSearchParams(); params.append('yearId', selectedAcademicYear); params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);
      const response = await fetch(`/api/reports/class/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) { const errJson = await response.json(); throw new Error(errJson.error || 'Failed to fetch report data'); }
      const reportCardsData: ReportCardData[] = await response.json();
      if (!reportCardsData?.length) throw new Error('No students or grades found for this setup. Ensure marks are entered.');
      setProgress({ current: 0, total: reportCardsData.length, message: 'Step 3 of 3: Generating combined PDF...' });
      const pdfBuffer = await generateBulkReportCardsPDF(reportCardsData, selectedTemplate);
      const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `${gradeStreams.find(s => s.id === selectedGradeStream)?.full_name || 'Class'}_${terms.find(t => t.id === selectedTerm)?.name || 'Term'}_Reports.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
      showToastMsg('✅ Download complete!');
    } catch (err: any) { showToastMsg(`Failed: ${err.message || 'Unknown error'}`); }
    finally { setGenerating(false); setProgress({ current: 0, total: 0, message: '' }); }
  };

  const handleGenerateMarkSheet = async () => {
    if (!isConfigured) { showToastMsg('Please select Academic Year, Term, and Grade Stream.'); return; }
    setGeneratingMarkSheet(true); setProgress({ current: 0, total: 0, message: 'Fetching mark sheet data...' });
    try {
      const params = new URLSearchParams(); params.append('yearId', selectedAcademicYear); params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);
      const response = await fetch(`/api/reports/marksheet/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) { const errJson = await response.json(); throw new Error(errJson.error || 'Failed to fetch mark sheet data'); }
      const markSheetData: MarkSheetData = await response.json();
      setProgress({ current: 0, total: 0, message: 'Generating PDF...' });
      const blob = await pdf(<MarkSheetDocument data={markSheetData} />).toBlob();
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = `${gradeStreams.find(s => s.id === selectedGradeStream)?.full_name || 'Class'}_${terms.find(t => t.id === selectedTerm)?.name || 'Term'}_MarkSheet.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
      showToastMsg('✅ Mark Sheet downloaded!');
    } catch (err: any) { showToastMsg(`Failed: ${err.message || 'Unknown error'}`); }
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
      showToastMsg(`✅ Comments saved for ${sc.student_name}`);
    } catch (err: any) { showToastMsg(`❌ ${err.message || 'Failed to save comment'}`); }
    setSavingCommentId(null);
  };

  const handleSaveAllComments = async () => {
    setSavingCommentId('all'); let successCount = 0;
    for (const sc of studentComments) {
      try {
        const res = await fetch('/api/reports/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: sc.student_id, term_id: selectedTerm, academic_year_id: selectedAcademicYear, grade_stream_id: selectedGradeStream, comments_class_teacher: sc.comments_class_teacher, comments_principal: sc.comments_principal }) });
        if (res.ok) successCount++;
      } catch { /* skip */ }
    }
    showToastMsg(`✅ Saved comments for ${successCount} of ${studentComments.length} students`);
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
      const res = await fetch('/api/school/data?type=students'); const json = await res.json();
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
    if (!selected.length) { showToastMsg('No students with valid phone numbers selected.'); return; }
    setSendingSMS(true); setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds: selected.map(s => s.id), termId: selectedTerm, academicYearId: selectedAcademicYear, gradeStreamId: selectedGradeStream }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to send SMS');
      const failureReasons = [...new Set(((json.results || []) as { success: boolean; error?: string }[]).filter(r => !r.success && r.error).map(r => r.error as string))];
      setSmsResult({ sent: json.sent || 0, failed: json.failed || 0, skipped: json.skipped?.length || 0, failureReasons });
      if ((json.sent || 0) === 0) {
        showToastMsg(`❌ SMS failed to send${failureReasons.length ? `: ${failureReasons[0]}` : ''}`);
      } else if ((json.failed || 0) > 0) {
        showToastMsg(`⚠️ SMS sent: ${json.sent} delivered, ${json.failed} failed`);
      } else {
        showToastMsg(`✅ SMS sent: ${json.sent} delivered`);
      }
    } catch (err: any) { showToastMsg(`❌ ${err.message || 'SMS send failed'}`); }
    setSendingSMS(false);
  };

  const smsMessagePreview = `${schoolName || 'Your School'} Student Results\n[Student Name] - ${gradeStreams.find(g => g.id === selectedGradeStream)?.full_name || 'Class'}\n${terms.find(t => t.id === selectedTerm)?.name || 'Term'} ${academicYears.find(y => y.id === selectedAcademicYear)?.name || ''}\nMath: 85% (A) | Eng: 72% (B+) | Sci: 80% (A-) | ...\nAvg: 78.5% | Grade: B+ | Rank: 5/40`;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader 
          title="Academic Reports" 
          description="Generate and download professional PDF report cards, bulk class sheets, and compare term performance with advanced analytics."
      />

      {isAlsoSubjectTeacher && (
        <Link href="/dashboard/exams-marks" className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 no-underline transition-all hover:border-primary/50 hover:bg-primary/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-foreground">Go to My Subjects</span>
            <span className="block text-xs text-muted-foreground mt-0.5">Enter and manage marks for your assigned subjects</span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* Report Settings */}
      <ReportSettings selectedAcademicYear={selectedAcademicYear} setSelectedAcademicYear={setSelectedAcademicYear} selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm} selectedGradeStream={selectedGradeStream} setSelectedGradeStream={setSelectedGradeStream} customReportTitle={customReportTitle} setCustomReportTitle={setCustomReportTitle} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} academicYears={academicYears} terms={termsForYear} gradeStreams={gradeStreams} />

      <ReportActionCards isConfigured={!!isConfigured} generating={generating} generatingMarkSheet={generatingMarkSheet} onSelectStudent={() => setShowStudentPicker(true)} onBulkGenerate={handleGenerateAndDownload} onTermComparison={() => setShowTermComparison(true)} onMarkSheet={handleGenerateMarkSheet} onSMS={() => setShowSMSModal(true)} />

      <StudentCommentsSection isConfigured={!!isConfigured} showComments={showComments} setShowComments={setShowComments} loadingComments={loadingComments} studentComments={studentComments} filteredComments={filteredComments} commentSearch={commentSearch} setCommentSearch={setCommentSearch} savingCommentId={savingCommentId} onSaveComment={handleSaveComment} onSaveAllComments={handleSaveAllComments} onUpdateComment={(id, field, val) => setStudentComments(prev => prev.map(sc => sc.student_id === id ? { ...sc, [field]: val } : sc))} />

      {(generating || generatingMarkSheet) && progress.message && <ProgressOverlay message={progress.message} current={progress.current} total={progress.total} />}

      {showStudentPicker && <StudentPickerModal students={students} filteredStudents={filteredStudents} loading={loadingStudents} search={studentSearch} setSearch={setStudentSearch} onSelect={handleStudentSelect} onClose={() => { setShowStudentPicker(false); setStudentSearch(''); }} />}

      {showSMSModal && <SMSModal onClose={() => { setShowSMSModal(false); setSmsSearch(''); }} smsStudents={smsStudents} filteredSMSStudents={filteredSMSStudents} loadingSMSStudents={loadingSMSStudents} smsSearch={smsSearch} setSmsSearch={setSmsSearch} smsSelectedCount={smsSelectedCount} smsMissingPhoneCount={smsMissingPhoneCount} sendingSMS={sendingSMS} smsResult={smsResult} onToggle={id => setSmsStudents(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))} onSelectAll={() => setSmsStudents(prev => prev.map(s => ({ ...s, selected: !!s.guardian_phone })))} onDeselectAll={() => setSmsStudents(prev => prev.map(s => ({ ...s, selected: false })))} onSend={handleSendSMS} messagePreview={smsMessagePreview} />}

      {toast && <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg bg-muted border border-border text-foreground animate-in fade-in slide-in-from-bottom-5 duration-300">{toast}</div>}

      <TermComparisonModal isOpen={showTermComparison} onClose={() => setShowTermComparison(false)} academicYears={academicYears} terms={terms} gradeStreams={gradeStreams} />
    </div>
  );
}
