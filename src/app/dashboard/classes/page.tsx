"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface Stream { id: string; grade_id: string; name: string; full_name: string; }
interface Subject { id: string; name: string; code: string; academic_level_id: string; }

export default function ClassesPage() {
  const { profile } = useAuth();
  
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCalGradeId, setSelectedCalGradeId] = useState('');
  
  const [calMsg, setCalMsg] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [newStream, setNewStream] = useState({ name: '', full_name: '' });
  const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '' });
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [structureRes, streamsRes] = await Promise.all([
        fetch('/api/admin/academic-structure', { cache: 'no-store' }),
        fetch('/api/school/data?type=grade_streams', { cache: 'no-store' }),
      ]);

      const [structureData, streamsData] = await Promise.all([
        structureRes.json(),
        streamsRes.json(),
      ]);

      setAcademicLevels(structureData.academic_levels || []);
      setGrades(structureData.grades || []);
      setSubjects(structureData.subjects || []);
      setStreams(streamsData.data || []);
      
    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.id) fetchAllData();
  }, [profile?.id, fetchAllData]);

  const postStructure = async (type: string, payload: Record<string, unknown>) => {
    setCalSaving(true);
    setCalMsg('');
    try {
      const res = await fetch('/api/admin/academic-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg(`✅ ${type.replace('_', ' ')} added successfully`);
      await fetchAllData();
      return data.data;
    } catch (err) {
      setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    } finally {
      setCalSaving(false);
    }
  };

  const deleteStructure = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setCalSaving(true);
    setCalMsg('');
    try {
      const res = await fetch(`/api/admin/academic-structure?type=${type}&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCalMsg('✅ Deleted successfully');
      await fetchAllData();
    } catch (err) {
      setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCalSaving(false);
    }
  };

  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalGradeId) return;
    const grade = grades.find(g => g.id === selectedCalGradeId);
    // If name is left blank, use the grade's default name instead of "General"
    const finalName = newStream.name.trim() || grade?.name_display || 'Class';
    const finalFullName = newStream.full_name.trim() || (newStream.name.trim() ? `${grade?.name_display || ''} ${finalName}`.trim() : finalName);
    
    await postStructure('stream', { grade_id: selectedCalGradeId, name: finalName, full_name: finalFullName });
    if (!calMsg.startsWith('❌')) {
      setNewStream({ name: '', full_name: '' });
    }
  };

  const calStreams = streams.filter(s => s.grade_id === selectedCalGradeId);



  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Manage Classes</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Configure class designations and streams</p>
      </div>

      {/* Guide */}
      <div className="my-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-8 rounded-xl flex items-start gap-5 leading-relaxed tracking-wide">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-2 text-base">How to manage classes:</h3>
          <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
            <li><strong>Step 1:</strong> Select a Grade to view its classes (streams/sections).</li>
            <li><strong>Step 2:</strong> Use the <strong>Add New Class</strong> form below. Leave the stream name blank to simply use the Grade name (e.g. &quot;Grade 5&quot; or &quot;Form 3&quot;).</li>
            <li><strong>Step 3:</strong> Manage <strong>Subjects</strong> taught in your school below. Assign each subject to the correct Academic Level.</li>
            <li><strong>Note:</strong> Grades and Academic Levels are managed by the initial school setup script.</li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--color-text-muted)]">Loading classes...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 flex flex-col gap-6">
            {calMsg && (
              <div className={`p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {calMsg}
              </div>
            )}
            
            <div className="card">
              <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">🏷️ Manage Classes</h3>
              <div className="mb-4">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Select Grade</label>
                {grades.length === 0 ? (
                  <p className="text-xs text-orange-400">No grades found. Run seed SQL first.</p>
                ) : (
                  <select className="input-field w-full md:w-64" value={selectedCalGradeId} onChange={e => setSelectedCalGradeId(e.target.value)}>
                    <option value="">-- Select Grade --</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name_display}</option>
                    ))}
                  </select>
                )}
              </div>
              
              {selectedCalGradeId && (
                <form onSubmit={handleAddStream} className="flex flex-wrap items-end gap-3 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-raised)]/30 mt-2">
                  <div className="w-full mb-1">
                    <h4 className="text-sm font-bold">Add New Class</h4>
                    <p className="text-xs text-[var(--color-text-muted)]">Leave stream name blank to just use the grade name as the class.</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Stream Name (Optional)</label>
                    <input className="input-field w-full" placeholder="e.g. East, A" value={newStream.name} onChange={e => setNewStream(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Full Name (Auto-filled if blank)</label>
                    <input className="input-field w-full" placeholder="e.g. Grade 7A" value={newStream.full_name} onChange={e => setNewStream(p => ({ ...p, full_name: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving}>
                      {calSaving ? 'Saving...' : 'Save Class'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {selectedCalGradeId && (
              <div className="card">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">
                  🏫 Added Classes for {grades.find(g => g.id === selectedCalGradeId)?.name_display}
                </h3>
                {calStreams.length > 0 ? (
                  <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
                    <table className="data-table w-full text-left sm:whitespace-nowrap">
                      <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Class/Stream</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Full Name</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {calStreams.map(s => (
                          <tr key={s.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
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
                    <p className="text-xs text-blue-400/80">Ensure you add at least one class for this grade (even if it has no streams) so students and teachers can be assigned to it.</p>
                  </div>
                )}
              </div>
            )}

            {/* Subjects Card */}
            <div className="card">
              <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📚 Subjects</h3>
              
              <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md p-3 flex flex-wrap gap-3 mb-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Subject Name *</label>
                  <input className="input-field w-full text-sm" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Code *</label>
                  <input className="input-field w-full text-sm font-mono uppercase" placeholder="MAT" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Level *</label>
                  <select className="input-field w-full text-sm" value={newSubject.academic_level_id} onChange={e => setNewSubject(p => ({ ...p, academic_level_id: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {academicLevels.map(al => (
                      <option key={al.id} value={al.id}>{al.name}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={async () => {
                  await postStructure('subject', newSubject);
                  setNewSubject({ name: '', code: '', academic_level_id: '' });
                }} className="btn-primary text-sm py-2 px-4 whitespace-nowrap" disabled={calSaving || !newSubject.name.trim() || !newSubject.code.trim() || !newSubject.academic_level_id}>
                  {calSaving ? '...' : '+ Add Subject'}
                </button>
              </div>

              <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
                <table className="data-table w-full sm:whitespace-nowrap text-left">
                  <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Code</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Subject Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Curriculum</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {subjects.map(sub => (
                      <tr key={sub.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                        <td className="px-4 py-3 font-mono text-sm">{sub.code}</td>
                        <td className="px-4 py-3 font-medium">{sub.name}</td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] text-sm">
                          {academicLevels.find(l => l.id === sub.academic_level_id)?.code || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteStructure('subject', sub.id)} disabled={calSaving}>🗑 Delete</button>
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-[var(--color-text-muted)] text-sm">No subjects found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
