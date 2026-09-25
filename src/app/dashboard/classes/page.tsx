"use client";

import { CardHeading } from '@/components/ui/CardHeading';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import PageHeader from '@/components/dashboard/PageHeader';
import Link from 'next/link';
import { ArrowRight, School, Layers, BookOpen } from 'lucide-react';
import { classNames } from '@/lib/classes';

interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface Stream { id: string; grade_id: string; name: string; full_name: string; }

export default function ClassesPage() {
  const { profile } = useAuth();
  
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

      const [structureData, streamsData] = await Promise.all([
        structureRes.json(),
        streamsRes.json(),
      ]);

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

  /** Returns whether the save succeeded, so forms clear only on success. */
  const postStructure = async (type: string, payload: Record<string, unknown>): Promise<boolean> => {
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
      return true;
    } catch (err) {
      setCalMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setCalSaving(false);
    }
  };

  const deleteStructure = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setCalSaving(true);
    setCalMsg('');
    try {
      const url = `/api/admin/academic-structure?type=${type}&id=${id}`;
      const res = await fetch(url, { method: 'DELETE' });
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
    // A blank stream name makes the grade's single class, named after the grade.
    const names = classNames(grade?.name_display || 'Class', newStream.name);
    const finalName = names.name;
    const finalFullName = newStream.full_name.trim() || names.full_name;
    
    // calMsg read here would be the value from before this save (state is
    // captured by the closure), so the form used to clear after a failure.
    if (await postStructure('stream', { grade_id: selectedCalGradeId, name: finalName, full_name: finalFullName })) {
      setNewStream({ name: '', full_name: '' });
    }
  };

  const calStreams = streams.filter(s => s.grade_id === selectedCalGradeId);



  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Classes"
        eyebrow="School"
        icon={School}
        hue="amber"
        description="Select a grade to add or remove its class streams."
      />

      {loading ? (
        <ContentSkeleton message="Loading classes..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 flex flex-col gap-6">
            {calMsg && (
              <div className={`p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {calMsg}
              </div>
            )}
            
            <div className="card">
              <CardHeading icon={Layers} hue="amber" title="Class streams" description="Pick a grade, then add or remove its streams (e.g. East, West)." />
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-2">Select Grade</label>
                {grades.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">No grades are set up yet. Choose your curriculum in Settings → Academic Structure first.</p>
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
                <form onSubmit={handleAddStream} className="flex flex-wrap items-end gap-3 p-4 border border-border rounded-lg bg-muted/30 mt-2">
                  <div className="w-full mb-1">
                    <h4 className="text-sm font-bold">Add New Class</h4>
                    <p className="text-xs text-muted-foreground">Leave stream name blank to just use the grade name as the class.</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-xs text-muted-foreground mb-2">Stream Name (Optional)</label>
                    <input className="input-field w-full" placeholder="e.g. East, A" value={newStream.name} onChange={e => setNewStream(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs text-muted-foreground mb-2">Full Name (Auto-filled if blank)</label>
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
                <CardHeading icon={School} hue="amber" title={`Streams in ${grades.find(g => g.id === selectedCalGradeId)?.name_display ?? 'this grade'}`} />
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
                    <p className="text-xs text-blue-400/80">Ensure you add at least one class for this grade (even if it has no streams) so students and teachers can be assigned to it.</p>
                  </div>
                )}
              </div>
            )}

            {/* Subjects are chosen from the national catalogue on their own page —
                a free-text form here used to invent codes that matched nothing. */}
            <Link
              href="/dashboard/subjects"
              className="card group flex flex-col gap-3 transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <CardHeading icon={BookOpen} hue="emerald" className="mb-0" title="Subjects" description="Pick the subjects your school offers, set up senior school combinations and assign subject teachers." />
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Manage subjects
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
