"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Search, BookOpen, Plus } from 'lucide-react';
import { PREDEFINED_SUBJECTS, EducationLevel } from '@/lib/subject-definitions';

interface AcademicLevel { id: string; code: string; name: string; }
interface Subject { id: string; name: string; code: string; category?: string; academic_level_id?: string; is_compulsory?: boolean; grading_system_id?: string | null; }

const categoryColors: Record<string, { bg: string; color: string }> = {
  LANGUAGE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' },
  MATHEMATICS: { bg: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' },
  SCIENCE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
  HUMANITY: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
  TECHNICAL: { bg: 'rgba(249, 115, 22, 0.15)', color: '#F97316' },
  CREATIVE: { bg: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' },
};

export default function SubjectsPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [calSaving, setCalSaving] = useState(false);
  const [calMsg, setCalMsg] = useState('');
  const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', is_compulsory: true });
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<EducationLevel | ''>('');
  const [tableLevelFilter, setTableLevelFilter] = useState('');
  const [selectedPredefinedSubject, setSelectedPredefinedSubject] = useState('');

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

  const toggleSubjectType = async (id: string, currentStatus: boolean) => {
    setCalSaving(true); setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subject', id, is_compulsory: !currentStatus })
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

  const compulsory = subjects.filter(s => s.is_compulsory).length;
  const categories = [...new Set(subjects.map(s => (s.category || 'TECHNICAL').toUpperCase()))];

  if (loading) return <ContentSkeleton message="Loading subjects..." />;

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">Subject Management</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage subjects, assign teachers, and organize by curriculum.</p>
      </div>

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
      {role === 'ADMIN' && (
        <div className="card mb-6">
          <h3 className="font-bold text-sm font-[family-name:var(--font-display)] mb-3 flex items-center gap-2"><BookOpen size={16}/> Add Subject</h3>
          
          <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-md border border-border/50">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-muted-foreground mb-1">Filter by System / Level</label>
              <select 
                className="input-field w-full text-sm" 
                value={selectedLevelFilter} 
                onChange={e => {
                  setSelectedLevelFilter(e.target.value as EducationLevel);
                  setSelectedPredefinedSubject('');
                }}
              >
                <option value="">-- All Levels --</option>
                <option value="CBC_LOWER_PRIMARY">CBC Lower Primary</option>
                <option value="CBC_UPPER_PRIMARY">CBC Upper Primary</option>
                <option value="CBC_JUNIOR_SCHOOL">CBC Junior School</option>
                <option value="CBC_SENIOR_SCHOOL">CBC Senior School</option>
                <option value="844_SECONDARY">8-4-4 Secondary</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-muted-foreground mb-1">Select Predefined Subject</label>
              <select 
                className="input-field w-full text-sm" 
                value={selectedPredefinedSubject} 
                onChange={e => {
                  setSelectedPredefinedSubject(e.target.value);
                  if (!e.target.value) return;
                  const [name, code] = e.target.value.split('|');
                  const subj = PREDEFINED_SUBJECTS.find(s => s.name === name && s.code === code);
                  if (subj) {
                    // Auto-match the academic level from the predefined subject's education level
                    const levelCode = subj.level.startsWith('CBC') ? 'CBC' : subj.level.startsWith('844') ? '844' : '';
                    const matchedLevel = academicLevels.find(al => al.code === levelCode);
                    setNewSubject(p => ({
                      ...p,
                      name: subj.name,
                      code: subj.code,
                      category: subj.category || 'TECHNICAL',
                      academic_level_id: matchedLevel?.id || p.academic_level_id,
                    }));
                  }
                }}
              >
                <option value="">-- Custom / Select --</option>
                {PREDEFINED_SUBJECTS.filter(s => !selectedLevelFilter || s.level === selectedLevelFilter).map(s => {
                  const pathwayLabel = s.pathway === 'STEM' ? ' — STEM' : s.pathway === 'ARTS_SPORTS' ? ' — Arts & Sports' : s.pathway === 'SOCIAL_SCIENCES' ? ' — Social Sciences' : s.isCore && s.level === 'CBC_SENIOR_SCHOOL' ? ' — Core' : '';
                  return (
                    <option key={s.name + s.code} value={`${s.name}|${s.code}`}>{s.name} ({s.code}){pathwayLabel}</option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-muted-foreground mb-1">Name *</label>
              <input className="input-field w-full text-sm" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="w-24">
              <label className="block text-xs text-muted-foreground mb-1">Code *</label>
              <input className="input-field w-full text-sm font-mono uppercase" placeholder="MAT" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
            </div>
            <div className="w-32">
              <label className="block text-xs text-muted-foreground mb-1">Category</label>
              <select className="input-field w-full text-sm" value={newSubject.category || 'TECHNICAL'} onChange={e => setNewSubject(p => ({ ...p, category: e.target.value }))}>
                {Object.keys(categoryColors).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs text-muted-foreground mb-1">Type *</label>
              <select className="input-field w-full text-sm" value={newSubject.is_compulsory ? 'true' : 'false'} onChange={e => setNewSubject(p => ({ ...p, is_compulsory: e.target.value === 'true' }))}>
                <option value="true">Compulsory</option>
                <option value="false">Optional</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-muted-foreground mb-1">Academic Level *</label>
              <select className="input-field w-full text-sm" value={newSubject.academic_level_id} onChange={e => setNewSubject(p => ({ ...p, academic_level_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={async () => {
              await postStructure('subject', newSubject);
              setNewSubject({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', is_compulsory: true });
              setSelectedPredefinedSubject('');
            }} className="btn-primary text-sm py-2 px-4 whitespace-nowrap" disabled={calSaving || !newSubject.name.trim() || !newSubject.code.trim() || !newSubject.academic_level_id}>
              {calSaving ? 'Saving...' : '+ Add Subject'}
            </button>
          </div>
        </div>
      )}

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
                      <td className="px-4 py-3">{s.is_compulsory ? <span className="badge badge-success text-xs">Compulsory</span> : <span className="badge badge-warning text-xs">Optional</span>}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getLevelName(s.academic_level_id)}</td>
                      <td className="px-4 py-3 text-right">
                        {role === 'ADMIN' && (
                          <div className="flex justify-end gap-3 items-center">
                            <button className="text-xs text-blue-500 hover:text-blue-400 font-medium" onClick={() => toggleSubjectType(s.id, !!s.is_compulsory)} disabled={calSaving}>
                              🔄 Make {s.is_compulsory ? 'Optional' : 'Compulsory'}
                            </button>
                            <button className="text-xs text-red-400 hover:text-red-300 font-medium" onClick={() => deleteSubject(s.id)} disabled={calSaving}>🗑 Delete</button>
                          </div>
                        )}
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
