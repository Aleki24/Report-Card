"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ExamResultsTable, type MarkRow } from '@/components/exam-results/ExamResultsTable';
import { ExamAnalysisPanel } from '@/components/exam-results/ExamAnalysisPanel';
import { QuickMarkEntry } from '@/components/exam-results/QuickMarkEntry';
import { AllSubjectsView } from '@/components/exam-results/AllSubjectsView';

interface GradeStreamOption { id: string; full_name: string; grade_id: string; }
interface ExamOption { id: string; name: string; exam_type: string; max_score: number; subject_name: string; subject_code: string; subject_id: string; grade_id: string; term_id: string; }
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; academic_year_id: string; is_current: boolean; }

type Tab = 'allsubjects' | 'results' | 'analysis' | 'quickentry' | 'reports';

const EXAM_TYPE_LABELS: Record<string, string> = {
  OPENER: '📝 Opener', MIDTERM: '📋 Midterm', ENDTERM: '📊 End Term', CAT: '📌 CAT',
};
const EXAM_TYPE_ORDER = ['OPENER', 'MIDTERM', 'ENDTERM', 'CAT'];

export default function ExamResultsPage() {
  const { user } = useAuth();

  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [loadingStreams, setLoadingStreams] = useState(true);

  // Term + exam type cascade
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [allExams, setAllExams] = useState<ExamOption[]>([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loadingExams, setLoadingExams] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('allsubjects');
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [loadingMarks, setLoadingMarks] = useState(false);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customReportTitle, setCustomReportTitle] = useState('');

  // ── Fetch grade streams + terms ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [streamsRes, termsRes, yearsRes] = await Promise.all([
          fetch('/api/school/data?type=grade_streams'),
          fetch('/api/school/data?type=terms'),
          fetch('/api/school/data?type=academic_years'),
        ]);
        const [sJson, tJson, yJson] = await Promise.all([streamsRes.json(), termsRes.json(), yearsRes.json()]);
        setGradeStreams(sJson.data || []);
        setTerms(tJson.data || []);
        setAcademicYears(yJson.data || []);
        // Auto-select current term
        const current = (tJson.data || []).find((t: Term) => t.is_current);
        if (current) setSelectedTermId(current.id);
        else if (tJson.data?.length > 0) setSelectedTermId(tJson.data[0].id);
        if (yJson.data?.length > 0) setSelectedYearId(yJson.data[0].id);
      } catch (err) { console.error('Failed to fetch data:', err); }
      setLoadingStreams(false);
    };
    fetchData();
  }, []);

  // ── Fetch exams when stream + term change ──
  useEffect(() => {
    if (!selectedStreamId || !selectedTermId) { setAllExams([]); setSelectedExamType(''); setSelectedExamId(''); return; }
    setLoadingExams(true);
    setSelectedExamType('');
    setSelectedExamId('');

    const fetchExams = async () => {
      try {
        const stream = gradeStreams.find(s => s.id === selectedStreamId);
        if (!stream) { setLoadingExams(false); return; }

        const params = new URLSearchParams({
          stream_id: selectedStreamId,
          grade_id: stream.grade_id,
          term_id: selectedTermId,
        });
        const res = await fetch(`/api/school/exams?${params.toString()}`);
        const json = await res.json();

        const mapped = (json.data || []).map((e: any) => ({
          id: e.id, name: e.name, exam_type: e.exam_type, max_score: e.max_score,
          subject_name: e.subject_name || 'N/A', subject_code: e.subject_code || '',
          subject_id: e.subject_id, grade_id: e.grade_id, term_id: e.term_id,
        }));
        setAllExams(mapped);
      } catch (err) { console.error('Failed to fetch exams:', err); }
      setLoadingExams(false);
    };
    fetchExams();
  }, [selectedStreamId, selectedTermId, gradeStreams]);

  // ── Derived: exam types available ──
  const examTypes = useMemo(() =>
    [...new Set(allExams.map(e => e.exam_type))].sort(
      (a, b) => EXAM_TYPE_ORDER.indexOf(a) - EXAM_TYPE_ORDER.indexOf(b)
    ), [allExams]);

  // ── Derived: exams for selected type ──
  const examsForType = useMemo(() =>
    allExams.filter(e => e.exam_type === selectedExamType)
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    [allExams, selectedExamType]);

  // ── Fetch marks for selected exam ──
  const fetchMarks = useCallback(async () => {
    if (!selectedExamId) { setMarks([]); return; }
    setLoadingMarks(true);
    try {
      const res = await fetch(`/api/school/exam-marks?exam_id=${selectedExamId}`);
      const json = await res.json();

      const mapped: MarkRow[] = (json.data || []).map((m: any) => ({
        id: m.id, student_id: m.student_id, student_name: m.student_name,
        admission_number: m.admission_number, raw_score: Number(m.raw_score),
        percentage: Number(m.percentage || 0), grade_symbol: m.grade_symbol || '-',
        remarks: m.remarks,
      }));
      setMarks(mapped);
    } catch (err) { console.error('Failed to fetch marks:', err); }
    setLoadingMarks(false);
  }, [selectedExamId]);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  const selectedTermName = terms.find(t => t.id === selectedTermId)?.name || '';

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
      if (!res.ok) setReportMsg({ type: 'error', text: `Failed: ${data.error}` });
      else setReportMsg({ type: 'success', text: 'Bulk reports generated successfully!' });
    } catch { setReportMsg({ type: 'error', text: 'Unexpected error generating reports.' }); }
    setReportGenerating(false);
  };

  const selectedExam = allExams.find(e => e.id === selectedExamId);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Exam Results</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Select term, class, and exam type to view results and generate reports
        </p>
      </div>

      {/* ══════ FILTERS: Term + Class + Exam Type ══════ */}
      <div className="card mb-4" style={{ padding: 'var(--space-5)' }}>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {/* Term */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium">① Term</label>
            <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
              <option value="">-- Select Term --</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.name} {t.is_current ? '(current)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium">② Class</label>
            <select className="input-field w-full" value={selectedStreamId} onChange={e => { setSelectedStreamId(e.target.value); setActiveTab('allsubjects'); }} disabled={loadingStreams}>
              <option value="">-- Select Class --</option>
              {gradeStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          {/* Exam Type */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium">③ Exam Type</label>
            {loadingExams ? (
              <div className="input-field w-full" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
            ) : (
              <select className="input-field w-full" value={selectedExamType} onChange={e => { setSelectedExamType(e.target.value); setSelectedExamId(''); }} disabled={!selectedStreamId || !selectedTermId}>
                <option value="">{!selectedStreamId || !selectedTermId ? 'Select term & class first' : '-- Select Exam Type --'}</option>
                {examTypes.map(t => (
                  <option key={t} value={t}>{(EXAM_TYPE_LABELS[t] || t).replace(/[📝📋📊📌] /, '')} ({allExams.filter(e => e.exam_type === t).length} subjects)</option>
                ))}
              </select>
            )}
          </div>

          {/* Subject/Exam */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium">④ Subject</label>
            <select className="input-field w-full" value={selectedExamId} onChange={e => { setSelectedExamId(e.target.value); setActiveTab('results'); }} disabled={!selectedExamType}>
              <option value="">{!selectedExamType ? 'Select exam type first' : '-- Select Subject --'}</option>
              {examsForType.map(e => (
                <option key={e.id} value={e.id}>{e.subject_name} ({e.subject_code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedStreamId && selectedTermId && (
        <>
          {selectedExamId && selectedExam && (
            <div className="mb-4 p-3 rounded-md text-sm" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06))', border: '1px solid var(--color-border)' }}>
              <strong>{selectedTermName}</strong> · <strong>{EXAM_TYPE_LABELS[selectedExam.exam_type] || selectedExam.exam_type}</strong> · <strong>{selectedExam.subject_name}</strong> · Max: {selectedExam.max_score}
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
            <div className="card"><InlineLoadingSkeleton rows={6} /></div>
          ) : (
            <>
              {activeTab === 'allsubjects' && <AllSubjectsView gradeStreamId={selectedStreamId} />}

              {activeTab === 'results' && selectedExamId && (
                <ExamResultsTable marks={marks} maxScore={selectedExam?.max_score || 100} examId={selectedExamId} gradeStreamId={selectedStreamId} onRefresh={fetchMarks} />
              )}
              {activeTab === 'results' && !selectedExamId && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Select a subject above to view results.</p>
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
                        <select className="input-field w-full" value={selectedTermId} disabled>
                          {terms.filter(t => t.id === selectedTermId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                      <div className="student-reports-grid">
                        {marks.map(m => (
                          <button key={m.student_id} className="btn-secondary text-left" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', fontSize: 13 }} onClick={() => handleDownloadReport(m.student_id)}>
                            <span style={{ fontSize: 18 }}>📄</span>
                            <span><strong>{m.student_name}</strong><br /><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.admission_number}</span></span>
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

      {/* Empty state */}
      {(!selectedStreamId || !selectedTermId) && !loadingStreams && (
        <div className="card text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">Select a term and class above to view exam results</p>
        </div>
      )}
    </div>
  );
}
