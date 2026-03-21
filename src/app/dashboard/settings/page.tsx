"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number; }
interface SchoolProfile { id?: string; name: string; address: string; phone: string; email: string; }
interface AcademicYear { id: string; name: string; start_date: string; end_date: string; }
interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; }
interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; }
interface Subject { id: string; name: string; code: string; academic_level_id: string; }
export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'grading' | 'calendar'>('profile');

  const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedCalYearId, setSelectedCalYearId] = useState('');

  const [school, setSchool] = useState<SchoolProfile>({ name: '', address: '', phone: '', email: '' });
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [calMsg, setCalMsg] = useState('');
  const [calSaving, setCalSaving] = useState(false);
  const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '' });
  const [newTerm, setNewTerm] = useState({ name: '', start_date: '', end_date: '' });
  const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '' });

  // ── Fetch all data via server APIs ─────────────────────────
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setSchoolLoading(true);

    try {
      // Global curriculum data + school-scoped calendar data
      const [structureRes, schoolRes, yearsRes, termsRes] = await Promise.all([
        fetch('/api/admin/academic-structure'),
        fetch('/api/school/data?type=school_profile'),
        fetch('/api/school/data?type=academic_years'),
        fetch('/api/school/data?type=terms'),
      ]);

      const [structureData, schoolData, yearsData, termsData] = await Promise.all([
        structureRes.json(),
        schoolRes.json(),
        yearsRes.json(),
        termsRes.json(),
      ]);

      // Global data
      setAcademicLevels(structureData.academic_levels || []);
      setGrades(structureData.grades || []);
      setGradingSystems(structureData.grading_systems || []);
      setGradingScales(structureData.grading_scales || []);
      setSubjects(structureData.subjects || []);

      // School-scoped data
      const years = yearsData.data || [];
      setAcademicYears(years);
      setTerms(termsData.data || []);

      if (years.length > 0 && !selectedCalYearId) {
        setSelectedCalYearId(years[0].id);
      }

      // School profile
      if (schoolData.data) {
        setSchool({
          id: schoolData.data.id,
          name: schoolData.data.name || '',
          address: schoolData.data.address || '',
          phone: schoolData.data.phone || '',
          email: schoolData.data.email || '',
        });
      }
    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
      setSchoolLoading(false);
    }
  }, [selectedCalYearId]);

  useEffect(() => {
    if (profile?.id) fetchAllData();
  }, [profile?.id, fetchAllData]);

  // ── Save school profile ────────────────────────────────────
  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school.name.trim()) return;
    setSaving(true);
    setSaveMsg('');

    try {
      const res = await fetch('/api/admin/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: school.name.trim(),
          address: school.address.trim() || null,
          phone: school.phone.trim() || null,
          email: school.email.trim() || null,
          school_id: school.id || null,
          user_id: profile?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(`❌ ${data.error}`);
      } else if (data.school_id) {
        setSchool(prev => ({ ...prev, id: data.school_id }));
        setSaveMsg(school.id ? '✅ School profile updated!' : '✅ School created! Refresh to see changes.');
      }
    } catch (err) {
      setSaveMsg(`❌ ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Calendar helpers ───────────────────────────────────────
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

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.name.trim() || !newYear.start_date || !newYear.end_date) return;
    const result = await postStructure('academic_year', newYear);
    if (result) { setNewYear({ name: '', start_date: '', end_date: '' }); setSelectedCalYearId(result.id); }
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalYearId || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date) return;
    await postStructure('term', { academic_year_id: selectedCalYearId, ...newTerm });
    if (!calMsg.startsWith('❌')) setNewTerm({ name: '', start_date: '', end_date: '' });
  };

  const calTerms = terms.filter(t => t.academic_year_id === selectedCalYearId);

  const tabs = [
    { key: 'profile' as const, label: 'School Profile' },
    { key: 'academic' as const, label: 'Academic Structure' },
    { key: 'grading' as const, label: 'Grading Systems' },
    { key: 'calendar' as const, label: '📅 Academic Calendar' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">School Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">System configuration and academic setup</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-8 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.key ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && activeTab !== 'profile' ? (
        <div className="p-12 text-center text-[var(--color-text-muted)]">Loading configuration...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* School Profile Tab */}
          {activeTab === 'profile' && (
            <div className="lg:col-span-3">
              {schoolLoading ? (
                <div className="card p-12 text-center text-[var(--color-text-muted)]">Loading school profile...</div>
              ) : !school.id ? (
                <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-4">🏫</div>
                    <h2 className="text-xl font-bold font-[family-name:var(--font-display)] mb-2">Setup Your School</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">Add your school details. This will appear in reports across the app.</p>
                  </div>
                  <form onSubmit={handleSaveSchool}>
                    <SchoolForm school={school} setSchool={setSchool} />
                    {saveMsg && <div className="mt-4 text-sm">{saveMsg}</div>}
                    <button type="submit" className="btn-primary w-full mt-6" disabled={saving || !school.name.trim()}>
                      {saving ? '⏳ Creating...' : '🚀 Create School'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
                  <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-6">School Profile</h3>
                  <form onSubmit={handleSaveSchool}>
                    <SchoolForm school={school} setSchool={setSchool} />
                    {saveMsg && <div className="mt-4 text-sm">{saveMsg}</div>}
                    <button type="submit" className="btn-primary w-full mt-6" disabled={saving || !school.name.trim()}>
                      {saving ? '⏳ Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Academic Tab */}
          {activeTab === 'academic' && (
            <>
              {/* Guide */}
              <div className="col-span-1 lg:col-span-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <div className="text-sm">
                  <h3 className="font-semibold mb-1">How to setup Academic Structure:</h3>
                  <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li>Kenya&apos;s educational curricula and class grades are pre-configured for your convenience.</li>
                    <li><strong>Action required:</strong> You must add the specific <strong>Subjects</strong> taught in your school below.</li>
                    <li>Assign each subject to the correct Academic Level (e.g., CBC or 8-4-4).</li>
                  </ul>
                </div>
              </div>

              <div className="card col-span-1 lg:col-span-1">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Academic Levels</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">Kenya&apos;s education curricula</p>
                <div className="overflow-x-auto">
                  <table className="data-table w-full sm:whitespace-nowrap">
                    <thead><tr><th>Code</th><th>Name</th></tr></thead>
                    <tbody>
                      {academicLevels.map(lvl => (
                        <tr key={lvl.id}>
                          <td className="font-mono text-sm font-bold">{lvl.code}</td>
                          <td>{lvl.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card col-span-1 lg:col-span-2">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Grades / Classes</h3>
                <div className="overflow-x-auto">
                  <table className="data-table w-full sm:whitespace-nowrap">
                    <thead><tr><th>Code</th><th>Display Name</th><th>Curriculum</th></tr></thead>
                    <tbody>
                      {grades.map(gr => (
                        <tr key={gr.id}>
                          <td className="font-mono text-sm">{gr.code}</td>
                          <td className="font-medium">{gr.name_display}</td>
                          <td className="text-[var(--color-text-muted)] text-sm">
                            {academicLevels.find(l => l.id === gr.academic_level_id)?.code || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subjects */}
              <div className="card lg:col-span-3">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Subjects</h3>
                
                {/* Add Subject Inline Form */}
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
                    fetchAllData();
                  }} className="btn-primary text-sm py-2 px-4 whitespace-nowrap" disabled={calSaving || !newSubject.name.trim() || !newSubject.code.trim() || !newSubject.academic_level_id}>
                    {calSaving ? '...' : '+ Add Subject'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full sm:whitespace-nowrap">
                    <thead><tr><th>Code</th><th>Subject Name</th><th>Curriculum</th></tr></thead>
                    <tbody>
                      {subjects.map(sub => (
                        <tr key={sub.id}>
                          <td className="font-mono text-sm">{sub.code}</td>
                          <td className="font-medium">{sub.name}</td>
                          <td className="text-[var(--color-text-muted)] text-sm">
                            {academicLevels.find(l => l.id === sub.academic_level_id)?.code || '—'}
                          </td>
                        </tr>
                      ))}
                      {subjects.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-[var(--color-text-muted)] text-sm">No subjects found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Grading Tab */}
          {activeTab === 'grading' && (
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* Guide */}
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <div className="text-sm">
                  <h3 className="font-semibold mb-1">Understanding Grading Systems:</h3>
                  <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li>Grading systems and scales are pre-configured based on national standards (e.g., KNEC standard 12-point scale, CBC scale).</li>
                    <li>These grading scales are automatically applied when teachers enter exam scores.</li>
                  </ul>
                </div>
              </div>

              {gradingSystems.length > 0 ? gradingSystems.map(gs => {
                const levelName = academicLevels.find(l => l.id === gs.academic_level_id)?.name || '';
                const scales = gradingScales.filter(sc => sc.grading_system_id === gs.id);
                return (
                  <div key={gs.id} className="card">
                    <h3 className="font-bold text-lg mb-1 font-[family-name:var(--font-display)]">{gs.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">{levelName}{gs.description ? ` · ${gs.description}` : ''}</p>
                    {scales.length > 0 && (
                      <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
                        <table className="data-table w-full text-left sm:whitespace-nowrap">
                          <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                            <tr>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Symbol</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Points</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Min %</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Max %</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {scales.map(sc => (
                              <tr key={sc.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                                <td className="px-4 py-3 font-bold">{sc.symbol}</td>
                                <td className="px-4 py-3 text-sm">{sc.points ?? '—'}</td>
                                <td className="px-4 py-3 text-sm font-mono">{sc.min_percentage}%</td>
                                <td className="px-4 py-3 text-sm font-mono">{sc.max_percentage}%</td>
                                <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{sc.label}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="card text-center p-8">
                  <div className="text-4xl mb-4">📐</div>
                  <p className="text-sm text-[var(--color-text-muted)]">Grading systems have not been configured yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-6">
              {/* Guide */}
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <div className="text-sm">
                  <h3 className="font-semibold mb-1">How to manage the Academic Calendar:</h3>
                  <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li><strong>Step 1:</strong> Add an Academic Year (e.g., 2026).</li>
                    <li><strong>Step 2:</strong> Add Terms (e.g., Term 1, Term 2) and assign them to the academic year.</li>
                    <li>Make sure term dates do not overlap to prevent issues with exam and report assignments.</li>
                  </ul>
                </div>
              </div>

              {calMsg && (
                <div className={`p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  {calMsg}
                </div>
              )}

              {/* Academic Years */}
              <div className="card">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📅 Academic Years</h3>
                {academicYears.length > 0 ? (
                  <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg mb-4">
                    <table className="data-table w-full text-left sm:whitespace-nowrap">
                      <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Year</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Start</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">End</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Terms</th>
                          <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {academicYears.map(y => (
                          <tr key={y.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                            <td className="px-4 py-3 font-bold">{y.name}</td>
                            <td className="px-4 py-3 text-sm font-mono">{y.start_date}</td>
                            <td className="px-4 py-3 text-sm font-mono">{y.end_date}</td>
                            <td className="px-4 py-3 text-sm">{terms.filter(t => t.academic_year_id === y.id).length}</td>
                            <td className="px-4 py-3">
                              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteStructure('academic_year', y.id)} disabled={calSaving}>🗑</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">No academic years yet. Add one below.</p>
                )}
                <form onSubmit={handleAddYear} className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Year Name *</label>
                    <input className="input-field w-full" placeholder="e.g. 2026" value={newYear.name} onChange={e => setNewYear(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Start Date *</label>
                    <input type="date" className="input-field w-full" value={newYear.start_date} onChange={e => setNewYear(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">End Date *</label>
                    <input type="date" className="input-field w-full" value={newYear.end_date} onChange={e => setNewYear(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                  <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving || !newYear.name.trim() || !newYear.start_date || !newYear.end_date}>
                    {calSaving ? '...' : '+ Add Year'}
                  </button>
                </form>
              </div>

              {/* Terms */}
              <div className="card">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📋 Terms</h3>
                <div className="mb-4">
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Select Academic Year</label>
                  {academicYears.length === 0 ? (
                    <p className="text-xs text-orange-400">Add an academic year first.</p>
                  ) : (
                    <select className="input-field w-full md:w-64" value={selectedCalYearId} onChange={e => setSelectedCalYearId(e.target.value)}>
                      {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  )}
                </div>
                {selectedCalYearId && (
                  <>
                    {calTerms.length > 0 ? (
                      <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg mb-4">
                        <table className="data-table w-full text-left sm:whitespace-nowrap">
                          <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                            <tr>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Term</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Start</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">End</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Current</th>
                              <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {calTerms.map(t => (
                              <tr key={t.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                                <td className="px-4 py-3 font-medium">{t.name}</td>
                                <td className="px-4 py-3 text-sm font-mono">{t.start_date}</td>
                                <td className="px-4 py-3 text-sm font-mono">{t.end_date}</td>
                                <td className="px-4 py-3 text-sm">{t.is_current ? '✅' : ''}</td>
                                <td className="px-4 py-3">
                                  <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteStructure('term', t.id)} disabled={calSaving}>🗑</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)] mb-4">No terms for this year. Add one below.</p>
                    )}
                    <form onSubmit={handleAddTerm} className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Term Name *</label>
                        <input className="input-field w-full" placeholder="e.g. Term 1" value={newTerm.name} onChange={e => setNewTerm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Start Date *</label>
                        <input type="date" className="input-field w-full" value={newTerm.start_date} onChange={e => setNewTerm(p => ({ ...p, start_date: e.target.value }))} />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">End Date *</label>
                        <input type="date" className="input-field w-full" value={newTerm.end_date} onChange={e => setNewTerm(p => ({ ...p, end_date: e.target.value }))} />
                      </div>
                      <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date}>
                        {calSaving ? '...' : '+ Add Term'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SchoolForm({ school, setSchool }: { school: SchoolProfile; setSchool: React.Dispatch<React.SetStateAction<SchoolProfile>> }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">School Name *</label>
        <input className="input-field w-full" value={school.name} onChange={e => setSchool(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Sunrise Academy" required />
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Address</label>
        <input className="input-field w-full" value={school.address} onChange={e => setSchool(prev => ({ ...prev, address: e.target.value }))} placeholder="e.g. 123 School Road, Nairobi" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone</label>
          <input className="input-field w-full" value={school.phone} onChange={e => setSchool(prev => ({ ...prev, phone: e.target.value }))} placeholder="e.g. +254 700 000000" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Email</label>
          <input className="input-field w-full" type="email" value={school.email} onChange={e => setSchool(prev => ({ ...prev, email: e.target.value }))} placeholder="e.g. info@school.com" />
        </div>
      </div>
    </div>
  );
}
