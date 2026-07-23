"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import PageHeader from '@/components/dashboard/PageHeader';
import { Search, BookOpen, Plus, RotateCcw, Layers } from 'lucide-react';
import { PREDEFINED_SUBJECTS, EducationLevel } from '@/lib/subject-definitions';
import CombinationsManager from '@/components/subjects/CombinationsManager';
import SubjectEnrollmentManager from '@/components/subjects/SubjectEnrollmentManager';
import type { SubjectCombination } from '@/types';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; name_display: string; code: string; academic_level_id: string; numeric_order: number; }
interface Subject { id: string; name: string; code: string; category?: string; academic_level_id?: string; subject_type?: 'CORE' | 'ESSENTIAL' | 'OPTIONAL'; grading_system_id?: string | null; }
interface GradingSystem { id: string; name: string; academic_level_id: string; }

const categoryColors: Record<string, { bg: string; color: string }> = {
    LANGUAGE: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' },
    MATHEMATICS: { bg: 'rgba(234, 179, 8, 0.15)', color: '#EAB308' },
    SCIENCE: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
    HUMANITY: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
    TECHNICAL: { bg: 'rgba(249, 115, 22, 0.15)', color: '#F97316' },
    CREATIVE: { bg: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' },
};

const typeBadge = (type?: string) => {
    if (type === 'CORE') return <span className="badge badge-success text-[11px]">Core</span>;
    if (type === 'ESSENTIAL') return <span className="badge text-[11px]" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>Essential</span>;
    if (type === 'OPTIONAL') return <span className="badge badge-warning text-[11px]">Optional</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
};

export default function SubjectsPage() {
    const { role } = useAuth();
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [gradingSystems, setGradingSystems] = useState<GradingSystem[]>([]);
    const [academicLevels, setAcademicLevels] = useState<AcademicLevel[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [combinations, setCombinations] = useState<SubjectCombination[]>([]);
    const [minGroupSize, setMinGroupSize] = useState(15);
    const [activeTab, setActiveTab] = useState<'subjects' | 'combinations'>('subjects');
    const [enrollmentSubject, setEnrollmentSubject] = useState<Subject | null>(null);
    const [loading, setLoading] = useState(true);
    const [calSaving, setCalSaving] = useState(false);
    const [calMsg, setCalMsg] = useState('');
    const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', subject_type: 'CORE' });
    const [selectedLevelFilter, setSelectedLevelFilter] = useState<EducationLevel | ''>('');
    const [tableLevelFilter, setTableLevelFilter] = useState('');
    const [selectedPredefinedSubject, setSelectedPredefinedSubject] = useState('');

    const fetchSubjects = async () => {
        try {
            const res = await fetch('/api/admin/academic-structure');
            const json = await res.json();
            if (res.ok) {
                setSubjects(json.subjects || []);
                setGradingSystems(json.grading_systems || []);
                setAcademicLevels(json.academic_levels || []);
                setGrades(json.grades || []);
                setCombinations(json.subject_combinations || []);
            }
        } catch (err) { console.error('Failed to fetch subjects:', err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchSubjects();
        // Ministry minimum learners per combination (schools can override)
        fetch('/api/school/data?type=school_profile')
            .then(res => res.ok ? res.json() : null)
            .then(json => {
                const size = json?.data?.min_combination_group_size;
                if (typeof size === 'number' && size > 0) setMinGroupSize(size);
            })
            .catch(() => { /* keep default */ });
    }, []);

    const postStructure = async (type: string, payload: Record<string, unknown>) => {
        setCalSaving(true); setCalMsg('');
        try {
            const res = await fetch('/api/admin/academic-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setCalMsg('Added successfully');
            await fetchSubjects();
        } catch (err) { setCalMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
        finally { setCalSaving(false); }
    };

    const deleteSubject = async (id: string) => {
        if (!confirm('Delete this subject?')) return;
        setCalSaving(true); setCalMsg('');
        try {
            const res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}`, { method: 'DELETE' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            setCalMsg('Deleted successfully');
            await fetchSubjects();
        } catch (err) { setCalMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
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
            setCalMsg('Updated successfully');
            await fetchSubjects();
        } catch (err) { setCalMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
        finally { setCalSaving(false); }
    };

    const setSubjectGradingSystem = async (id: string, gradingSystemId: string) => {
        setCalSaving(true); setCalMsg('');
        try {
            const res = await fetch(`/api/admin/academic-structure`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject', id, grading_system_id: gradingSystemId || null })
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            setCalMsg('Grading system updated');
            await fetchSubjects();
        } catch (err) { setCalMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
        finally { setCalSaving(false); }
    };

    const getLevelName = (levelId?: string) => levelId ? academicLevels.find(l => l.id === levelId)?.name || '—' : '—';

    const selectedGradeObj = tableLevelFilter ? grades.find(g => g.id === tableLevelFilter) : null;
    const resolvedLevelId = selectedGradeObj ? selectedGradeObj.academic_level_id : tableLevelFilter;

    const filtered = subjects.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
        const matchCategory = categoryFilter === 'ALL' || (s.category || '').toUpperCase() === categoryFilter;
        const matchLevel = !resolvedLevelId || s.academic_level_id === resolvedLevelId;
        return matchSearch && matchCategory && matchLevel;
    });

    const categories = [...new Set(subjects.map(s => (s.category || 'TECHNICAL').toUpperCase()))];

    const resetForm = () => {
        setNewSubject({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', subject_type: 'CORE' });
        setSelectedPredefinedSubject('');
        setSelectedLevelFilter('');
    };

    if (loading) return <ContentSkeleton message="Loading subjects..." />;

    return (
        <div>
            <PageHeader
                title="Subject Management"
                description="Manage subjects, assign categories, and organize by curriculum level."
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Academic Structure', href: '/dashboard/settings' }, { label: 'Subjects' }]}
            />

            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-border">
                <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'subjects' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('subjects')}
                >
                    <BookOpen size={15} /> Subjects
                </button>
                <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'combinations' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('combinations')}
                >
                    <Layers size={15} /> Subject Combinations
                    {combinations.length > 0 && <span className="badge text-[11px]">{combinations.length}</span>}
                </button>
            </div>

            {activeTab === 'combinations' ? (
                <CombinationsManager
                    combinations={combinations as any}
                    subjects={subjects}
                    cbcLevelId={academicLevels.find(l => l.code === 'CBC')?.id}
                    minGroupSize={minGroupSize}
                    isAdmin={role === 'ADMIN'}
                    onChanged={fetchSubjects}
                />
            ) : (
            <>
            {calMsg && (
                <div className={`mb-4 p-3 rounded-md text-sm ${!calMsg.startsWith('Failed') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {calMsg}
                </div>
            )}

            {/* Add Subject Form */}
            {role === 'ADMIN' && (
                <div className="card p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            <BookOpen size={16} className="text-primary" /> Add Subject
                        </h3>
                        {newSubject.name || newSubject.code || selectedPredefinedSubject ? (
                            <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={resetForm} title="Reset form">
                                <RotateCcw size={14} />
                            </button>
                        ) : null}
                    </div>

                    {/* Grouped fields row 1: System filter + Predefined subject */}
                    <div className="flex flex-wrap gap-3 mb-4 p-3.5 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">System / Level</label>
                            <select
                                className="input-field w-full text-sm"
                                value={selectedLevelFilter}
                                onChange={e => {
                                    setSelectedLevelFilter(e.target.value as EducationLevel);
                                    setSelectedPredefinedSubject('');
                                }}
                            >
                                <option value="">All Levels</option>
                                <option value="CBC_LOWER_PRIMARY">CBC Lower Primary</option>
                                <option value="CBC_UPPER_PRIMARY">CBC Upper Primary</option>
                                <option value="CBC_JUNIOR_SCHOOL">CBC Junior School</option>
                                <option value="CBC_SENIOR_SCHOOL">CBC Senior School</option>
                                <option value="844_SECONDARY">8-4-4 Secondary</option>
                            </select>
                        </div>
                        <div className="flex-[2] min-w-[240px]">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Predefined Subject</label>
                            <select
                                className="input-field w-full text-sm"
                                value={selectedPredefinedSubject}
                                onChange={e => {
                                    setSelectedPredefinedSubject(e.target.value);
                                    if (!e.target.value) return;
                                    const [name, code] = e.target.value.split('|');
                                    const subj = PREDEFINED_SUBJECTS.find(s => s.name === name && s.code === code);
                                    if (subj) {
                                        const levelCode = subj.level.startsWith('CBC') ? 'CBC' : subj.level.startsWith('844') ? '844' : '';
                                        const matchedLevel = academicLevels.find(al => al.code === levelCode);
                                        setNewSubject(p => ({
                                            ...p,
                                            name: subj.name,
                                            code: subj.code,
                                            category: subj.category || 'TECHNICAL',
                                            subject_type: subj.isCore ? 'CORE' : 'OPTIONAL',
                                            academic_level_id: matchedLevel?.id || p.academic_level_id,
                                        }));
                                    }
                                }}
                            >
                                <option value="">Custom / Select predefined...</option>
                                {PREDEFINED_SUBJECTS.filter(s => !selectedLevelFilter || s.level === selectedLevelFilter).map(s => {
                                    const pathwayLabel = s.pathway === 'STEM' ? ' — STEM' : s.pathway === 'ARTS_SPORTS' ? ' — Arts & Sports' : s.pathway === 'SOCIAL_SCIENCES' ? ' — Social Sciences' : s.isCore && s.level === 'CBC_SENIOR_SCHOOL' ? ' — Core' : '';
                                    return (
                                        <option key={s.name + s.code} value={`${s.name}|${s.code}`}>{s.name} ({s.code}){pathwayLabel}</option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Grouped fields row 2: Name, Code, Category, Type, Academic Level */}
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-[2] min-w-[180px]">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Subject Name *</label>
                            <input className="input-field w-full text-sm" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="w-24">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Code *</label>
                            <input className="input-field w-full text-sm font-mono uppercase" placeholder="MAT" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                        </div>
                        <div className="w-36">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Category</label>
                            <select className="input-field w-full text-sm" value={newSubject.category || 'TECHNICAL'} onChange={e => setNewSubject(p => ({ ...p, category: e.target.value }))}>
                                {Object.keys(categoryColors).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Type *</label>
                            <select className="input-field w-full text-sm" value={newSubject.subject_type} onChange={e => setNewSubject(p => ({ ...p, subject_type: e.target.value }))}>
                                <option value="CORE">Core</option>
                                <option value="ESSENTIAL">Essential</option>
                                <option value="OPTIONAL">Optional</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Academic Level *</label>
                            <select className="input-field w-full text-sm" value={newSubject.academic_level_id} onChange={e => setNewSubject(p => ({ ...p, academic_level_id: e.target.value }))}>
                                <option value="">Select level...</option>
                                {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                await postStructure('subject', newSubject);
                                resetForm();
                            }}
                            className="btn-primary text-sm h-9 px-4 whitespace-nowrap"
                            disabled={calSaving || !newSubject.name.trim() || !newSubject.code.trim() || !newSubject.academic_level_id}
                        >
                            {calSaving ? 'Saving...' : <><Plus size={14} /> Add Subject</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Subject Table */}
            <div className="card overflow-hidden">
                {/* Sticky filter bar */}
                <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                className="input-field w-full pl-9 text-sm"
                                placeholder="Search subjects..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select className="input-field text-sm" value={tableLevelFilter} onChange={e => setTableLevelFilter(e.target.value)} style={{ width: 'auto', minWidth: '200px' }}>
                            <option value="">All Levels & Grades</option>
                            {academicLevels.map(al => {
                                const levelGrades = grades.filter(g => g.academic_level_id === al.id).sort((a, b) => a.numeric_order - b.numeric_order);
                                return (
                                    <optgroup key={al.id} label={al.name}>
                                        <option value={al.id}>All {al.name}</option>
                                        {levelGrades.map(g => (
                                            <option key={g.id} value={g.id}>{g.name_display}</option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                        <select className="input-field text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', minWidth: '150px' }}>
                            <option value="ALL">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                            {filtered.length} of {subjects.length} subject(s)
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No subjects found.</p>
                            <p className="text-xs mt-1 opacity-60">Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        <table className="data-table w-full text-left">
                            <thead>
                                <tr>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Subject</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Code</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Category</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Type</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Level</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm">Grading System</th>
                                    <th className="sticky top-0 z-10 bg-card shadow-sm text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => {
                                    const catKey = (s.category || 'TECHNICAL').toUpperCase();
                                    const cat = categoryColors[catKey] || { bg: 'rgba(100,100,100,0.15)', color: 'var(--color-text-muted)' };
                                    return (
                                        <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                                            <td>
                                                <div className="font-semibold text-sm">{s.name}</div>
                                            </td>
                                            <td><span className="font-mono text-sm text-muted-foreground">{s.code}</span></td>
                                            <td>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: cat.bg, color: cat.color }}>
                                                    {catKey}
                                                </span>
                                            </td>
                                            <td>{typeBadge(s.subject_type)}</td>
                                            <td className="text-sm text-muted-foreground">{getLevelName(s.academic_level_id)}</td>
                                            <td>
                                                {role === 'ADMIN' ? (
                                                    <select
                                                        className="text-[11px] bg-transparent border border-border/60 rounded-md px-2 py-1 outline-none text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer max-w-[160px]"
                                                        value={s.grading_system_id || ''}
                                                        onChange={(e) => setSubjectGradingSystem(s.id, e.target.value)}
                                                        disabled={calSaving}
                                                    >
                                                        <option value="">-- Default --</option>
                                                        {gradingSystems.filter(gs => gs.academic_level_id === s.academic_level_id).map(gs => (
                                                            <option key={gs.id} value={gs.id}>{gs.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">{gradingSystems.find(gs => gs.id === s.grading_system_id)?.name || 'Default'}</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                {role === 'ADMIN' && (
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <button
                                                            className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                                                            onClick={() => setEnrollmentSubject(s)}
                                                            disabled={calSaving}
                                                            title="Choose which learners take this subject (mark entry then lists only them)"
                                                        >
                                                            Learners
                                                        </button>
                                                        <select
                                                            className="text-[11px] bg-transparent border border-border/60 rounded-md px-2 py-1 outline-none text-muted-foreground hover:border-primary/40 transition-colors cursor-pointer"
                                                            value={s.subject_type || 'CORE'}
                                                            onChange={(e) => toggleSubjectType(s.id, e.target.value)}
                                                            disabled={calSaving}
                                                        >
                                                            <option value="CORE">Core</option>
                                                            <option value="ESSENTIAL">Essential</option>
                                                            <option value="OPTIONAL">Optional</option>
                                                        </select>
                                                        <button
                                                            className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                                                            onClick={() => deleteSubject(s.id)}
                                                            disabled={calSaving}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            </>
            )}

            {enrollmentSubject && (
                <SubjectEnrollmentManager
                    subject={enrollmentSubject}
                    onClose={() => setEnrollmentSubject(null)}
                />
            )}
        </div>
    );
}
