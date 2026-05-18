"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ClipboardList, PenTool, Trophy, Calendar, Search, Upload, Download, Plus, Save, FileText, BarChart3, X, Check, AlertCircle } from 'lucide-react';

type Tab = 'exams' | 'marks' | 'results';

export default function ExamsMarksPage() {
  const [tab, setTab] = useState<Tab>('exams');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Exams & Marks</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage exam schedules, enter marks, and view results</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {([{ id: 'exams' as const, label: 'Schedule', icon: <Calendar size={16} /> },
          { id: 'marks' as const, label: 'Mark Entry', icon: <PenTool size={16} /> },
          { id: 'results' as const, label: 'Results & Analysis', icon: <Trophy size={16} /> }]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'exams' && <ExamsTab />}
      {tab === 'marks' && <MarksTab />}
      {tab === 'results' && <ResultsTab />}
    </div>
  );
}

/* ───── Shared types and helpers ───── */
interface GradeStreamOption { id: string; full_name: string; }
interface TermOption { id: string; name: string; }
interface ExamOption { id: string; name: string; subject?: string; grade?: string; max_score?: number; date?: string; }

/* ───── Exams (Schedule) Tab ───── */
function ExamsTab() {
  const { role } = useAuth();
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStream, setSelectedStream] = useState('');
  const [examTypes, setExamTypes] = useState<{ id: string; name: string }[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'all' | 'results' | 'analysis' | 'quick-entry' | 'reports'>('all');

  useEffect(() => {
    const init = async () => {
      try {
        const [gsRes, etRes] = await Promise.all([fetch('/api/school/data?type=grade_streams'), fetch('/api/school/data?type=exam_types')]);
        const [gsJson, etJson] = await Promise.all([gsRes.json(), etRes.json()]);
        setGradeStreams(gsJson.data || []);
        setExamTypes(etJson.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedStream || !selectedType) { setExams([]); return; }
    const fetchExams = async () => {
      try {
        const res = await fetch(`/api/school/data?type=exam_slots&grade_stream_id=${selectedStream}&exam_type_id=${selectedType}`);
        const json = await res.json();
        setExams(json.data || []);
      } catch { setExams([]); }
    };
    fetchExams();
  }, [selectedStream, selectedType]);

  if (loading) return <ContentSkeleton message="Loading exam data..." />;

  const subTabs = [{ id: 'all' as const, label: 'All Subjects' }, { id: 'results' as const, label: 'Results' }, { id: 'analysis' as const, label: 'Analysis' }, { id: 'quick-entry' as const, label: 'Quick Entry' }, { id: 'reports' as const, label: 'Reports' }];

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input-field text-xs min-w-[200px]" value={selectedStream} onChange={e => setSelectedStream(e.target.value)}>
          <option value="">All Streams</option>
          {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
        </select>
        <select className="input-field text-xs min-w-[200px]" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
          <option value="">All Exam Types</option>
          {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
        </select>
      </div>

      <div className="flex gap-1 mb-5 p-1 bg-muted/50 border border-border rounded-lg w-fit flex-wrap">
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${subTab === st.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{st.label}</button>
        ))}
      </div>

      {exams.length === 0 ? (
        <div className="card text-center py-12 text-muted-foreground">
          <Calendar size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">No exams found. Select a stream and exam type above.</p>
        </div>
      ) : subTab === 'all' ? (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="data-table w-full text-left">
            <thead className="bg-muted"><tr><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Exam</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Max Score</th></tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {exams.map(ex => <tr key={ex.id} className="hover:bg-muted"><td className="px-4 py-3 font-medium">{ex.name}</td><td className="px-4 py-3 text-sm">{ex.subject || '—'}</td><td className="px-4 py-3 text-sm">{ex.date ? new Date(ex.date).toLocaleDateString() : '—'}</td><td className="px-4 py-3 text-sm">{ex.max_score || '—'}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : subTab === 'results' || subTab === 'analysis' ? (
        <div className="card text-center py-12 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">{subTab === 'results' ? 'Select a specific exam to view its results.' : 'Select a specific exam to view analysis.'}</p>
        </div>
      ) : subTab === 'quick-entry' ? (
        <div className="card text-center py-12 text-muted-foreground">
          <PenTool size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Switch to the <strong>Mark Entry</strong> tab to enter scores.</p>
        </div>
      ) : (
        <div className="card text-center py-12 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Generate report cards from the selected exam data.</p>
        </div>
      )}
    </div>
  );
}

/* ───── Marks (Entry) Tab ───── */
interface StudentMarkRow { id: string; student_name: string; admission_number: string; score: number | null; max_score: number; }
interface GradeStreamOption2 { id: string; full_name: string; }
interface TermOption2 { id: string; name: string; }
interface ExamTypeOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; code?: string; }

function MarksTab() {
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption2[]>([]);
  const [terms, setTerms] = useState<TermOption2[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [exams, setExams] = useState<{ id: string; name: string; subject_name?: string; max_score?: number; subject?: string }[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [marks, setMarks] = useState<StudentMarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    Promise.all([
      fetch('/api/school/data?type=grade_streams').then(r => r.json()),
      fetch('/api/school/data?type=terms').then(r => r.json()),
      fetch('/api/school/data?type=exam_types').then(r => r.json()),
    ]).then(([gs, t, et]) => { setGradeStreams(gs.data || []); setTerms(t.data || []); setExamTypes(et.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStream || !selectedTerm) { setExams([]); return; }
    let url = `/api/school/data?type=exam_slots&grade_stream_id=${selectedStream}`;
    if (selectedType) url += `&exam_type_id=${selectedType}`;
    fetch(url).then(r => r.json()).then(j => setExams(j.data || [])).catch(() => setExams([]));
  }, [selectedStream, selectedTerm, selectedType]);

  const fetchMarks = useCallback(async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/school/data?type=exam_marks&exam_slot_id=${selectedExam}`);
      const json = await res.json();
      setMarks(json.data || []);
    } catch { showToast('Failed to load marks'); }
    finally { setLoading(false); }
  }, [selectedExam]);

  useEffect(() => { if (selectedExam) fetchMarks(); }, [selectedExam, fetchMarks]);

  const handleSaveMarks = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exam_slot_id: selectedExam, marks: marks.map(m => ({ student_id: m.id, score: m.score })) }) });
      if (!res.ok) throw new Error('Save failed');
      showToast('✅ Marks saved');
      await fetchMarks();
    } catch (err: any) { showToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast && <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg bg-muted border border-border text-foreground animate-in fade-in slide-in-from-bottom-5 duration-300">{toast}</div>}

      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input-field text-xs min-w-[180px]" value={selectedStream} onChange={e => { setSelectedStream(e.target.value); setSelectedExam(''); }}>
          <option value="">Grade Stream</option>
          {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
        </select>
        <select className="input-field text-xs min-w-[150px]" value={selectedTerm} onChange={e => { setSelectedTerm(e.target.value); setSelectedExam(''); }}>
          <option value="">Term</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input-field text-xs min-w-[150px]" value={selectedType} onChange={e => { setSelectedType(e.target.value); setSelectedExam(''); }}>
          <option value="">Exam Type</option>
          {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
        </select>
        <select className="input-field text-xs min-w-[200px]" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">Select Exam</option>
          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} {ex.subject_name ? `(${ex.subject_name})` : ''}</option>)}
        </select>
      </div>

      {selectedExam && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm font-display">Student Marks</h3>
            <button className="btn-primary text-xs px-4 py-2 flex items-center gap-2" onClick={handleSaveMarks} disabled={saving}><Save size={14} />{saving ? 'Saving...' : 'Save All'}</button>
          </div>
          {loading ? <ContentSkeleton message="Loading marks..." /> : marks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><p className="text-sm">No marks found for this exam.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left">
                <thead className="bg-muted"><tr><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Admission No.</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Score</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Max</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {marks.map(m => (
                    <tr key={m.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-medium text-sm">{m.student_name}</td>
                      <td className="px-4 py-3 text-sm font-mono">{m.admission_number}</td>
                      <td className="px-4 py-3">
                        <input type="number" className="input-field w-20 text-sm" min="0" max={m.max_score || 100} value={m.score ?? ''} onChange={e => setMarks(prev => prev.map(x => x.id === m.id ? { ...x, score: e.target.value ? parseFloat(e.target.value) : null } : x))} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{m.max_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───── Results Tab ───── */
function ResultsTab() {
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStream, setSelectedStream] = useState('');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<'results' | 'analysis'>('results');

  useEffect(() => {
    fetch('/api/school/data?type=grade_streams').then(r => r.json()).then(j => setGradeStreams(j.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedStream) { setExams([]); return; }
    fetch(`/api/school/data?type=exam_slots&grade_stream_id=${selectedStream}`).then(r => r.json()).then(j => setExams(j.data || [])).catch(() => setExams([]));
  }, [selectedStream]);

  useEffect(() => {
    if (!selectedExam) { setResults([]); return; }
    setLoading(true);
    fetch(`/api/school/data?type=exam_marks&exam_slot_id=${selectedExam}`).then(r => r.json()).then(j => {
      setResults(j.data || []);
    }).catch(() => setResults([])).finally(() => setLoading(false));
  }, [selectedExam]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input-field text-xs min-w-[200px]" value={selectedStream} onChange={e => { setSelectedStream(e.target.value); setSelectedExam(''); }}>
          <option value="">Grade Stream</option>
          {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
        </select>
        <select className="input-field text-xs min-w-[200px]" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option value="">Select Exam</option>
          {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </div>

      <div className="flex gap-1 mb-5 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        <button onClick={() => setSubTab('results')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${subTab === 'results' ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Results</button>
        <button onClick={() => setSubTab('analysis')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${subTab === 'analysis' ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Analysis</button>
      </div>

      {!selectedExam ? (
        <div className="card text-center py-12 text-muted-foreground">
          <Trophy size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Select a stream and exam to view results.</p>
        </div>
      ) : loading ? <ContentSkeleton message="Loading results..." /> : subTab === 'results' ? (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="data-table w-full text-left">
            <thead className="bg-muted"><tr><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Student</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Admission No.</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Score</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Max</th><th className="px-4 py-3 text-xs font-semibold text-muted-foreground">%</th></tr></thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {results.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">{r.student_name}</td>
                  <td className="px-4 py-3 text-sm font-mono">{r.admission_number}</td>
                  <td className="px-4 py-3 text-sm">{r.score ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.max_score}</td>
                  <td className="px-4 py-3 text-sm">{r.score != null && r.max_score ? `${((r.score / r.max_score) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-12 text-muted-foreground">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Analysis view — coming soon with performance charts and statistics.</p>
        </div>
      )}
    </div>
  );
}
