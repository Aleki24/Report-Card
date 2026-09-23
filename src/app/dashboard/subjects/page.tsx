"use client";

import React, { useState, useEffect } from 'react';
import { SubjectTeachersTab } from '@/components/subjects/SubjectTeachersTab';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import PageHeader from '@/components/dashboard/PageHeader';
import { Search, BookOpen, Plus, RotateCcw, Layers, Users } from 'lucide-react';
import { isSubjectOfferedAtGrade, subjectBandLabel } from '@/lib/curriculum-bands';
import CombinationsManager from '@/components/subjects/CombinationsManager';
import SubjectCatalogueChecklist from '@/components/subjects/SubjectCatalogueChecklist';
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
    const [activeTab, setActiveTab] = useState<'subjects' | 'combinations' | 'teachers'>('subjects');
    const [gradeStreams, setGradeStreams] = useState<{ id: string; full_name: string; grade_id: string }[]>([]);
    const [enrollmentSubject, setEnrollmentSubject] = useState<Subject | null>(null);
    const [loading, setLoading] = useState(true);
    const [calSaving, setCalSaving] = useState(false);
    const [calMsg, setCalMsg] = useState('');
    const [newSubject, setNewSubject] = useState({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', subject_type: 'CORE' });
    const [tableLevelFilter, setTableLevelFilter] = useState('');

    const fetchSubjects = async () => {
        try {
            const res = await fetch('/api/admin/academic-structure');
            const json = await res.json();
            if (res.ok) {
                setSubjects(json.subjects || []);
                setGradingSystems(json.grading_systems || []);
                setAcademicLevels(json.academic_levels || []);
                setGrades(json.grades || []);
                // Streams let an admin point a subject at a different teacher
                // in one stream of a class.
                fetch('/api/school/data?type=grade_streams')
                    .then(r => r.json())
                    .then(j => setGradeStreams(j.data || []))
                    .catch(() => setGradeStreams([]));
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

    /**
     * Take a subject off this school's list.
     *
     * This used to delete the subject outright, which cascaded its exams and
     * every mark under them out of the database. Now it removes the offering
     * and the results survive — so the server answers 409 when exams exist and
     * we ask the admin to confirm, quoting the number at risk of disappearing
     * from their subject list.
     */
    const removeSubject = async (id: string, name: string) => {
        if (!confirm(`Remove ${name} from your subject list?`)) return;
        setCalSaving(true); setCalMsg('');
        try {
            let res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}`, { method: 'DELETE' });

            if (res.status === 409) {
                const d = await res.json();
                const proceed = confirm(
                    `${name} has ${d.examCount} exam(s) recorded. Those results are kept — the subject just stops appearing on your list. Continue?`,
                );
                if (!proceed) { setCalSaving(false); return; }
                res = await fetch(`/api/admin/academic-structure?type=subject&id=${id}&force=true`, { method: 'DELETE' });
            }

            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            setCalMsg('Removed from your subject list');
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
        // Filtering on a specific class narrows further to its band within the
        // curriculum: CBC shares one academic level from Pre-Primary to Grade 12,
        // so the level alone would list every CBC learning area under Grade 11.
        const matchBand = isSubjectOfferedAtGrade(s, selectedGradeObj);
        return matchSearch && matchCategory && matchLevel && matchBand;
    });

    const categories = [...new Set(subjects.map(s => (s.category || 'TECHNICAL').toUpperCase()))];

    const resetForm = () => {
        setNewSubject({ name: '', code: '', academic_level_id: '', category: 'TECHNICAL', subject_type: 'CORE' });
    };

    if (loading) return <ContentSkeleton message="Loading subjects..." />;

    return (
        <div>
            <PageHeader
                title="Subject Management"
                description="Choose the subjects your school offers, set up senior school combinations and assign subject teachers."
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
                <button
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'teachers' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setActiveTab('teachers')}
                >
                    <Users size={15} /> Subject Teachers
                </button>
            </div>

            {activeTab === 'teachers' ? (
                <SubjectTeachersTab grades={grades} streams={gradeStreams} />
            ) : activeTab === 'combinations' ? (
                <CombinationsManager
                    combinations={combinations}
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

            {role === 'ADMIN' && (
                <>
                    <SubjectCatalogueChecklist offered={subjects} onChanged={fetchSubjects} onMessage={setCalMsg} />

                    {/* A subject the national list doesn't have stays private to
                        this school (origin_school_id), so it can't leak elsewhere. */}
                    <details className="card mb-6 p-5 group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2"><Plus size={16} className="text-primary" /> Add a subject that isn&apos;t in the national list</span>
                            {(newSubject.name || newSubject.code) && (
                                <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" onClick={e => { e.preventDefault(); resetForm(); }} title="Reset form">
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </summary>
                        <p className="mt-2 mb-4 text-xs text-muted-foreground">
                            Only for something your school teaches that has no official code. Official subjects are ticked in the list above.
                        </p>
                    {/* Grouped fields row 2: Name, Code, Category, Type, Academic Level */}
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-[2] min-w-[180px]">
                            <label className="block text-xs text-muted-foreground mb-2 font-medium">Subject Name *</label>
                            <input className="input-field w-full text-sm" placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="w-24">
                            <label className="block text-xs text-muted-foreground mb-2 font-medium">Code *</label>
                            <input className="input-field input-field-mono w-full text-sm font-mono uppercase" placeholder="MAT" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                        </div>
                        <div className="w-36">
                            <label className="block text-xs text-muted-foreground mb-2 font-medium">Category</label>
                            <select className="input-field w-full text-sm" value={newSubject.category || 'TECHNICAL'} onChange={e => setNewSubject(p => ({ ...p, category: e.target.value }))}>
                                {Object.keys(categoryColors).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-muted-foreground mb-2 font-medium">Type *</label>
                            <select className="input-field w-full text-sm" value={newSubject.subject_type} onChange={e => setNewSubject(p => ({ ...p, subject_type: e.target.value }))}>
                                <option value="CORE">Core</option>
                                <option value="ESSENTIAL">Essential</option>
                                <option value="OPTIONAL">Optional</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-muted-foreground mb-2 font-medium">Academic Level *</label>
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
                    </details>
                </>
            )}

            {/* Subject Table */}
            <div className="card overflow-hidden">
                {/* Sticky filter bar */}
                <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                className="input-field input-icon-left w-full"
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
                                            <td className="text-sm text-muted-foreground">
                                                <div>{getLevelName(s.academic_level_id)}</div>
                                                {subjectBandLabel(s) && (
                                                    <div className="text-[11px] opacity-70">{subjectBandLabel(s)}</div>
                                                )}
                                            </td>
                                            <td>
                                                {role === 'ADMIN' ? (
                                                    <select
                                                        className="input-field input-field-sm w-auto hover:border-primary/40 transition-colors cursor-pointer max-w-[160px]"
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
                                                        {/* Core vs Optional is a property of the subject in the
                                                            national catalogue, not of one school's copy, so it is
                                                            shown rather than edited. */}
                                                        <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                                            {(s.subject_type || 'CORE').charAt(0) + (s.subject_type || 'CORE').slice(1).toLowerCase()}
                                                        </span>
                                                        <button
                                                            className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                                                            onClick={() => removeSubject(s.id, s.name)}
                                                            disabled={calSaving}
                                                        >
                                                            Remove
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
