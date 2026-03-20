"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

interface AcademicLevel {
    id: string;
    code: string;
    name: string;
}

interface Grade {
    id: string;
    code: string;
    name_display: string;
    numeric_order: number;
    academic_level_id: string;
}

interface GradingSystem {
    id: string;
    name: string;
    description: string | null;
    academic_level_id: string;
}

interface GradingScale {
    id: string;
    grading_system_id: string;
    min_percentage: number;
    max_percentage: number;
    symbol: string;
    label: string;
    points: number | null;
    order_index: number;
}

interface SchoolProfile {
    id?: string;
    name: string;
    address: string;
    phone: string;
    email: string;
}

interface AcademicYear {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
}

interface Term {
    id: string;
    academic_year_id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

interface Stream {
    id: string;
    grade_id: string;
    name: string;
    full_name: string;
}

export default function SettingsPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'grading' | 'calendar'>('profile');

    // Academic data
    const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
    const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
    const [loading, setLoading] = useState(true);

    // Calendar data
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [streams, setStreams] = useState<Stream[]>([]);
    const [selectedCalYearId, setSelectedCalYearId] = useState('');
    const [selectedCalGradeId, setSelectedCalGradeId] = useState('');

    // School profile form
    const [school, setSchool] = useState<SchoolProfile>({ name: '', address: '', phone: '', email: '' });
    const [schoolLoading, setSchoolLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    // Calendar add forms
    const [calMsg, setCalMsg] = useState('');
    const [calSaving, setCalSaving] = useState(false);
    const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '' });
    const [newTerm, setNewTerm] = useState({ name: '', start_date: '', end_date: '' });
    const [newStream, setNewStream] = useState({ name: '', full_name: '' });

    // ── Fetch all data: academic structure via API, school via browser client ──
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setSchoolLoading(true);

        try {
            // Fetch academic structure via server API (bypasses RLS)
            const [structureRes, userRes] = await Promise.all([
                fetch('/api/admin/academic-structure').then(r => r.json()),
                profile?.school_id
                    ? Promise.resolve({ data: { school_id: profile.school_id } })
                    : supabase.from('users').select('school_id').eq('id', profile?.id ?? '').single(),
            ]);

            setAcademicLevels(structureRes.academic_levels || []);
            setGrades(structureRes.grades || []);
            setGradingSystems((structureRes.grading_systems as GradingSystem[]) || []);
            setGradingScales((structureRes.grading_scales as GradingScale[]) || []);
            setAcademicYears((structureRes.academic_years as AcademicYear[]) || []);
            setTerms((structureRes.terms as Term[]) || []);
            setStreams((structureRes.grade_streams as Stream[]) || []);

            if (structureRes.academic_years?.length > 0 && !selectedCalYearId) {
                setSelectedCalYearId(structureRes.academic_years[0].id);
            }

            const schoolId = userRes.data?.school_id;

            if (schoolId) {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('id, name, address, phone, email')
                    .eq('id', schoolId)
                    .single();

                if (schoolData) {
                    setSchool({
                        id: schoolData.id,
                        name: schoolData.name || '',
                        address: schoolData.address || '',
                        phone: schoolData.phone || '',
                        email: schoolData.email || '',
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching settings data:', err);
        } finally {
            setLoading(false);
            setSchoolLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, profile?.school_id, profile?.id]);

    useEffect(() => {
        if (profile?.id) {
            fetchAllData();
        }
    }, [profile?.id, fetchAllData]);

    // ── Save school profile ──
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
                setSaveMsg(school.id
                    ? '✅ School profile updated! Refresh to see changes in sidebar.'
                    : '✅ School created! Refresh the page to see changes.'
                );
            }
        } catch (err) {
            setSaveMsg(`❌ Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    // ── Academic Calendar Helpers ──
    const postStructure = async (type: string, payload: Record<string, unknown>) => {
        setCalSaving(true);
        setCalMsg('');
        try {
            const res = await fetch('/api/admin/academic-structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, user_id: profile?.id, ...payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setCalMsg(`✅ ${type.replace('_', ' ')} added successfully`);
            await fetchAllData(); // refresh lists
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
            const res = await fetch(`/api/admin/academic-structure?type=${type}&id=${id}&user_id=${profile?.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setCalMsg(`✅ Deleted successfully`);
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
        if (result) {
            setNewYear({ name: '', start_date: '', end_date: '' });
            setSelectedCalYearId(result.id);
        }
    };

    const handleAddTerm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCalYearId || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date) return;
        await postStructure('term', { academic_year_id: selectedCalYearId, ...newTerm });
        if (!calMsg.startsWith('❌')) setNewTerm({ name: '', start_date: '', end_date: '' });
    };

    const handleAddStream = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCalGradeId || !newStream.name.trim()) return;
        const grade = grades.find(g => g.id === selectedCalGradeId);
        const fullName = newStream.full_name.trim() || `${grade?.name_display || ''} ${newStream.name.trim()}`.trim();
        await postStructure('stream', { grade_id: selectedCalGradeId, name: newStream.name.trim(), full_name: fullName });
        if (!calMsg.startsWith('❌')) setNewStream({ name: '', full_name: '' });
    };

    // Filtered lists
    const calTerms = terms.filter(t => t.academic_year_id === selectedCalYearId);
    const calStreams = streams.filter(s => s.grade_id === selectedCalGradeId);

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
                <p className="text-sm text-[var(--color-text-muted)]">
                    System configuration and academic setup
                </p>
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
                <div className="p-12 text-center text-[var(--color-text-muted)]">
                    Loading configuration...
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── School Profile Tab ────────────────────────── */}
                    {activeTab === 'profile' && (
                        <div className="lg:col-span-3">
                            {schoolLoading ? (
                                <div className="card p-12 text-center text-[var(--color-text-muted)]">Loading school profile...</div>
                            ) : !school.id ? (
                                /* First-time wizard */
                                <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
                                    <div className="text-center mb-6">
                                        <div className="text-5xl mb-4">🏫</div>
                                        <h2 className="text-xl font-bold font-[family-name:var(--font-display)] mb-2">Setup Your School</h2>
                                        <p className="text-sm text-[var(--color-text-muted)]">
                                            Let&apos;s get started by adding your school details. This will appear in reports and across the app.
                                        </p>
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
                                /* Edit existing school */
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

                    {/* ── Academic Tab (Read-only) ────────────────── */}
                    {activeTab === 'academic' && (
                        <>
                            <div className="card lg:col-span-2">
                                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Academic Levels</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mb-4">Kenya&apos;s education curricula</p>
                                <div className="overflow-x-auto">
                                    <table className="data-table w-full sm:whitespace-nowrap">
                                        <thead>
                                            <tr><th>Code</th><th>Name</th></tr>
                                        </thead>
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

                            <div className="card lg:col-span-3">
                                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Grades / Classes</h3>
                                <p className="text-xs text-[var(--color-text-muted)] mb-4">All grades across both curricula</p>
                                <div className="overflow-x-auto">
                                    <table className="data-table w-full sm:whitespace-nowrap">
                                        <thead>
                                            <tr><th>Code</th><th>Display Name</th><th>Curriculum</th></tr>
                                        </thead>
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
                        </>
                    )}

                    {/* ── Grading Tab (Read-only) ──────────────────── */}
                    {activeTab === 'grading' && (
                        <div className="lg:col-span-3 flex flex-col gap-6">
                            {gradingSystems.length > 0 ? gradingSystems.map(gs => {
                                const levelName = academicLevels.find(l => l.id === gs.academic_level_id)?.name || '';
                                const scales = gradingScales.filter(sc => sc.grading_system_id === gs.id);
                                return (
                                    <div key={gs.id} className="card">
                                        <h3 className="font-bold text-lg mb-1 font-[family-name:var(--font-display)]">{gs.name}</h3>
                                        <p className="text-xs text-[var(--color-text-muted)] mb-4">
                                            {levelName}{gs.description ? ` · ${gs.description}` : ''}
                                        </p>
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
                                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">No Grading Systems</h3>
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        Grading systems have not been configured yet.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Academic Calendar Tab ──────────────────────── */}
                    {activeTab === 'calendar' && (
                        <div className="lg:col-span-3 flex flex-col gap-6">

                            {/* Feedback */}
                            {calMsg && (
                                <div className={`p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                                    {calMsg}
                                </div>
                            )}

                            {/* ── Academic Years ── */}
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
                                                            <button
                                                                className="text-xs text-red-400 hover:text-red-300"
                                                                onClick={() => deleteStructure('academic_year', y.id)}
                                                                disabled={calSaving}
                                                            >🗑</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--color-text-muted)] mb-4">No academic years yet. Add one below.</p>
                                )}

                                {/* Add Year Form */}
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

                            {/* ── Terms ── */}
                            <div className="card">
                                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📋 Terms</h3>

                                <div className="mb-4">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Select Academic Year</label>
                                    {academicYears.length === 0 ? (
                                        <p className="text-xs text-orange-400">Add an academic year first.</p>
                                    ) : (
                                        <select className="input-field w-full md:w-64" value={selectedCalYearId} onChange={e => setSelectedCalYearId(e.target.value)}>
                                            {academicYears.map(y => (
                                                <option key={y.id} value={y.id}>{y.name}</option>
                                            ))}
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

                            {/* ── Grade Streams ── */}
                            <div className="card">
                                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">🏷️ Grade Streams</h3>

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
                                                            <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Stream</th>
                                                            <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Full Name</th>
                                                            <th className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--color-border)]">
                                                        {calStreams.map(s => (
                                                            <tr key={s.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                                                                <td className="px-4 py-3 font-bold">{s.name}</td>
                                                                <td className="px-4 py-3 text-sm">{s.full_name}</td>
                                                                <td className="px-4 py-3">
                                                                    <button className="text-xs text-red-400 hover:text-red-300" onClick={() => deleteStructure('stream', s.id)} disabled={calSaving}>🗑</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[var(--color-text-muted)] mb-4">No streams for this grade. Add one below.</p>
                                        )}

                                        <form onSubmit={handleAddStream} className="flex flex-wrap items-end gap-3">
                                            <div className="flex-1 min-w-[100px]">
                                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Stream Name *</label>
                                                <input className="input-field w-full" placeholder="e.g. A" value={newStream.name} onChange={e => setNewStream(p => ({ ...p, name: e.target.value }))} />
                                            </div>
                                            <div className="flex-1 min-w-[160px]">
                                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Full Name (auto-filled)</label>
                                                <input className="input-field w-full" placeholder="e.g. Grade 7A" value={newStream.full_name} onChange={e => setNewStream(p => ({ ...p, full_name: e.target.value }))} />
                                            </div>
                                            <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving || !newStream.name.trim()}>
                                                {calSaving ? '...' : '+ Add Stream'}
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

/* ── Reusable School Form Fields ────────────────────────── */
function SchoolForm({ school, setSchool }: { school: SchoolProfile; setSchool: React.Dispatch<React.SetStateAction<SchoolProfile>> }) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">School Name *</label>
                <input
                    className="input-field w-full"
                    value={school.name}
                    onChange={e => setSchool(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Sunrise Academy"
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Address</label>
                <input
                    className="input-field w-full"
                    value={school.address}
                    onChange={e => setSchool(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="e.g. 123 School Road, Nairobi"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone</label>
                    <input
                        className="input-field w-full"
                        value={school.phone}
                        onChange={e => setSchool(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g. +254 700 000000"
                    />
                </div>
                <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Email</label>
                    <input
                        className="input-field w-full"
                        type="email"
                        value={school.email}
                        onChange={e => setSchool(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="e.g. info@school.com"
                    />
                </div>
            </div>
        </div>
    );
}
