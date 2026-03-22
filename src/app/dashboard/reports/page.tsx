"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TermComparisonModal } from '@/components/reports/TermComparisonModal';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import { ReportCardDocument, ReportCardData } from '@/lib/pdfGenerator';
import QRCode from 'qrcode';

interface StudentOption {
  id: string;
  admission_number: string;
  users: { first_name: string; last_name: string } | null;
}

interface GradeStreamOption { id: string; full_name: string; }
interface AcademicYearOption { id: string; name: string; }
interface TermOption { id: string; name: string; academic_year_id?: string; }

export default function ReportsPage() {
  const [selectedGradeStream, setSelectedGradeStream] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [customReportTitle, setCustomReportTitle] = useState('');
  
  const [generating, setGenerating] = useState(false);
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

      // 3. Local PDF processing
      const total = reportCardsData.length;
      setProgress({ current: 0, total, message: 'Step 3 of 3: Generating PDFs from data...' });

      const zip = new JSZip();

      for (let i = 0; i < total; i++) {
        const reportData = reportCardsData[i];
        
        // Update UI asynchronously every file
        setProgress({ current: i + 1, total, message: `Creating PDF for ${reportData.studentName}...` });
        
        // Ensure UI updates render by waiting a tick
        await new Promise(r => setTimeout(r, 10));

        let qrCodeDataUri = undefined;
        if (reportData.resultUrl) {
          try {
            qrCodeDataUri = await QRCode.toDataURL(reportData.resultUrl, { margin: 1, width: 64 });
          } catch (e) {
            console.error("Failed to generate QR code", e);
          }
        }

        const blob = await pdf(<ReportCardDocument data={reportData} qrCodeDataUri={qrCodeDataUri} />).toBlob();
        
        const pName = `${reportData.studentName.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`;
        zip.file(pName, blob);
      }

      setProgress({ current: total, total, message: 'Bundling ZIP archive...' });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const termName = terms.find(t => t.id === selectedTerm)?.name || 'Term';
      const streamName = gradeStreams.find(s => s.id === selectedGradeStream)?.full_name || 'Class';
      
      link.download = `${streamName}_${termName}_Reports.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      showToastMsg('✅ Download complete!');
    } catch (err: any) {
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

  const isConfigured = selectedGradeStream && selectedAcademicYear && selectedTerm;

  return (
    <div className="w-full max-w-7xl mx-auto position-relative">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Reports</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Generate and download professional PDF report cards</p>
      </div>

      {/* Report Settings - MOVED TO TOP */}
      <div className="card mb-8">
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-4">Report Global Settings</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4 -mt-2">Filter and apply these settings to generate individual or bulk report cards.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Year <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)}>
              <option value="">-- Choose Year --</option>
              {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">-- Choose Term --</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade Stream <span className="text-red-500">*</span></label>
            <select className="input-field w-full" value={selectedGradeStream} onChange={e => setSelectedGradeStream(e.target.value)}>
              <option value="">-- Choose Stream --</option>
              {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Custom Title (Optional)</label>
            <input className="input-field w-full" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Individual Report */}
        <div className={`card text-center p-8 flex flex-col h-full ${!isConfigured ? 'opacity-50' : ''}`}>
          <div className="text-4xl mb-4">📋</div>
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
          <div className="text-4xl mb-4">📦</div>
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
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Term Comparison</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-grow">Compare performance across multiple terms.</p>
          <button className="btn-secondary w-full justify-center" onClick={() => setShowTermComparison(true)}>
            Compare Terms →
          </button>
        </div>

      </div>

      {/* Progress Overlay */}
      {generating && progress.message && (
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
