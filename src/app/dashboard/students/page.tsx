"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface StudentRow {
    id: string;
    first_name: string;
    last_name: string;
    enrollment_number: string;
    classrooms: { name: string } | null;
}

interface ClassOption {
    id: string;
    name: string;
}

export default function StudentsPage() {
    const supabase = createSupabaseBrowserClient();

    /* ── Data state ──────────────────────────────────── */
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [loading, setLoading] = useState(true);

    /* ── Search state ────────────────────────────────── */
    const [search, setSearch] = useState('');

    /* ── Add Student modal state ─────────────────────── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', enrollment_number: '', class_id: '' });
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    /* ── Fetch students ──────────────────────────────── */
    const fetchStudents = async () => {
        const { data, error } = await supabase
            .from('students')
            .select('id, first_name, last_name, enrollment_number, classrooms(name)')
            .order('first_name', { ascending: true });

        if (error) console.error(error);
        setStudents((data as unknown as StudentRow[]) || []);
        setLoading(false);
    };

    /* ── Fetch classes for dropdown ───────────────────── */
    const fetchClasses = async () => {
        const { data } = await supabase.from('classrooms').select('id, name').order('name');
        setClasses((data as ClassOption[]) || []);
    };

    useEffect(() => {
        fetchStudents();
        fetchClasses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Client-side search filter ────────────────────── */
    const filtered = useMemo(() => {
        if (!search.trim()) return students;
        const q = search.toLowerCase();
        return students.filter(
            s =>
                `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
                s.enrollment_number.toLowerCase().includes(q)
        );
    }, [students, search]);

    /* ── Add Student handler ─────────────────────────── */
    const handleAddStudent = async () => {
        if (!newStudent.first_name.trim() || !newStudent.last_name.trim() || !newStudent.enrollment_number.trim()) {
            setSaveMessage({ type: 'error', text: 'First name, last name, and enrollment number are required.' });
            return;
        }
        setSaving(true);
        setSaveMessage(null);

        const insertData: Record<string, string> = {
            first_name: newStudent.first_name.trim(),
            last_name: newStudent.last_name.trim(),
            enrollment_number: newStudent.enrollment_number.trim(),
        };
        if (newStudent.class_id) insertData.class_id = newStudent.class_id;

        const { error } = await supabase.from('students').insert(insertData);

        if (error) {
            setSaveMessage({ type: 'error', text: error.message });
        } else {
            setSaveMessage({ type: 'success', text: 'Student added successfully!' });
            setNewStudent({ first_name: '', last_name: '', enrollment_number: '', class_id: '' });
            await fetchStudents();
            setTimeout(() => {
                setShowAddModal(false);
                setSaveMessage(null);
            }, 1200);
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
                    placeholder="Search by name or enrollment number..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Student Table */}
            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table whitespace-nowrap w-full">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Enrollment #</th>
                                <th>Class</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center text-[var(--color-text-muted)] py-8">
                                        Loading students...
                                    </td>
                                </tr>
                            ) : filtered.length > 0 ? (
                                filtered.map((s) => (
                                    <tr key={s.id}>
                                        <td className="font-medium text-[var(--color-text-primary)]">{s.first_name} {s.last_name}</td>
                                        <td className="text-[var(--color-text-muted)] font-mono text-sm">{s.enrollment_number}</td>
                                        <td>{s.classrooms?.name || '—'}</td>
                                        <td>
                                            <a
                                                href={`/api/reports/student/${s.id}`}
                                                className="btn-secondary px-3 py-1 text-xs inline-flex"
                                                target="_blank"
                                            >
                                                ↓ Report
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center text-[var(--color-text-muted)] py-8">
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
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Enrollment Number *</label>
                                <input
                                    className="input-field w-full"
                                    placeholder="e.g. STU-001"
                                    value={newStudent.enrollment_number}
                                    onChange={e => setNewStudent(p => ({ ...p, enrollment_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class (Optional)</label>
                                <select
                                    className="input-field w-full"
                                    value={newStudent.class_id}
                                    onChange={e => setNewStudent(p => ({ ...p, class_id: e.target.value }))}
                                >
                                    <option value="">-- Select Class --</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
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
