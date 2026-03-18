"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

interface StudentRow {
    id: string;
    admission_number: string;
    status: string;
    users: { first_name: string; last_name: string; email: string } | null;
    grade_streams: { full_name: string } | null;
}

interface GradeStreamOption {
    id: string;
    full_name: string;
}

interface AcademicLevelOption {
    id: string;
    name: string;
}

export default function StudentsPage() {
    const supabase = createSupabaseBrowserClient();
    const { profile } = useAuth();

    /* ── Data state ──────────────────────────────────── */
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    /* ── Search state ────────────────────────────────── */
    const [search, setSearch] = useState('');

    /* ── Add Student modal state ─────────────────────── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({
        first_name: '', last_name: '',
        admission_number: '', grade_stream_id: '', academic_level_id: ''
    });
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    /* ── Fetch students (join users + grade_streams) ── */
    const fetchStudents = async () => {
        setFetchError(null);
        const { data, error } = await supabase
            .from('students')
            .select('id, admission_number, status, users(first_name, last_name, email), grade_streams:current_grade_stream_id(full_name)')
            .order('admission_number', { ascending: true });

        if (error) {
            console.error('Error fetching students:', error);
            setFetchError(`Failed to load students: ${error.message}`);
        }
        setStudents((data as unknown as StudentRow[]) || []);
        setLoading(false);
    };

    /* ── Fetch grade streams for dropdown ─────────────── */
    const fetchGradeStreams = async () => {
        const { data } = await supabase.from('grade_streams').select('id, full_name').order('full_name');
        setGradeStreams((data as GradeStreamOption[]) || []);
    };

    /* ── Fetch academic levels for dropdown ───────────── */
    const fetchAcademicLevels = async () => {
        const { data } = await supabase.from('academic_levels').select('id, name').order('name');
        setAcademicLevels((data as AcademicLevelOption[]) || []);
    };

    useEffect(() => {
        fetchStudents();
        fetchGradeStreams();
        fetchAcademicLevels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Client-side search filter ────────────────────── */
    const filtered = useMemo(() => {
        if (!search.trim()) return students;
        const q = search.toLowerCase();
        return students.filter(
            s =>
                `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(q) ||
                s.admission_number.toLowerCase().includes(q)
        );
    }, [students, search]);

    /* ── Delete Student handler ───────────────────────── */
    const handleDeleteStudent = async (studentId: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}? This will permanently remove all their records, marks, and reports.`)) return;
        setDeletingId(studentId);
        try {
            const res = await fetch(`/api/admin/delete-student?student_id=${studentId}&user_id=${profile?.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) {
                alert(result.error || 'Failed to delete student.');
            } else {
                setStudents(prev => prev.filter(s => s.id !== studentId));
            }
        } catch {
            alert('Unexpected error deleting student.');
        }
        setDeletingId(null);
    };

    /* ── Add Student handler (via admin API) ──────────── */
    const handleAddStudent = async () => {
        if (!newStudent.first_name.trim() || !newStudent.last_name.trim() || !newStudent.admission_number.trim()) {
            setSaveMessage({ type: 'error', text: 'First name, last name, and admission number are required.' });
            return;
        }
        if (!newStudent.grade_stream_id || !newStudent.academic_level_id) {
            setSaveMessage({ type: 'error', text: 'Please select a grade stream and academic level.' });
            return;
        }
        setSaving(true);
        setSaveMessage(null);

        // Look up school_id from DB if JWT is stale
        let schoolId = profile?.school_id || null;
        if (!schoolId) {
            const { data: userData } = await supabase.from('users').select('school_id').eq('id', profile?.id ?? '').single();
            schoolId = userData?.school_id || null;
        }

        try {
            const res = await fetch('/api/admin/add-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: newStudent.first_name.trim(),
                    last_name: newStudent.last_name.trim(),
                    admission_number: newStudent.admission_number.trim(),
                    grade_stream_id: newStudent.grade_stream_id,
                    academic_level_id: newStudent.academic_level_id,
                    school_id: schoolId,
                    admin_user_id: profile?.id,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                setSaveMessage({ type: 'error', text: result.error || 'Failed to add student.' });
            } else {
                setSaveMessage({ type: 'success', text: result.message || 'Student added successfully!' });
                setNewStudent({ first_name: '', last_name: '', admission_number: '', grade_stream_id: '', academic_level_id: '' });
                await fetchStudents();
                setTimeout(() => {
                    setShowAddModal(false);
                    setSaveMessage(null);
                }, 1200);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setSaveMessage({ type: 'error', text: `Unexpected error: ${message}` });
        }
        setSaving(false);
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            {/* Page Header */}
            <div
                className="flex flex-col sm:flex-row sm:justify-between sm:items-start"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Students</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Manage student records and view individual performance
                    </p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => setShowAddModal(true)}>+ Add Student</button>
            </div>

            {/* Search & Filter */}
            <div
                className="flex flex-col sm:flex-row"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}
            >
                <input
                    className="input-field sm:max-w-md w-full"
                    placeholder="Search by name or admission number..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Error Banner */}
            {fetchError && (
                <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">
                    ⚠️ {fetchError}
                </div>
            )}

            {/* Student Table */}
            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table whitespace-nowrap w-full">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Admission #</th>
                                <th>Grade Stream</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center text-[var(--color-text-muted)] py-8">
                                        Loading students...
                                    </td>
                                </tr>
                            ) : filtered.length > 0 ? (
                                filtered.map((s) => (
                                    <tr key={s.id}>
                                        <td className="font-medium text-[var(--color-text-primary)]">
                                            {s.users?.first_name || '—'} {s.users?.last_name || ''}
                                        </td>
                                        <td className="text-[var(--color-text-muted)] font-mono text-sm">{s.admission_number}</td>
                                        <td>{s.grade_streams?.full_name || '—'}</td>
                                        <td>
                                            <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <a
                                                    href={`/api/reports/student/${s.id}`}
                                                    className="btn-secondary px-3 py-1 text-xs inline-flex"
                                                    target="_blank"
                                                >
                                                    ↓ Report
                                                </a>
                                                <button
                                                    className="px-2 py-1 text-xs rounded-md text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-colors disabled:opacity-50"
                                                    onClick={() => handleDeleteStudent(s.id, `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() || s.admission_number)}
                                                    disabled={deletingId === s.id}
                                                    title="Delete student"
                                                >
                                                    {deletingId === s.id ? '...' : '🗑'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center text-[var(--color-text-muted)] py-8">
                                        {search ? 'No students match your search.' : 'No students found. Click "+ Add Student" to get started.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add Student Modal ──────────────────────── */}
            {showAddModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setShowAddModal(false); setSaveMessage(null); }}
                >
                    <div
                        className="card w-full max-w-md"
                        style={{ animation: 'fadeIn .2s ease' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Add New Student</h2>

                        <div className="flex flex-col gap-4 mb-6">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name *</label>
                                    <input
                                        className="input-field w-full"
                                        placeholder="e.g. Alice"
                                        value={newStudent.first_name}
                                        onChange={e => setNewStudent(p => ({ ...p, first_name: e.target.value }))}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name *</label>
                                    <input
                                        className="input-field w-full"
                                        placeholder="e.g. Moraa"
                                        value={newStudent.last_name}
                                        onChange={e => setNewStudent(p => ({ ...p, last_name: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number *</label>
                                <input
                                    className="input-field w-full"
                                    placeholder="e.g. ADM-2026-001"
                                    value={newStudent.admission_number}
                                    onChange={e => setNewStudent(p => ({ ...p, admission_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Level *</label>
                                <select
                                    className="input-field w-full"
                                    value={newStudent.academic_level_id}
                                    onChange={e => setNewStudent(p => ({ ...p, academic_level_id: e.target.value }))}
                                >
                                    <option value="">-- Select Academic Level --</option>
                                    {academicLevels.map(al => (
                                        <option key={al.id} value={al.id}>{al.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade Stream *</label>
                                <select
                                    className="input-field w-full"
                                    value={newStudent.grade_stream_id}
                                    onChange={e => setNewStudent(p => ({ ...p, grade_stream_id: e.target.value }))}
                                >
                                    <option value="">-- Select Grade Stream --</option>
                                    {gradeStreams.map(gs => (
                                        <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Feedback */}
                        {saveMessage && (
                            <div
                                className={`mb-4 p-3 rounded-md text-sm ${saveMessage.type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                    }`}
                            >
                                {saveMessage.text}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn-secondary"
                                onClick={() => { setShowAddModal(false); setSaveMessage(null); }}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary disabled:opacity-50"
                                onClick={handleAddStudent}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Add Student'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
