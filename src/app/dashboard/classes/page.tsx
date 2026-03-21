"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface Stream { id: string; grade_id: string; name: string; full_name: string; }

export default function ClassesPage() {
  const { profile } = useAuth();
  
  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCalGradeId, setSelectedCalGradeId] = useState('');
  
  const [calMsg, setCalMsg] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [newStream, setNewStream] = useState({ name: '', full_name: '' });
  const [showStreamForm, setShowStreamForm] = useState(false);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [structureRes, streamsRes] = await Promise.all([
        fetch('/api/admin/academic-structure'),
        fetch('/api/school/data?type=grade_streams'),
      ]);

      const [structureData, streamsData] = await Promise.all([
        structureRes.json(),
        streamsRes.json(),
      ]);

      setAcademicLevels(structureData.academic_levels || []);
      setGrades(structureData.grades || []);
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
    
    // If name is left blank, default to "General" or simply the grade name
    const finalName = newStream.name.trim() || 'General';
    const finalFullName = newStream.full_name.trim() || `${grade?.name_display || ''} ${finalName}`.trim();
    
    await postStructure('stream', { grade_id: selectedCalGradeId, name: finalName, full_name: finalFullName });
    if (!calMsg.startsWith('❌')) {
      setNewStream({ name: '', full_name: '' });
      setShowStreamForm(false);
    }
  };

  const calStreams = streams.filter(s => s.grade_id === selectedCalGradeId);

  // When changing grade, collapse the form
  useEffect(() => {
    setShowStreamForm(false);
  }, [selectedCalGradeId]);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Manage Classes</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Configure class designations and streams</p>
      </div>

      {/* Guide */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">How to manage classes:</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li><strong>Step 1:</strong> Select a Grade to view its classes (streams/sections).</li>
            <li><strong>Step 2:</strong> If no streams exist, click <strong>+ Add a Stream/Section</strong>. Leave the name blank for a default &quot;General&quot; stream.</li>
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
              <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">🏷️ Classes / Streams</h3>
              <div className="mb-4">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Select Grade</label>
                {grades.length === 0 ? (
                  <p className="text-xs text-orange-400">No grades found. Run seed SQL first.</p>
                ) : (
                  <select className="input-field w-full md:w-64" value={selectedCalGradeId} onChange={e => setSelectedCalGradeId(e.target.value)}>
                    <option value="">-- Select Grade --</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name_display} ({academicLevels.find(l => l.id === g.academic_level_id)?.code || ''})</option>
                    ))}
                  </select>
                )}
              </div>
              
              {selectedCalGradeId && (
                <>
                  {calStreams.length > 0 ? (
                    <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg mb-4">
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
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
                      <p className="text-sm text-blue-400 mb-1">ℹ️ No streams found for this grade.</p>
                      <p className="text-xs text-blue-400/80">If your school only has one class per grade, you do not need to add streams. Just selecting the Grade above is sufficient.</p>
                    </div>
                  )}

                  {!showStreamForm ? (
                    <button 
                      onClick={() => setShowStreamForm(true)} 
                      className="text-sm px-4 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded hover:bg-[var(--color-border)] transition-colors"
                    >
                      + Add a Stream/Section
                    </button>
                  ) : (
                    <form onSubmit={handleAddStream} className="flex flex-wrap items-end gap-3 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-raised)]/30">
                      <div className="w-full mb-1">
                        <h4 className="text-sm font-bold">Add New Stream</h4>
                        <p className="text-xs text-[var(--color-text-muted)]">Leave stream name blank to default to "General"</p>
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
                        <button type="button" onClick={() => setShowStreamForm(false)} className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving}>
                          {calSaving ? 'Saving...' : 'Save Stream'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
