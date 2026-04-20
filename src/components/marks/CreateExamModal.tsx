"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

const EXAM_TYPES = ['CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER'];

interface DropdownItem { id: string; name: string; }
interface GradeItem { id: string; name_display: string; code: string; academic_level_id: string; }
interface TermItem { id: string; name: string; academic_year_id: string; }
interface StreamItem { id: string; name: string; full_name: string; grade_id: string; }
interface SubjectItem { id: string; name: string; code: string; academic_level_id: string; category?: string; }

interface Props {
  onClose: () => void;
  onCreated: (newExamId: string) => void;
  preselectedSubjectId?: string;
}

export function CreateExamModal({ onClose, onCreated, preselectedSubjectId }: Props) {
  const { user, profile } = useAuth();

  const [creating, setCreating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('MIDTERM');
  const [maxScore, setMaxScore] = useState(100);
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(preselectedSubjectId || '');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState('');

  // Dropdown data
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [academicYears, setAcademicYears] = useState<DropdownItem[]>([]);
  const [allTerms, setAllTerms] = useState<TermItem[]>([]);
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [allStreams, setAllStreams] = useState<StreamItem[]>([]);
  const [academicLevels, setAcademicLevels] = useState<DropdownItem[]>([]);
  const [gradingSystems, setGradingSystems] = useState<{ id: string; name: string; academic_level_id: string }[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  // Quick-add inline state
  const [addingSubject, setAddingSubject] = useState(false);
  const [addingYear, setAddingYear] = useState(false);
  const [addingTerm, setAddingTerm] = useState(false);
  const [addingStream, setAddingStream] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState('');
  const [qYear, setQYear] = useState({ name: '', start_date: '', end_date: '' });
  const [qTerm, setQTerm] = useState({ name: '', start_date: '', end_date: '' });
  const [qStream, setQStream] = useState({ name: '' });
  const [qSubject, setQSubject] = useState({ name: '', code: '', academic_level_id: '', grading_system_id: '' });

  // Fetch dropdowns once on mount
  const fetchDropdowns = useCallback(async () => {
    setDropdownsLoading(true);
    try {
      const res = await fetch('/api/admin/academic-structure');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load form data');
      if (data.subjects) setSubjects(data.subjects);
      if (data.academic_levels) setAcademicLevels(data.academic_levels);
      if (data.academic_years) {
        setAcademicYears(data.academic_years);
        if (data.academic_years.length > 0) setSelectedAcademicYearId(data.academic_years[0].id);
      }
      if (data.terms) setAllTerms(data.terms);
      if (data.grades) setGrades(data.grades);
      if (data.grade_streams) setAllStreams(data.grade_streams);
      if (data.grading_systems) setGradingSystems(data.grading_systems);
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
    setDropdownsLoading(false);
  }, []);

  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);
  useEffect(() => { setSelectedTermId(''); }, [selectedAcademicYearId]);
  useEffect(() => { setSelectedStreamId(''); }, [selectedGradeId]);

  const filteredTerms = allTerms.filter(t => t.academic_year_id === selectedAcademicYearId);
  const filteredStreams = allStreams.filter(s => s.grade_id === selectedGradeId);

  const quickAdd = async (type: string, payload: Record<string, unknown>) => {
    setQuickSaving(true);
    setQuickMsg('');
    try {
      const res = await fetch('/api/admin/academic-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, user_id: profile?.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setQuickMsg('✅ Added!');
      await fetchDropdowns();
      setTimeout(() => setQuickMsg(''), 2000);
      return data.data;
    } catch (err) {
      setQuickMsg(`❌ ${err instanceof Error ? err.message : 'Failed'}`);
      return null;
    } finally {
      setQuickSaving(false);
    }
  };

  const handleQuickAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qYear.name.trim() || !qYear.start_date || !qYear.end_date) return;
    const result = await quickAdd('academic_year', qYear);
    if (result) { setSelectedAcademicYearId(result.id); setQYear({ name: '', start_date: '', end_date: '' }); setAddingYear(false); }
  };

  const handleQuickAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademicYearId || !qTerm.name.trim() || !qTerm.start_date || !qTerm.end_date) return;
    const result = await quickAdd('term', { academic_year_id: selectedAcademicYearId, ...qTerm });
    if (result) { setSelectedTermId(result.id); setQTerm({ name: '', start_date: '', end_date: '' }); setAddingTerm(false); }
  };

  const handleQuickAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradeId || !qStream.name.trim()) return;
    const grade = grades.find(g => g.id === selectedGradeId);
    const fullName = `${grade?.name_display || ''} ${qStream.name.trim()}`.trim();
    const result = await quickAdd('stream', { grade_id: selectedGradeId, name: qStream.name.trim(), full_name: fullName });
    if (result) { setSelectedStreamId(result.id); setQStream({ name: '' }); setAddingStream(false); }
  };

  const handleQuickAddSubject = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!qSubject.name.trim() || !qSubject.code.trim() || !qSubject.academic_level_id) return;
    const result = await quickAdd('subject', qSubject);
    if (result) { setSelectedSubjectId(result.id); setQSubject({ name: '', code: '', academic_level_id: '', grading_system_id: '' }); setAddingSubject(false); }
  };

  const handleCreateExam = async () => {
    setSaveMessage(null);
    if (!examName.trim()) return setSaveMessage({ type: 'error', text: 'Exam name is required.' });
    if (!selectedSubjectId) return setSaveMessage({ type: 'error', text: 'Please select a subject.' });
    if (!selectedAcademicYearId) return setSaveMessage({ type: 'error', text: 'Please select an academic year.' });
    if (!selectedTermId) return setSaveMessage({ type: 'error', text: 'Please select a term.' });
    if (!selectedGradeId) return setSaveMessage({ type: 'error', text: 'Please select a grade.' });
    if (!examDate) return setSaveMessage({ type: 'error', text: 'Please set an exam date.' });
    if (maxScore <= 0) return setSaveMessage({ type: 'error', text: 'Max score must be greater than 0.' });

    setCreating(true);
    const insertPayload: Record<string, unknown> = {
      name: examName.trim(),
      exam_type: examType,
      subject_id: selectedSubjectId,
      academic_year_id: selectedAcademicYearId,
      term_id: selectedTermId,
      grade_id: selectedGradeId,
      max_score: maxScore,
      exam_date: examDate,
      created_by_teacher_id: user?.id || null,
    };
    if (selectedStreamId) insertPayload.grade_stream_id = selectedStreamId;

    const res = await fetch('/api/school/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertPayload),
    });

    if (!res.ok) {
      const errData = await res.json();
      setSaveMessage({ type: 'error', text: `Failed to create exam: ${errData.error || 'Unknown error'}` });
      setCreating(false);
      return;
    }

    const respData = await res.json();
    const newExamId = respData?.data?.id;
    setSaveMessage({ type: 'success', text: 'Exam created successfully!' });
    setCreating(false);
    if (newExamId) {
      setTimeout(() => { onCreated(newExamId); onClose(); }, 1200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ animation: 'fadeIn .2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Create New Exam</h2>

        {quickMsg && (
          <div className={`mb-4 p-2 rounded text-xs ${quickMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {quickMsg}
          </div>
        )}

        {dropdownsLoading ? (
          <div className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading form data…</div>
        ) : (
          <div className="flex flex-col gap-4 mb-6">
            {/* Exam Name + Type */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Name *</label>
                <input className="input-field w-full" placeholder="e.g. End of Term 1 Maths" value={examName} onChange={e => setExamName(e.target.value)} autoFocus />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Type *</label>
                <select className="input-field w-full" value={examType} onChange={e => setExamType(e.target.value)}>
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--color-text-muted)]">Subject *</label>
                {!preselectedSubjectId && (
                  <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingSubject(!addingSubject)}>
                    {addingSubject ? '✕ Cancel' : '+ Add'}
                  </button>
                )}
              </div>
              {preselectedSubjectId && subjects.find(s => s.id === preselectedSubjectId) ? (
                <div className="input-field w-full bg-[var(--color-surface-raised)] cursor-not-allowed opacity-80">
                  {subjects.find(s => s.id === preselectedSubjectId)?.name} ({subjects.find(s => s.id === preselectedSubjectId)?.code})
                </div>
              ) : !addingSubject ? (
                subjects.length === 0 ? (
                  <p className="text-xs text-orange-400">No subjects found. Click <strong>+ Add</strong> above.</p>
                ) : (
                  <select className="input-field w-full" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                    <option value="">-- Select Subject --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                )
              ) : null}
              {addingSubject && !preselectedSubjectId && (
                <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2 mt-1">
                  <div className="flex gap-2">
                    <input className="input-field flex-1 text-xs" placeholder="Subject Name" value={qSubject.name} onChange={e => setQSubject(p => ({ ...p, name: e.target.value }))} />
                    <input className="input-field w-28 text-xs font-mono uppercase" placeholder="Code" value={qSubject.code} onChange={e => setQSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <select className="input-field w-full text-xs" value={qSubject.academic_level_id} onChange={e => setQSubject(p => ({ ...p, academic_level_id: e.target.value, grading_system_id: '' }))}>
                    <option value="">-- Select Academic Level --</option>
                    {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
                  </select>
                  <select className="input-field w-full text-xs" value={qSubject.grading_system_id} onChange={e => setQSubject(p => ({ ...p, grading_system_id: e.target.value }))}>
                    <option value="">-- Grading System (Optional) --</option>
                    {gradingSystems.filter(gs => gs.academic_level_id === qSubject.academic_level_id).map(gs => <option key={gs.id} value={gs.id}>{gs.name}</option>)}
                  </select>
                  <button type="button" onClick={handleQuickAddSubject} className="btn-primary text-xs py-1" disabled={quickSaving || !qSubject.name.trim() || !qSubject.code.trim() || !qSubject.academic_level_id}>
                    {quickSaving ? '...' : '✓ Save Subject'}
                  </button>
                </div>
              )}
            </div>

            {/* Academic Year + Term */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[var(--color-text-muted)]">Academic Year *</label>
                  <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingYear(!addingYear)}>{addingYear ? '✕ Cancel' : '+ Add'}</button>
                </div>
                {academicYears.length === 0 && !addingYear ? (
                  <p className="text-xs text-orange-400">No years. Click <strong>+ Add</strong>.</p>
                ) : !addingYear ? (
                  <select className="input-field w-full" value={selectedAcademicYearId} onChange={e => setSelectedAcademicYearId(e.target.value)}>
                    <option value="">-- Select Year --</option>
                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                ) : null}
                {addingYear && (
                  <form onSubmit={handleQuickAddYear} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2">
                    <input className="input-field w-full text-xs" placeholder="Year name, e.g. 2026" value={qYear.name} onChange={e => setQYear(p => ({ ...p, name: e.target.value }))} />
                    <div className="flex gap-2">
                      <input type="date" className="input-field flex-1 text-xs" value={qYear.start_date} onChange={e => setQYear(p => ({ ...p, start_date: e.target.value }))} />
                      <input type="date" className="input-field flex-1 text-xs" value={qYear.end_date} onChange={e => setQYear(p => ({ ...p, end_date: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qYear.name.trim() || !qYear.start_date || !qYear.end_date}>{quickSaving ? '...' : '✓ Save Year'}</button>
                  </form>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[var(--color-text-muted)]">Term *</label>
                  {selectedAcademicYearId && (
                    <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingTerm(!addingTerm)}>{addingTerm ? '✕ Cancel' : '+ Add'}</button>
                  )}
                </div>
                {!selectedAcademicYearId ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Select a year first.</p>
                ) : filteredTerms.length === 0 && !addingTerm ? (
                  <p className="text-xs text-orange-400">No terms. Click <strong>+ Add</strong>.</p>
                ) : !addingTerm ? (
                  <select className="input-field w-full" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
                    <option value="">-- Select Term --</option>
                    {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                ) : null}
                {addingTerm && selectedAcademicYearId && (
                  <form onSubmit={handleQuickAddTerm} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2">
                    <input className="input-field w-full text-xs" placeholder="e.g. Term 1" value={qTerm.name} onChange={e => setQTerm(p => ({ ...p, name: e.target.value }))} />
                    <div className="flex gap-2">
                      <input type="date" className="input-field flex-1 text-xs" value={qTerm.start_date} onChange={e => setQTerm(p => ({ ...p, start_date: e.target.value }))} />
                      <input type="date" className="input-field flex-1 text-xs" value={qTerm.end_date} onChange={e => setQTerm(p => ({ ...p, end_date: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qTerm.name.trim() || !qTerm.start_date || !qTerm.end_date}>{quickSaving ? '...' : '✓ Save Term'}</button>
                  </form>
                )}
              </div>
            </div>

            {/* Grade + Stream */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade *</label>
                {grades.length === 0 ? (
                  <p className="text-xs text-orange-400">No grades found.</p>
                ) : (
                  <select className="input-field w-full" value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)}>
                    <option value="">-- Select Grade --</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
                  </select>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[var(--color-text-muted)]">Stream (optional)</label>
                  {selectedGradeId && (
                    <button type="button" className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setAddingStream(!addingStream)}>{addingStream ? '✕ Cancel' : '+ Add'}</button>
                  )}
                </div>
                {!selectedGradeId ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Select a grade first.</p>
                ) : addingStream ? null : filteredStreams.length === 0 ? (
                  <select className="input-field w-full" disabled><option>No streams — click + Add</option></select>
                ) : (
                  <select className="input-field w-full" value={selectedStreamId} onChange={e => setSelectedStreamId(e.target.value)}>
                    <option value="">-- All Streams --</option>
                    {filteredStreams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                )}
                {addingStream && selectedGradeId && (
                  <form onSubmit={handleQuickAddStream} className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-col gap-2 mt-1">
                    <input className="input-field w-full text-xs" placeholder="Stream name, e.g. A" value={qStream.name} onChange={e => setQStream({ name: e.target.value })} />
                    <button type="submit" className="btn-primary text-xs py-1" disabled={quickSaving || !qStream.name.trim()}>{quickSaving ? '...' : '✓ Save Stream'}</button>
                  </form>
                )}
              </div>
            </div>

            {/* Max Score + Date */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Max Score *</label>
                <input type="number" className="input-field w-full" min={1} max={1000} value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Exam Date *</label>
                <input type="date" className="input-field w-full" value={examDate} onChange={e => setExamDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            saveMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            {saveMessage.text}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={creating}>Cancel</button>
          <button className="btn-primary disabled:opacity-50" onClick={handleCreateExam} disabled={creating || dropdownsLoading}>
            {creating ? 'Creating...' : 'Create Exam'}
          </button>
        </div>
      </div>
    </div>
  );
}
