"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TermComparisonModal } from '@/components/reports/TermComparisonModal';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import { generateBulkReportCardsPDF, ReportCardData } from '@/lib/pdfGenerator';
import { MarkSheetDocument, MarkSheetData } from '@/lib/marksheetPdfGenerator';
import QRCode from 'qrcode';

interface SMSStudent {
  id: string;
  admission_number: string;
  guardian_phone: string | null;
  guardian_name: string | null;
  users: { first_name: string; last_name: string } | null;
  selected: boolean;
}

interface StudentOption {
  id: string;
  admission_number: string;
  users: { first_name: string; last_name: string } | null;
}

interface StudentComment {
  student_id: string;
  admission_number: string;
  student_name: string;
  comments_class_teacher: string;
  comments_principal: string;
}

interface GradeStreamOption { id: string; full_name: string; }
interface AcademicYearOption { id: string; name: string; }
interface TermOption { id: string; name: string; academic_year_id?: string; }

export default function ReportsPage() {
  const { profile, availableRoles } = useAuth();
  const isAlsoSubjectTeacher = profile?.role === 'CLASS_TEACHER' && availableRoles.includes('SUBJECT_TEACHER');

  const [selectedGradeStream, setSelectedGradeStream] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [customReportTitle, setCustomReportTitle] = useState('');
  
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

  // ── Student Comments state ────────────────────────────
  const [studentComments, setStudentComments] = useState<StudentComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');

  // ── SMS state ─────────────────────────────────────────
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsStudents, setSmsStudents] = useState<SMSStudent[]>([]);
  const [loadingSMSStudents, setLoadingSMSStudents] = useState(false);
  const [smsSearch, setSmsSearch] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ── Fetch all dropdown data via school-scoped API ──────────
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [gsRes, ayRes, tRes] = await Promise.all([
          fetch('/api/school/data?type=grade_streams'),
          fetch('/api/school/data?type=academic_years'),
          fetch('/api/school/data?type=terms'),
        ]);
        const [gsJson, ayJson, tJson] = await Promise.all([
          gsRes.json(), ayRes.json(), tRes.json(),
        ]);
        setGradeStreams(gsJson.data || []);
        setAcademicYears(ayJson.data || []);
        setTerms(tJson.data || []);
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, []);

  // ── Fetch students via school-scoped API ───────────────────
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      let url = '/api/school/data?type=students';
      const res = await fetch(url);
      const json = await res.json();
      const data = (json.data || []) as any[];
      // Optionally filter by stream client-side
      const filtered = selectedGradeStream
        ? data.filter((s: any) => s.current_grade_stream_id === selectedGradeStream)
        : data;
      setStudents(filtered);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }
    setLoadingStudents(false);
  };

  useEffect(() => {
    if (showStudentPicker) fetchStudents();
  }, [showStudentPicker]);

  const filteredStudents = studentSearch.trim()
    ? students.filter(s =>
        `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students;

  const handleStudentSelect = (studentId: string) => {
    setShowStudentPicker(false);
    setStudentSearch('');
    const params = new URLSearchParams();
    if (selectedAcademicYear) params.append('year', selectedAcademicYear);
    if (selectedTerm) params.append('term', selectedTerm);
    if (customReportTitle) params.append('customTitle', customReportTitle);
    window.open(`/api/reports/student/${studentId}?${params.toString()}`, '_blank');
  };

  const handleGenerateAndDownload = async () => {
    if (!selectedGradeStream || !selectedAcademicYear || !selectedTerm) {
      showToastMsg('Please select Academic Year, Term, and Grade Stream.');
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: 0, message: 'Step 1 of 3: Aggregating database grades...' });

    try {
      // 1. Calculate & Generating Grades Data in Database
      const { error } = await supabase.rpc('generate_term_reports', {
        p_term_id: selectedTerm,
        p_grade_stream_id: selectedGradeStream,
      });

      if (error) {
        throw new Error(`Grade aggregation failed: ${error.message}`);
      }

      // 2. Fetching JSON report arrays
      setProgress({ current: 0, total: 0, message: 'Step 2 of 3: Fetching report data...' });
      
      const params = new URLSearchParams();
      params.append('yearId', selectedAcademicYear);
      params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);
      
      const response = await fetch(`/api/reports/class/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to fetch report data');
      }
      
      const reportCardsData: ReportCardData[] = await response.json();
      
      if (!reportCardsData || reportCardsData.length === 0) {
        throw new Error('No students or grades found for this setup. Ensure marks are entered.');
      }

      const total = reportCardsData.length;

      // 3. Generate single PDF with all reports
      setProgress({ current: 0, total, message: 'Step 3 of 3: Generating combined PDF...' });
      
      const pdfBuffer = await generateBulkReportCardsPDF(reportCardsData);
      
      const uint8Array = new Uint8Array(pdfBuffer);
      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const termName = terms.find(t => t.id === selectedTerm)?.name || 'Term';
      const streamName = gradeStreams.find(s => s.id === selectedGradeStream)?.full_name || 'Class';
      
      link.download = `${streamName}_${termName}_Reports.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      showToastMsg('✅ Download complete!');
    } catch (err: any) {
      console.error('Bulk download error:', err);
      showToastMsg(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleGenerateMarkSheet = async () => {
    if (!selectedGradeStream || !selectedAcademicYear || !selectedTerm) {
      showToastMsg('Please select Academic Year, Term, and Grade Stream.');
      return;
    }

    setGeneratingMarkSheet(true);
    setProgress({ current: 0, total: 0, message: 'Fetching mark sheet data...' });

    try {
      const params = new URLSearchParams();
      params.append('yearId', selectedAcademicYear);
      params.append('termId', selectedTerm);
      if (customReportTitle) params.append('customTitle', customReportTitle);

      const response = await fetch(`/api/reports/marksheet/${selectedGradeStream}?${params.toString()}`);
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Failed to fetch mark sheet data');
      }

      const markSheetData: MarkSheetData = await response.json();
      
      setProgress({ current: 0, total: 0, message: 'Generating PDF...' });
      const blob = await pdf(<MarkSheetDocument data={markSheetData} />).toBlob();
      
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const termName = terms.find(t => t.id === selectedTerm)?.name || 'Term';
      const streamName = gradeStreams.find(s => s.id === selectedGradeStream)?.full_name || 'Class';
      
      link.download = `${streamName}_${termName}_MarkSheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      showToastMsg('✅ Mark Sheet downloaded!');
    } catch (err: any) {
      showToastMsg(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setGeneratingMarkSheet(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };

  const isConfigured = selectedGradeStream && selectedAcademicYear && selectedTerm;

  // ── Fetch student comments ────────────────────────────
  const fetchComments = async () => {
    if (!selectedGradeStream || !selectedAcademicYear || !selectedTerm) return;
    setLoadingComments(true);
    try {
      const params = new URLSearchParams({
        grade_stream_id: selectedGradeStream,
        term_id: selectedTerm,
        academic_year_id: selectedAcademicYear,
      });
      const res = await fetch(`/api/reports/comments?${params.toString()}`);
      const json = await res.json();
      setStudentComments(json.data || []);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
    setLoadingComments(false);
  };

  useEffect(() => {
    if (showComments && isConfigured) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments, selectedGradeStream, selectedAcademicYear, selectedTerm]);

  const handleSaveComment = async (sc: StudentComment) => {
    setSavingCommentId(sc.student_id);
    try {
      const res = await fetch('/api/reports/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: sc.student_id,
          term_id: selectedTerm,
          academic_year_id: selectedAcademicYear,
          grade_stream_id: selectedGradeStream,
          comments_class_teacher: sc.comments_class_teacher,
          comments_principal: sc.comments_principal,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Save failed');
      }
      showToastMsg(`✅ Comments saved for ${sc.student_name}`);
    } catch (err: any) {
      showToastMsg(`❌ ${err.message || 'Failed to save comment'}`);
    }
    setSavingCommentId(null);
  };

  const handleSaveAllComments = async () => {
    setSavingCommentId('all');
    let successCount = 0;
    for (const sc of studentComments) {
      try {
        const res = await fetch('/api/reports/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: sc.student_id,
            term_id: selectedTerm,
            academic_year_id: selectedAcademicYear,
            grade_stream_id: selectedGradeStream,
            comments_class_teacher: sc.comments_class_teacher,
            comments_principal: sc.comments_principal,
          }),
        });
        if (res.ok) successCount++;
      } catch { /* skip */ }
    }
    showToastMsg(`✅ Saved comments for ${successCount} of ${studentComments.length} students`);
    setSavingCommentId(null);
  };

  const updateComment = (studentId: string, field: 'comments_class_teacher' | 'comments_principal', value: string) => {
    setStudentComments(prev => prev.map(sc => sc.student_id === studentId ? { ...sc, [field]: value } : sc));
  };

  const filteredComments = commentSearch.trim()
    ? studentComments.filter(sc =>
        sc.student_name.toLowerCase().includes(commentSearch.toLowerCase()) ||
        sc.admission_number.toLowerCase().includes(commentSearch.toLowerCase())
      )
    : studentComments;

  // ── SMS helpers ──────────────────────────────────────────
  const fetchSMSStudents = useCallback(async () => {
    if (!selectedGradeStream) return;
    setLoadingSMSStudents(true);
    try {
      const res = await fetch('/api/school/data?type=students');
      const json = await res.json();
      const data = (json.data || []) as any[];
      const filtered = data
        .filter((s: any) => s.current_grade_stream_id === selectedGradeStream)
        .map((s: any) => ({
          id: s.id,
          admission_number: s.admission_number,
          guardian_phone: s.guardian_phone || null,
          guardian_name: s.guardian_name || null,
          users: s.users,
          selected: !!s.guardian_phone,
        }));
      setSmsStudents(filtered);
    } catch (err) {
      console.error('Failed to fetch SMS students:', err);
    }
    setLoadingSMSStudents(false);
  }, [selectedGradeStream]);

  useEffect(() => {
    if (showSMSModal) {
      fetchSMSStudents();
      setSmsResult(null);
    }
  }, [showSMSModal, fetchSMSStudents]);

  const toggleSMSStudent = (id: string) => {
    setSmsStudents(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const selectAllSMS = () => setSmsStudents(prev => prev.map(s => ({ ...s, selected: !!s.guardian_phone })));
  const deselectAllSMS = () => setSmsStudents(prev => prev.map(s => ({ ...s, selected: false })));

  const smsSelectedCount = smsStudents.filter(s => s.selected && s.guardian_phone).length;
  const smsMissingPhoneCount = smsStudents.filter(s => !s.guardian_phone).length;

  const filteredSMSStudents = smsSearch.trim()
    ? smsStudents.filter(s =>
        `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(smsSearch.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(smsSearch.toLowerCase())
      )
    : smsStudents;

  const handleSendSMS = async () => {
    const selected = smsStudents.filter(s => s.selected && s.guardian_phone);
    if (!selected.length) {
      showToastMsg('No students with valid phone numbers selected.');
      return;
    }
    setSendingSMS(true);
    setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selected.map(s => s.id),
          termId: selectedTerm,
          academicYearId: selectedAcademicYear,
          gradeStreamId: selectedGradeStream,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send SMS');
      setSmsResult({ sent: json.sent || 0, failed: json.failed || 0, skipped: json.skipped?.length || 0 });
      showToastMsg(`✅ SMS sent: ${json.sent} delivered, ${json.failed} failed`);
    } catch (err: any) {
      showToastMsg(`❌ ${err.message || 'SMS send failed'}`);
    }
    setSendingSMS(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto position-relative">
      <div className="hero-panel">
        <h1 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-display)] mb-4">Academic Reports</h1>
        <p className="text-lg opacity-90 max-w-2xl">Generate and download professional PDF report cards, bulk class sheets, and compare term performance with advanced analytics.</p>
      </div>

      {/* Dual-role navigation banner */}
      {isAlsoSubjectTeacher && (
          <a
              href="/dashboard/marks"
              className="mb-6 flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md"
              style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))',
                  borderColor: 'rgba(99,102,241,0.25)',
              }}
          >
              <span className="text-2xl">📚</span>
              <div className="flex-1">
                  <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Go to My Subjects</span>
                  <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>Enter and manage marks for your assigned subjects</span>
              </div>
              <span className="text-lg" style={{ color: 'rgba(99,102,241,0.7)' }}>→</span>
          </a>
      )}

      {/* Report Settings - MOVED TO TOP */}
      <div className="card glass-panel mb-8 relative z-10" style={{ marginTop: '-2rem' }}>
        <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Report Global Settings</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 -mt-2">Filter and apply these settings to generate individual or bulk report cards.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Year <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)} suppressHydrationWarning>
              <option value="">-- Choose Year --</option>
              {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} suppressHydrationWarning>
              <option value="">-- Choose Term --</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade Stream <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedGradeStream} onChange={e => setSelectedGradeStream(e.target.value)} suppressHydrationWarning>
              <option value="">-- Choose Stream --</option>
              {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Custom Title (Optional)</label>
            <input className="input-field w-full" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} suppressHydrationWarning />
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Individual Report */}
        <div className={`card text-center p-8 flex flex-col h-full ${!isConfigured ? 'opacity-50' : ''}`}>
          <img src="/images/dashboard_report_icon.png" alt="Report" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Individual Report</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Generate a single student report card.</p>
          <button 
            className="btn-secondary w-full justify-center disabled:cursor-not-allowed" 
            onClick={() => setShowStudentPicker(true)} 
            disabled={!isConfigured}
            title={!isConfigured ? "Please configure the Report Settings above first" : ""}
          >
            Select Student →
          </button>
        </div>

        {/* Bulk Reports */}
        <div className={`card text-center p-8 flex flex-col h-full ${!isConfigured ? 'opacity-50' : ''}`}>
          <img src="/images/dashboard_report_icon.png" alt="Empty" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Bulk Class Reports</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Generate and download all reports at once.</p>
          <button 
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleGenerateAndDownload} 
            disabled={!isConfigured || generating}
            title={!isConfigured ? "Please configure the Report Settings above first" : ""}
          >
            {generating ? 'Processing...' : 'Generate & Download →'}
          </button>
        </div>

        {/* Term Comparison */}
        <div className="card text-center p-8 flex flex-col h-full">
          <img src="/images/dashboard_comparison_icon.png" alt="Stats" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Term Comparison</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Compare performance across multiple terms.</p>
          <button className="btn-secondary w-full justify-center" onClick={() => setShowTermComparison(true)} suppressHydrationWarning>
            Compare Terms →
          </button>
        </div>

        {/* Class Mark Sheet */}
        <div className={`card text-center p-8 flex flex-col h-full ${!isConfigured ? 'opacity-50' : ''}`}>
          <img src="/images/dashboard_marks_icon.png" alt="Result" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Class Mark Sheet</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Ranked mark sheet with subject scores for the entire class.</p>
          <button 
            className="btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={handleGenerateMarkSheet} 
            disabled={!isConfigured || generatingMarkSheet}
            title={!isConfigured ? "Please configure the Report Settings above first" : ""}
          >
            {generatingMarkSheet ? 'Processing...' : 'Generate Mark Sheet →'}
          </button>
        </div>

        {/* SMS Results to Parents */}
        <div className={`card text-center p-8 flex flex-col h-full ${!isConfigured ? 'opacity-50' : ''}`}>
          <div className="mb-4 text-4xl">📱</div>
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">SMS Results to Parents</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Send student results to parents/guardians via SMS.</p>
          <button 
            className="btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={() => setShowSMSModal(true)} 
            disabled={!isConfigured}
            title={!isConfigured ? "Please configure the Report Settings above first" : ""}
          >
            Send SMS →
          </button>
        </div>

      </div>

      {/* ── Student Comments Section ── */}
      {isConfigured && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">📝 Student Comments</h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Add class teacher and principal comments for each student. These appear on PDF report cards.</p>
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? 'Hide Comments ▲' : 'Show Comments ▼'}
            </button>
          </div>

          {showComments && (
            <>
              {/* Search & Save All bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
                <input
                  className="input-field flex-1"
                  placeholder="Search students by name or admission number..."
                  value={commentSearch}
                  onChange={e => setCommentSearch(e.target.value)}
                />
                <button
                  className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                  onClick={handleSaveAllComments}
                  disabled={savingCommentId === 'all' || studentComments.length === 0}
                >
                  {savingCommentId === 'all' ? 'Saving All…' : `💾 Save All (${studentComments.length})`}
                </button>
              </div>

              {loadingComments ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 rounded-full border-3 border-[var(--color-border)] border-t-blue-600 animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-[var(--color-text-muted)]">Loading students…</p>
                </div>
              ) : filteredComments.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
                  {commentSearch ? 'No students match your search.' : 'No students found in this class.'}
                </p>
              ) : (
                <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
                  {filteredComments.map(sc => (
                    <div key={sc.student_id} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-semibold text-sm">{sc.student_name}</span>
                          <span className="text-xs text-[var(--color-text-muted)] ml-2 font-mono">{sc.admission_number}</span>
                        </div>
                        <button
                          className="btn-secondary text-xs py-1 px-3 disabled:opacity-50"
                          onClick={() => handleSaveComment(sc)}
                          disabled={savingCommentId === sc.student_id}
                        >
                          {savingCommentId === sc.student_id ? 'Saving…' : '💾 Save'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class Teacher&apos;s Comment</label>
                          <textarea
                            className="input-field w-full text-sm"
                            rows={2}
                            placeholder="e.g. Excellent progress this term..."
                            value={sc.comments_class_teacher}
                            onChange={e => updateComment(sc.student_id, 'comments_class_teacher', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Principal&apos;s Comment</label>
                          <textarea
                            className="input-field w-full text-sm"
                            rows={2}
                            placeholder="e.g. Keep up the good work..."
                            value={sc.comments_principal}
                            onChange={e => updateComment(sc.student_id, 'comments_principal', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Progress Overlay */}
      {(generating || generatingMarkSheet) && progress.message && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-8 text-center" style={{ animation: 'zoomIn 0.3s ease' }}>
            <h3 className="text-xl font-bold font-[family-name:var(--font-display)] mb-4">Processing Reports</h3>
            
            {progress.total > 0 ? (
              <div className="w-full bg-[var(--color-border)] rounded-full h-3 mb-2 overflow-hidden mx-auto mt-6">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                />
              </div>
            ) : (
              <div className="flex justify-center my-6">
                <div className="w-8 h-8 rounded-full border-4 border-[var(--color-border)] border-t-blue-600 animate-spin"></div>
              </div>
            )}
            
            <p className="text-sm font-medium mt-4">{progress.message}</p>
            {progress.total > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{progress.current} of {progress.total} generated</p>
            )}
          </div>
        </div>
      )}

      {/* Student Picker Modal */}
      {showStudentPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowStudentPicker(false); setStudentSearch(''); }}>
          <div className="card w-full max-w-lg" style={{ animation: 'fadeIn .2s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-4">Select a Student</h2>
            <input className="input-field w-full mb-4" placeholder="Search by name or admission number..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} autoFocus />
            <div className="overflow-y-auto flex-1" style={{ maxHeight: '50vh' }}>
              {loadingStudents ? (
                <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">Loading students...</p>
              ) : filteredStudents.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {filteredStudents.map(s => (
                    <button key={s.id} className="w-full text-left px-4 py-3 rounded-md hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer" style={{ border: 'none', background: 'transparent', color: 'inherit' }} onClick={() => handleStudentSelect(s.id)}>
                      <div className="font-medium text-sm">{s.users?.first_name || '—'} {s.users?.last_name || ''}</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">{s.admission_number}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[var(--color-text-muted)] py-6 text-sm">
                  {studentSearch ? 'No searches matched.' : 'No students found.'}
                </p>
              )}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-[var(--color-border)]">
              <button className="btn-secondary" onClick={() => { setShowStudentPicker(false); setStudentSearch(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {showSMSModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowSMSModal(false); setSmsSearch(''); }}>
          <div className="card w-full max-w-2xl" style={{ animation: 'fadeIn .2s ease', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">📱 SMS Results to Parents</h2>
              <button className="btn-secondary text-xs py-1 px-3" onClick={() => { setShowSMSModal(false); setSmsSearch(''); }}>✕ Close</button>
            </div>

            {/* Info banner */}
            <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
              <strong>How it works:</strong> Select students below to send their term results summary to their guardian&apos;s phone via SMS.
              {smsMissingPhoneCount > 0 && (
                <span className="block mt-1 text-amber-500">⚠ {smsMissingPhoneCount} student{smsMissingPhoneCount > 1 ? 's' : ''} missing guardian phone number.</span>
              )}
            </div>

            {/* Search + Select All */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
              <input
                className="input-field flex-1"
                placeholder="Search by name or admission number..."
                value={smsSearch}
                onChange={e => setSmsSearch(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1 px-3" onClick={selectAllSMS}>Select All</button>
                <button className="btn-secondary text-xs py-1 px-3" onClick={deselectAllSMS}>Deselect All</button>
              </div>
            </div>

            {/* Student list */}
            <div className="overflow-y-auto flex-1 mb-4" style={{ maxHeight: '40vh' }}>
              {loadingSMSStudents ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 rounded-full border-3 border-[var(--color-border)] border-t-blue-600 animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-[var(--color-text-muted)]">Loading students…</p>
                </div>
              ) : filteredSMSStudents.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
                  {smsSearch ? 'No students match your search.' : 'No students found in this class.'}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredSMSStudents.map(s => {
                    const name = `${s.users?.first_name || '—'} ${s.users?.last_name || ''}`;
                    const hasPhone = !!s.guardian_phone;
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${
                          s.selected ? 'bg-blue-500/10' : 'hover:bg-[var(--color-surface-raised)]'
                        } ${!hasPhone ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={s.selected}
                          disabled={!hasPhone}
                          onChange={() => toggleSMSStudent(s.id)}
                          className="accent-blue-600 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{name}</div>
                          <div className="text-xs text-[var(--color-text-muted)] font-mono">{s.admission_number}</div>
                        </div>
                        <div className="text-right">
                          {hasPhone ? (
                            <span className="text-xs text-green-500 font-mono">{s.guardian_phone}</span>
                          ) : (
                            <span className="text-xs text-red-400">No phone</span>
                          )}
                        </div>
                        {s.guardian_name && hasPhone && (
                          <div className="text-xs text-[var(--color-text-muted)] hidden md:block" style={{ maxWidth: 100 }}>
                            {s.guardian_name}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SMS Preview */}
            {smsSelectedCount > 0 && (
              <div className="rounded-lg p-3 mb-4 text-xs font-mono" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap' }}>
                <div className="text-[var(--color-text-muted)] mb-1 font-sans text-xs font-semibold">Message Preview:</div>
                {`MATOKEO Results: [Student Name]\n${terms.find(t => t.id === selectedTerm)?.name || 'Term'} ${academicYears.find(y => y.id === selectedAcademicYear)?.name || ''} - ${gradeStreams.find(g => g.id === selectedGradeStream)?.full_name || ''}\nAvg: 78.5% | Grade: B+ | Rank: 5/40\nMath 85 | Eng 72 | Sci 80 | ...`}
              </div>
            )}

            {/* Result feedback */}
            {smsResult && (
              <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: smsResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${smsResult.failed > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                ✅ Sent: <strong>{smsResult.sent}</strong> &nbsp;|&nbsp; ❌ Failed: <strong>{smsResult.failed}</strong>
                {smsResult.skipped > 0 && <> &nbsp;|&nbsp; ⏭ Skipped: <strong>{smsResult.skipped}</strong></>}
              </div>
            )}

            {/* Send button */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-text-muted)]">
                {smsSelectedCount} student{smsSelectedCount !== 1 ? 's' : ''} selected
                {smsSelectedCount > 0 && <span className="text-xs ml-1">(~KES {(smsSelectedCount * 0.8).toFixed(1)} est.)</span>}
              </span>
              <button
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSendSMS}
                disabled={sendingSMS || smsSelectedCount === 0}
              >
                {sendingSMS ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    Sending…
                  </span>
                ) : (
                  `📱 Send SMS to ${smsSelectedCount} Parent${smsSelectedCount !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifier */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', animation: 'fadeIn .25s ease' }}>
          {toast}
        </div>
      )}

      <TermComparisonModal
        isOpen={showTermComparison}
        onClose={() => setShowTermComparison(false)}
        academicYears={academicYears}
        terms={terms}
        gradeStreams={gradeStreams}
      />
    </div>
  );
}
