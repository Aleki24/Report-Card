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

export default function SettingsPage() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'academic' | 'grading'>('profile');

    // Academic data
    const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
    const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
    const [loading, setLoading] = useState(true);

    // School profile form
    const [school, setSchool] = useState<SchoolProfile>({ name: '', address: '', phone: '', email: '' });
    const [schoolLoading, setSchoolLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');



    // ── Fetch all data in parallel to eliminate waterfall ──
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setSchoolLoading(true);

        try {
            // Step 1: Fetch academic data + user's school_id in parallel
            const [lvlRes, grRes, gsRes, gscRes, userRes] = await Promise.all([
                supabase.from('academic_levels').select('*').order('code'),
                supabase.from('grades').select('*').order('numeric_order'),
                supabase.from('grading_systems').select('*').order('name'),
                supabase.from('grading_scales').select('*').order('order_index'),
                profile?.school_id
                    ? Promise.resolve({ data: { school_id: profile.school_id } })
                    : supabase.from('users').select('school_id').eq('id', profile?.id ?? '').single(),
            ]);

            setAcademicLevels(lvlRes.data || []);
            setGrades(grRes.data || []);
            setGradingSystems((gsRes.data as GradingSystem[]) || []);
            setGradingScales((gscRes.data as GradingScale[]) || []);

            const schoolId = userRes.data?.school_id;

            // Step 2: If we have a school_id, fetch the school profile
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



    const tabs = [
        { key: 'profile' as const, label: 'School Profile' },
        { key: 'academic' as const, label: 'Academic Structure' },
        { key: 'grading' as const, label: 'Grading Systems' },
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
            <div className="flex border-b border-[var(--color-border)] mb-8">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === tab.key ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'}`}
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
                                    <table className="data-table w-full whitespace-nowrap">
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
                                    <table className="data-table w-full whitespace-nowrap">
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
                                                <table className="data-table w-full text-left whitespace-nowrap">
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
