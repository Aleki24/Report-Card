"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Search, BookOpen } from 'lucide-react';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface Stream { id: string; grade_id: string; name: string; full_name: string; }
interface Subject { id: string; name: string; code: string; category?: string; academic_level_id?: string; subject_type?: 'CORE' | 'ESSENTIAL' | 'OPTIONAL'; grading_system_id?: string | null; }

const categoryColors: Record<string, { bg: string; color: string }> = {
  LANGUAGE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' },
  MATHEMATICS: { bg: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' },
  SCIENCE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
  HUMANITY: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
  TECHNICAL: { bg: 'rgba(249, 115, 22, 0.15)', color: '#F97316' },
  CREATIVE: { bg: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' },
};

type Tab = 'streams' | 'subjects';

export default function AcademicStructurePage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('streams');

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Academic Structure</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage classes, streams, and subjects</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {([{ id: 'streams', label: 'Class Streams' }, { id: 'subjects', label: 'Subjects' }] as { id: Tab; label: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'streams' ? <ClassStreamsTab /> : <SubjectsTab />}
    </div>
  );
}

function ClassStreamsTab() {
  const { profile } = useAuth();
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalGradeId, setSelectedCalGradeId] = useState('');
  const [calMsg, setCalMsg] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [newStream, setNewStream] = useState({ name: '', full_name: '' });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [structureRes, streamsRes] = await Promise.all([
        fetch('/api/admin/academic-structure', { cache: 'no-store' }),
        fetch('/api/school/data?type=grade_streams', { cache: 'no-store' }),
      ]);
      const [structureData, streamsData] = await Promise.all([structureRes.json(), streamsRes.json()]);
      setAcademicLevels(structureData.academic_levels || []);
      setGrades(structureData.grades || []);
      setStreams(streamsData.data || []);
    } catch (err) { console.error('Error fetching settings data:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (profile?.id) fetchAllData(); }, [profile?.id, fetchAllData]);

  const postStructure = async (type: string, payload: Record<string, unknown>) => {
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch('/api/admin/academic-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg('✅ Added successfully');
      await fetchAllData();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const deleteStructure = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure?type=${type}&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setCalMsg('✅ Deleted successfully');
      await fetchAllData();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalGradeId) return;
    const grade = grades.find(g => g.id === selectedCalGradeId);
    const finalName = newStream.name.trim() || grade?.name_display || 'Class';
    const finalFullName = newStream.full_name.trim() || (newStream.name.trim() ? `${grade?.name_display || ''} ${finalName}`.trim() : finalName);
    await postStructure('stream', { grade_id: selectedCalGradeId, name: finalName, full_name: finalFullName });
    if (!calMsg.startsWith('❌')) setNewStream({ name: '', full_name: '' });
  };

  const calStreams = streams.filter(s => s.grade_id === selectedCalGradeId);

  if (loading) return <ContentSkeleton message="Loading classes..." />;

  return (
    <div>
      {calMsg && (
        <div className={`mb-4 p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {calMsg}
        </div>
      )}

      <div className="card mb-6">
        <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">🏷️ Class Streams</h3>
        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1">Select Grade</label>
          {grades.length === 0 ? (
            <p className="text-xs text-orange-400">No grades found. Run seed SQL first.</p>
          ) : (
            <select className="input-field w-full md:w-64" value={selectedCalGradeId} onChange={e => setSelectedCalGradeId(e.target.value)}>
              <option value="">-- Select Grade --</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
            </select>
          )}
        </div>

        {selectedCalGradeId && (
          <form onSubmit={handleAddStream} className="flex flex-wrap items-end gap-3 p-4 border border-border rounded-lg bg-muted/30 mt-2">
            <div className="w-full mb-1">
              <h4 className="text-sm font-bold">Add New Class</h4>
              <p className="text-xs text-muted-foreground">Leave stream name blank to just use the grade name as the class.</p>
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-xs text-muted-foreground mb-1">Stream Name (Optional)</label>
              <input className="input-field w-full" placeholder="e.g. East, A" value={newStream.name} onChange={e => setNewStream(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-muted-foreground mb-1">Full Name (Auto-filled if blank)</label>
              <input className="input-field w-full" placeholder="e.g. Grade 7A" value={newStream.full_name} onChange={e => setNewStream(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving}>{calSaving ? 'Saving...' : 'Save Class'}</button>
          </form>
        )}
      </div>

      {selectedCalGradeId && (
        <div className="card">
          <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">🏫 Classes for {grades.find(g => g.id === selectedCalGradeId)?.name_display}</h3>
          {calStreams.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="data-table w-full text-left sm:whitespace-nowrap">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Class/Stream</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Full Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {calStreams.map(s => (
                    <tr key={s.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-bold">{s.name}</td>
                      <td className="px-4 py-3 text-sm">{s.full_name}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteStructure('stream', s.id)} disabled={calSaving}>🗑 Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
              <p className="text-sm text-blue-400 mb-1">ℹ️ No classes added for this grade yet.</p>
              <p className="text-xs text-blue-400/80">Add at least one class so students and teachers can be assigned.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectsTab() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [calSaving, setCalSaving] = useState(false);
  const [calMsg, setCalMsg] = useState('');
  const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '', subject_type: 'CORE' });
  const [tableLevelFilter, setTableLevelFilter] = useState('');

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/admin/academic-structure');
      const json = await res.json();
      if (res.ok) {
        setSubjects(json.subjects || []);
        setAcademicLevels(json.academic_levels || []);
      }
    } catch (err) { console.error('Failed to fetch subjects:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubjects(); }, []);

  const postStructure = async (type: string, payload: Record<string, unknown>) => {
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch('/api/admin/academic-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg('✅ Added successfully');
      await fetchSubjects();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setCalMsg('✅ Deleted');
      await fetchSubjects();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const toggleSubjectType = async (id: string, newStatus: string) => {
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subject', id, subject_type: newStatus })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setCalMsg('✅ Updated successfully');
      await fetchSubjects();
    } catch (err) { setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`); }
    finally { setCalSaving(false); }
  };

  const getLevelName = (levelId?: string) => levelId ? academicLevels.find(l => l.id === levelId)?.name || '—' : '—';

  const filtered = subjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'ALL' || (s.category || '').toUpperCase() === categoryFilter;
    const matchLevel = !tableLevelFilter || s.academic_level_id === tableLevelFilter;
    return matchSearch && matchCategory && matchLevel;
  });

  const compulsory = subjects.filter(s => s.subject_type === 'CORE' || s.subject_type === 'ESSENTIAL').length;
  const categories = [...new Set(subjects.map(s => (s.category || 'TECHNICAL').toUpperCase()))];

  if (loading) return <ContentSkeleton message="Loading subjects..." />;

  return (
    <div>
      {calMsg && (
        <div className={`mb-4 p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {calMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Subjects', value: subjects.length.toString() },
          { label: 'Compulsory', value: compulsory.toString() },
          { label: 'Optional', value: (subjects.length - compulsory).toString() },
          { label: 'Departments', value: categories.length.toString() },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add Subject Form */}
      <div className="card mb-6">
        <h3 className="font-bold text-sm font-[family-name:var(--font-display)] mb-3">📚 Add Subject</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-muted-foreground mb-1">Name *</label>
            <input className="input-field w-full text-sm" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="w-24">
            <label className="block text-xs text-muted-foreground mb-1">Code *</label>
            <input className="input-field w-full text-sm font-mono uppercase" placeholder="MAT" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-muted-foreground mb-1">Academic Level *</label>
            <select className="input-field w-full text-sm" value={newSubject.academic_level_id} onChange={e => setNewSubject(p => ({ ...p, academic_level_id: e.target.value }))}>
              <option value="">-- Select --</option>
              {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-muted-foreground mb-1">Type *</label>
            <select className="input-field w-full text-sm" value={newSubject.subject_type} onChange={e => setNewSubject(p => ({ ...p, subject_type: e.target.value }))}>
              <option value="CORE">Core</option>
              <option value="ESSENTIAL">Essential</option>
              <option value="OPTIONAL">Optional</option>
            </select>
          </div>
          <button type="button" onClick={async () => {
            await postStructure('subject', newSubject);
            setNewSubject({ name: '', code: '', academic_level_id: '', subject_type: 'CORE' });
          }} className="btn-primary text-sm py-2 px-4 whitespace-nowrap" disabled={calSaving || !newSubject.name.trim() || !newSubject.code.trim() || !newSubject.academic_level_id}>
            {calSaving ? '...' : '+ Add Subject'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6">
          <div className="flex items-center input-field overflow-hidden px-0 flex-1 min-w-[200px] max-w-[400px]">
            <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0">
              <Search size={16} />
            </span>
            <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm" placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field" value={tableLevelFilter} onChange={e => setTableLevelFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="">All Levels</option>
            {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
          </select>
          <select className="input-field" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">No subjects found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Level</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map(s => {
                  const catKey = (s.category || 'TECHNICAL').toUpperCase();
                  const cat = categoryColors[catKey] || { bg: 'rgba(100,100,100,0.15)', color: 'var(--color-text-muted)' };
                  return (
                    <tr key={s.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-sm">{s.code}</td>
                      <td className="px-4 py-3"><span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: cat.bg, color: cat.color }}>{catKey}</span></td>
                      <td className="px-4 py-3">
                        {s.subject_type === 'CORE' && <span className="badge badge-success text-xs">Core</span>}
                        {s.subject_type === 'ESSENTIAL' && <span className="badge badge-info bg-blue-500/10 text-blue-500 text-xs">Essential</span>}
                        {s.subject_type === 'OPTIONAL' && <span className="badge badge-warning text-xs">Optional</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getLevelName(s.academic_level_id)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 items-center">
                          <select
                            className="text-xs bg-transparent border border-border rounded p-1 ml-2 outline-none"
                            value={s.subject_type || 'CORE'}
                            onChange={(e) => toggleSubjectType(s.id, e.target.value)}
                            disabled={calSaving}
                          >
                            <option value="CORE">Make Core</option>
                            <option value="ESSENTIAL">Make Essential</option>
                            <option value="OPTIONAL">Make Optional</option>
                          </select>
                          <button className="text-xs text-red-400 hover:text-red-300 font-medium" onClick={() => deleteSubject(s.id)} disabled={calSaving}>🗑 Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
