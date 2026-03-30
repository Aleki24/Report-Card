"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ExamResultsTable, type MarkRow } from '@/components/exam-results/ExamResultsTable';
import { ExamAnalysisPanel } from '@/components/exam-results/ExamAnalysisPanel';
import { QuickMarkEntry } from '@/components/exam-results/QuickMarkEntry';
import { AllSubjectsView } from '@/components/exam-results/AllSubjectsView';

interface GradeStreamOption { id: string; full_name: string; grade_id: string; }
interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_name: string; }
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; academic_year_id: string; }

type Tab = 'allsubjects' | 'results' | 'analysis' | 'quickentry' | 'reports';

export default function ExamResultsPage() {
  const { user } = useAuth();

  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('allsubjects');
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [allTerms, setAllTerms] = useState<Term[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customReportTitle, setCustomReportTitle] = useState('');

  // ── Fetch grade streams via school-scoped API ──────────────
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await fetch('/api/school/data?type=grade_streams');
        const json = await res.json();
        setGradeStreams(json.data || []);
      } catch (err) {
        console.error('Failed to fetch grade streams:', err);
      }
      setLoadingStreams(false);
    };
    fetchStreams();
  }, []);

  // ── Fetch exams for selected stream via server API ─────────
  useEffect(() => {
    if (!selectedStreamId) { setExams([]); setSelectedExamId(''); return; }

    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const stream = gradeStreams.find(s => s.id === selectedStreamId);
        if (!stream) { setLoadingExams(false); return; }

        const params = new URLSearchParams({
          stream_id: selectedStreamId,
          grade_id: stream.grade_id,
        });
        const res = await fetch(`/api/school/exams?${params.toString()}`);
        const json = await res.json();

        const mapped = (json.data || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          exam_type: e.exam_type,
          max_score: e.max_score,
          subject_name: e.subject_name || 'N/A',
        }));
        setExams(mapped);
        setSelectedExamId(mapped[0]?.id || '');
      } catch (err) {
        console.error('Failed to fetch exams:', err);
      }
      setLoadingExams(false);
    };
    fetchExams();
  }, [selectedStreamId, gradeStreams]);

  // ── Fetch marks for selected exam via server API ───────────
  const fetchMarks = useCallback(async () => {
    if (!selectedExamId) { setMarks([]); return; }
    setLoadingMarks(true);
    try {
      const res = await fetch(`/api/school/exam-marks?exam_id=${selectedExamId}`);
      const json = await res.json();

      const mapped: MarkRow[] = (json.data || []).map((m: any) => ({
        id: m.id,
        student_id: m.student_id,
        student_name: m.student_name,
        admission_number: m.admission_number,
        raw_score: Number(m.raw_score),
        percentage: Number(m.percentage || 0),
        grade_symbol: m.grade_symbol || '-',
        remarks: m.remarks,
      }));
      setMarks(mapped);
    } catch (err) {
      console.error('Failed to fetch marks:', err);
    }
    setLoadingMarks(false);
  }, [selectedExamId]);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  // ── Fetch academic years + terms via school-scoped API ─────
  useEffect(() => {
    const fetchYearsTerms = async () => {
      try {
        const [yearsRes, termsRes] = await Promise.all([
          fetch('/api/school/data?type=academic_years'),
          fetch('/api/school/data?type=terms'),
        ]);
        const [yearsJson, termsJson] = await Promise.all([
          yearsRes.json(), termsRes.json(),
        ]);
        setAcademicYears(yearsJson.data || []);
        setAllTerms(termsJson.data || []);
        if (yearsJson.data?.length > 0) setSelectedYearId(yearsJson.data[0].id);
      } catch (err) {
        console.error('Failed to fetch years/terms:', err);
      }
    };
    fetchYearsTerms();
  }, []);

  useEffect(() => { setSelectedTermId(''); }, [selectedYearId]);

  const filteredTerms = allTerms.filter(t => t.academic_year_id === selectedYearId);

  const handleDownloadReport = (studentId: string) => {
    const params = new URLSearchParams();
    if (selectedTermId) params.set('term', selectedTermId);
    if (selectedYearId) params.set('year', selectedYearId);
    if (customReportTitle) params.set('customTitle', customReportTitle);
    window.open(`/api/reports/student/${studentId}?${params.toString()}`, '_blank');
  };

  const handleBulkReports = async () => {
    if (!selectedTermId || !selectedStreamId) {
      setReportMsg({ type: 'error', text: 'Select a term and class to generate bulk reports.' });
      return;
    }
    setReportGenerating(true);
    setReportMsg(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term_id: selectedTermId,
          grade_stream_id: selectedStreamId,
          academic_year_id: selectedYearId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportMsg({ type: 'error', text: `Failed: ${data.error}` });
      } else {
        setReportMsg({ type: 'success', text: 'Bulk reports generated successfully!' });
      }
    } catch {
      setReportMsg({ type: 'error', text: 'Unexpected error generating reports.' });
    }
    setReportGenerating(false);
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Exam Results</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Select a class and exam to view results, analyze performance, and generate reports
        </p>
      </div>

      {/* Guide */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">How to manage exams & reports:</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li><strong>Step 1:</strong> Select a Class and an Exam to view the results. (Exams are created in Settings).</li>
            <li><strong>Step 2:</strong> Use the <strong>Quick Entry</strong> tab to rapidly enter marks for all students in the class.</li>
            <li><strong>Step 3:</strong> Navigate to the <strong>Reports</strong> tab to generate and download individual or bulk PDF report cards.</li>
          </ul>
        </div>
      </div>

      {/* Cascading Filters */}
      <div className="card flex flex-col md:flex-row md:items-end" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div className="flex-1">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class / Stream</label>
          <select
            className="input-field w-full"
            value={selectedStreamId}
            onChange={e => { setSelectedStreamId(e.target.value); setActiveTab('results'); }}
            disabled={loadingStreams}
          >
            <option value="">-- Select Class --</option>
            {gradeStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam</label>
          <select
            className="input-field w-full"
            value={selectedExamId}
            onChange={e => { setSelectedExamId(e.target.value); setActiveTab('results'); }}
            disabled={!selectedStreamId || loadingExams}
          >
            {!selectedStreamId ? (
              <option value="">Select a class first</option>
            ) : loadingExams ? (
              <option value="">Loading…</option>
            ) : exams.length === 0 ? (
              <option value="">No exams found</option>
            ) : (
              exams.map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.subject_name} ({e.exam_type})</option>
              ))
            )}
          </select>
        </div>
      </div>

      {selectedStreamId && (
        <>
          {selectedExamId && selectedExam && (
            <div className="mb-4 p-3 rounded-md text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
              <strong>Exam:</strong> {selectedExam.name} · <strong>Subject:</strong> {selectedExam.subject_name} · <strong>Max Score:</strong> {selectedExam.max_score}
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md overflow-hidden" style={{ marginBottom: 'var(--space-6)' }}>
            {([
              { key: 'allsubjects', label: '📊 All Subjects' },
              { key: 'results', label: '📋 Single Exam' },
              { key: 'analysis', label: '📈 Analysis' },
              { key: 'quickentry', label: '✏️ Quick Entry' },
              { key: 'reports', label: '📄 Reports' },
            ] as { key: Tab; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 font-[family-name:var(--font-display)] font-semibold text-sm transition-all duration-150 ease-in-out ${activeTab === tab.key ? 'bg-[var(--color-accent)] text-white' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'}`}
                style={{ padding: 'var(--space-3) var(--space-4)' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingMarks ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading marks…</p>
            </div>
          ) : (
            <>
              {activeTab === 'allsubjects' && <AllSubjectsView gradeStreamId={selectedStreamId} />}

              {activeTab === 'results' && selectedExamId && (
                <ExamResultsTable marks={marks} maxScore={selectedExam?.max_score || 100} examId={selectedExamId} gradeStreamId={selectedStreamId} onRefresh={fetchMarks} />
              )}
              {activeTab === 'results' && !selectedExamId && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Select an exam above to view individual results.</p>
                </div>
              )}

              {activeTab === 'analysis' && selectedExamId && <ExamAnalysisPanel marks={marks} />}

              {activeTab === 'quickentry' && selectedExamId && (
                <QuickMarkEntry examId={selectedExamId} gradeStreamId={selectedStreamId} onSaved={fetchMarks} />
              )}

              {activeTab === 'reports' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-4)' }}>Report Settings</h3>
                    <div className="flex flex-col md:flex-row" style={{ gap: 'var(--space-4)' }}>
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Year</label>
                        <select className="input-field w-full" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
                          <option value="">-- Select Year --</option>
                          {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term</label>
                        <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} disabled={!selectedYearId}>
                          <option value="">-- Select Term --</option>
                          {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Custom Report Title (Optional)</label>
                      <input className="input-field w-full" placeholder="e.g. Mid Term 1 Report" value={customReportTitle} onChange={e => setCustomReportTitle(e.target.value)} />
                    </div>
                  </div>

                  <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-2)' }}>📥 Individual Student Reports (PDF)</h3>
                    <p className="text-sm text-[var(--color-text-muted)]" style={{ marginBottom: 'var(--space-4)' }}>Click a student to download their PDF report card.</p>
                    {marks.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No students with marks to generate reports for.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                        {marks.map(m => (
                          <button key={m.student_id} className="btn-secondary text-left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', fontSize: 13 }} onClick={() => handleDownloadReport(m.student_id)}>
                            <span style={{ fontSize: 18 }}>📄</span>
                            <span>
                              <strong>{m.student_name}</strong>
                              <br />
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.admission_number}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-2)' }}>📦 Bulk Report Generation</h3>
                    <p className="text-sm text-[var(--color-text-muted)]" style={{ marginBottom: 'var(--space-4)' }}>Generate report cards for all students in the selected class and term.</p>
                    <button className="btn-primary disabled:opacity-50" onClick={handleBulkReports} disabled={reportGenerating || !selectedTermId}>
                      {reportGenerating ? 'Generating…' : 'Generate All Reports'}
                    </button>
                    {reportMsg && (
                      <div className={`mt-3 p-3 rounded-md text-sm ${reportMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                        {reportMsg.text}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
