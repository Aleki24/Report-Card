"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface StudentRow {
    id: string;
    admission_number: string;
    status: string;
    guardian_phone: string | null;
    guardian_name: string | null;
    users: { first_name: string; last_name: string; email: string } | null;
    grade_streams: { id: string; full_name: string } | null;
}

interface GradeStreamOption {
    id: string;
    full_name: string;
    academic_level_id: string | null;
}

interface AcademicLevelOption {
    id: string;
    name: string;
}

export default function StudentsPage() {
    const { profile } = useAuth();

    /* ── Data state ──────────────────────────────────── */
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    /* ── Search & Filter state ───────────────────────── */
    const [search, setSearch] = useState('');
    const [filterGradeStream, setFilterGradeStream] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    /* ── Pagination state ─────────────────────────────── */
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);

    /* ── Add Student modal state ─────────────────────── */
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({
        first_name: '', last_name: '',
        admission_number: '', grade_stream_id: '', academic_level_id: '',
        guardian_phone: '', guardian_name: ''
    });

    /* ── Edit Student modal state ─────────────────── */
    const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
    const [editData, setEditData] = useState({
        first_name: '', last_name: '', admission_number: '',
        guardian_phone: '', guardian_name: '', grade_stream_id: '', status: ''
    });
    const [savingEdit, setSavingEdit] = useState(false);

    /* ── Inline edit guardian state ───────────────────── */
    const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
    const [editGuardianPhone, setEditGuardianPhone] = useState('');
    const [editGuardianName, setEditGuardianName] = useState('');
    const [savingGuardian, setSavingGuardian] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    /* ── Fetch students (join users + grade_streams) ── */
    const fetchStudents = async () => {
        setFetchError(null);
        try {
            const res = await fetch('/api/school/data?type=students');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load students');
            setStudents(json.data || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setFetchError(`Failed to load students: ${message}`);
        }
        setLoading(false);
    };

    /* ── Fetch grade streams for dropdown (with academic level) ── */
    const fetchGradeStreams = async () => {
        try {
            const res = await fetch('/api/school/data?type=grade_streams');
            const json = await res.json();
            if (!res.ok) return;
            const mapped = (json.data || []).map((d: any) => ({
                id: d.id,
                full_name: d.full_name,
                academic_level_id: d.grades?.academic_level_id || d.academic_level_id || null,
            }));
            setGradeStreams(mapped);
        } catch {
            // non-critical
        }
    };

    /* ── Fetch academic levels for dropdown ───────────── */
    const fetchAcademicLevels = async () => {
        try {
            const res = await fetch('/api/admin/academic-structure');
            const json = await res.json();
            setAcademicLevels(json.academic_levels || []);
        } catch {
            // non-critical
        }
    };

    useEffect(() => {
        fetchStudents();
        fetchGradeStreams();
        fetchAcademicLevels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Client-side search filter ────────────────────── */
    const filtered = useMemo(() => {
        let result = students;
        
        // Filter by grade stream
        if (filterGradeStream) {
            result = result.filter(s => s.grade_streams?.id === filterGradeStream);
        }
        
        // Filter by status
        if (filterStatus) {
            result = result.filter(s => s.status === filterStatus);
        }
        
        // Filter by search
        const searchTrim = search?.trim();
        if (searchTrim) {
            const q = searchTrim.toLowerCase();
            result = result.filter(
                s =>
                    `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(q) ||
                    (s.admission_number || '').toLowerCase().includes(q)
            );
        }
        
        return result;
    }, [students, search, filterGradeStream, filterStatus]);

    /* ── Pagination ───────────────────────────────────── */
    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => { setCurrentPage(1); }, [search, filterGradeStream, filterStatus]);

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

    /* ── Update Guardian handler ──────────────────────── */
    const handleStartEditGuardian = (student: StudentRow) => {
        setEditingGuardianId(student.id);
        setEditGuardianPhone(student.guardian_phone || '');
        setEditGuardianName(student.guardian_name || '');
    };

    const handleCancelEditGuardian = () => {
        setEditingGuardianId(null);
        setEditGuardianPhone('');
        setEditGuardianName('');
    };

    const handleSaveGuardian = async (studentId: string) => {
        setSavingGuardian(true);
        try {
            const res = await fetch('/api/admin/update-student', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentId,
                    guardian_phone: editGuardianPhone.trim() || null,
                    guardian_name: editGuardianName.trim() || null,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                alert(result.error || 'Failed to update guardian info.');
            } else {
                setStudents(prev => prev.map(s =>
                    s.id === studentId
                        ? { ...s, guardian_phone: editGuardianPhone.trim() || null, guardian_name: editGuardianName.trim() || null }
                        : s
                ));
                setEditingGuardianId(null);
            }
        } catch {
            alert('Unexpected error updating guardian info.');
        }
        setSavingGuardian(false);
    };

    /* ── Edit Student handlers ───────────────────────── */
    const handleStartEditStudent = (student: StudentRow) => {
        setEditingStudent(student);
        setEditData({
            first_name: student.users?.first_name || '',
            last_name: student.users?.last_name || '',
            admission_number: student.admission_number || '',
            guardian_phone: student.guardian_phone || '',
            guardian_name: student.guardian_name || '',
            grade_stream_id: student.grade_streams?.id || '',
            status: student.status || 'ACTIVE'
        });
    };

    const handleCancelEditStudent = () => {
        setEditingStudent(null);
        setEditData({ first_name: '', last_name: '', admission_number: '', guardian_phone: '', guardian_name: '', grade_stream_id: '', status: '' });
    };

    const handleSaveStudent = async () => {
        if (!editingStudent) return;
        setSavingEdit(true);
        try {
            const res = await fetch('/api/admin/update-student', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: editingStudent.id,
                    first_name: editData.first_name.trim(),
                    last_name: editData.last_name.trim(),
                    admission_number: editData.admission_number.trim(),
                    guardian_phone: editData.guardian_phone.trim() || null,
                    guardian_name: editData.guardian_name.trim() || null,
                    grade_stream_id: editData.grade_stream_id || null,
                    status: editData.status,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                alert(result.error || 'Failed to update student.');
            } else {
                setStudents(prev => prev.map(s => {
                    if (s.id !== editingStudent.id) return s;
                    return {
                        ...s,
                        admission_number: editData.admission_number.trim(),
                        guardian_phone: editData.guardian_phone.trim() || null,
                        guardian_name: editData.guardian_name.trim() || null,
                        status: editData.status,
                        users: s.users ? { ...s.users, first_name: editData.first_name.trim(), last_name: editData.last_name.trim() } : null,
                        grade_streams: editData.grade_stream_id ? gradeStreams.find(gs => gs.id === editData.grade_stream_id) || s.grade_streams : null
                    };
                }));
                setEditingStudent(null);
            }
        } catch {
            alert('Unexpected error updating student.');
        }
        setSavingEdit(false);
    };

    /* ── Add Student handler (via admin API) ──────────── */
    const handleAddStudent = async () => {
        if (!newStudent.first_name.trim() || !newStudent.last_name.trim()) {
            setSaveMessage({ type: 'error', text: 'First name and last name are required.' });
            return;
        }
        if (!newStudent.academic_level_id) {
            setSaveMessage({ type: 'error', text: 'Please select an academic level.' });
            return;
        }
        setSaving(true);
        setSaveMessage(null);

        try {
            const res = await fetch('/api/admin/add-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: newStudent.first_name.trim(),
                    last_name: newStudent.last_name.trim(),
                    admission_number: newStudent.admission_number.trim() || null,
                    grade_stream_id: newStudent.grade_stream_id || null,
                    academic_level_id: newStudent.academic_level_id,
                    guardian_phone: newStudent.guardian_phone.trim() || null,
                    guardian_name: newStudent.guardian_name.trim() || null,
                    admin_user_id: profile?.id,
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                setSaveMessage({ type: 'error', text: result.error || 'Failed to add student.' });
            } else {
                setSaveMessage({ type: 'success', text: result.message || 'Student added successfully!' });
                setNewStudent({ first_name: '', last_name: '', admission_number: '', grade_stream_id: '', academic_level_id: '', guardian_phone: '', guardian_name: '' });
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
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Students</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Manage student records and view individual performance
                    </p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => setShowAddModal(true)}>+ Add Student</button>
            </div>

            {/* Guide */}
            <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                <div className="text-sm">
                    <h3 className="font-semibold mb-1">How to manage students:</h3>
                    <ul className="list-disc pl-4 space-y-1 opacity-90">
                        <li><strong>Step 1:</strong> Click <strong>+ Add Student</strong> to enroll a new student.</li>
                        <li><strong>Step 2:</strong> Enter required details (name, academic level). Assigning a specific class is optional but recommended.</li>
                        <li><strong>Step 3:</strong> Use the search bar below to quickly find students, view their report cards, or manage their records.</li>
                    </ul>
                </div>
            </div>

            {/* Search & Filter */}
            {/* Search & Filters */}
            <div
                className="flex flex-col sm:flex-row"
                style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}
            >
                <input
                    className="input-field sm:max-w-xs w-full"
                    placeholder="Search by name or admission..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select
                    className="input-field sm:w-40 w-full"
                    value={filterGradeStream}
                    onChange={e => setFilterGradeStream(e.target.value)}
                >
                    <option value="">All Classes</option>
                    {gradeStreams.map(gs => (
                        <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                    ))}
                </select>
                <select
                    className="input-field sm:w-32 w-full"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    <option value="">All Status</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRANSFERRED">TRANSFERRED</option>
                    <option value="GRADUATED">GRADUATED</option>
                    <option value="DEACTIVATED">DEACTIVATED</option>
                </select>
                <div className="text-sm text-[var(--color-text-muted)] py-2 self-center">
                    {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                </div>
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
                    <table className="data-table sm:whitespace-nowrap w-full">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Admission #</th>
                                <th>Class</th>
                                <th>Guardian Phone</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-[var(--color-text-muted)] py-8">
                                        Loading students...
                                    </td>
                                </tr>
                            ) : paginatedStudents.length > 0 ? (
                                paginatedStudents.map((s) => (
                                    <tr key={s.id}>
                                        <td data-label="Student" className="font-medium text-[var(--color-text-primary)]">
                                            {s.users?.first_name || '—'} {s.users?.last_name || ''}
                                        </td>
                                        <td data-label="Admission #" className="text-[var(--color-text-muted)] font-mono text-sm">{s.admission_number}</td>
                                        <td data-label="Class">{s.grade_streams?.full_name || '—'}</td>
                                        <td data-label="Guardian Phone">
                                            {editingGuardianId === s.id ? (
                                                <div className="flex flex-col gap-1" style={{ minWidth: 160 }}>
                                                    <input
                                                        className="input-field w-full text-xs py-1 px-2"
                                                        placeholder="e.g. 0712345678"
                                                        value={editGuardianPhone}
                                                        onChange={e => setEditGuardianPhone(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <input
                                                        className="input-field w-full text-xs py-1 px-2"
                                                        placeholder="Guardian name"
                                                        value={editGuardianName}
                                                        onChange={e => setEditGuardianName(e.target.value)}
                                                    />
                                                    <div className="flex gap-1">
                                                        <button
                                                            className="px-2 py-0.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                                                            onClick={() => handleSaveGuardian(s.id)}
                                                            disabled={savingGuardian}
                                                        >
                                                            {savingGuardian ? '...' : '✓ Save'}
                                                        </button>
                                                        <button
                                                            className="px-2 py-0.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]"
                                                            onClick={handleCancelEditGuardian}
                                                            disabled={savingGuardian}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    {s.guardian_phone ? (
                                                        <span className="text-xs font-mono text-green-500">{s.guardian_phone}</span>
                                                    ) : (
                                                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                                                    )}
                                                    <button
                                                        className="ml-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                                        onClick={() => handleStartEditGuardian(s)}
                                                        title="Edit guardian phone"
                                                    >
                                                        ✏️
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Status">
                                            <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td data-label="Actions">
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn-secondary px-3 py-1 text-xs inline-flex"
                                                    onClick={() => handleStartEditStudent(s)}
                                                >
                                                    ✏️ Edit
                                                </button>
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
                                    <td colSpan={6} className="text-center text-[var(--color-text-muted)] py-8">
                                        {search || filterGradeStream || filterStatus ? 'No students match your filters.' : 'No students found. Click "+ Add Student" to get started.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                    <div className="text-sm text-[var(--color-text-muted)]">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            ← Previous
                        </button>
                        <button
                            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

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
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number</label>
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
                                    onChange={e => setNewStudent(p => ({ ...p, academic_level_id: e.target.value, grade_stream_id: '' }))}
                                >
                                    <option value="">-- Select Academic Level --</option>
                                    {academicLevels.map(al => (
                                        <option key={al.id} value={al.id}>{al.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class (Optional)</label>
                                <select
                                    className="input-field w-full"
                                    value={newStudent.grade_stream_id}
                                    onChange={e => setNewStudent(p => ({ ...p, grade_stream_id: e.target.value }))}
                                >
                                    <option value="">-- Select Class --</option>
                                    {gradeStreams
                                        .filter(gs => !newStudent.academic_level_id || gs.academic_level_id === newStudent.academic_level_id)
                                        .map(gs => (
                                            <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Phone</label>
                                    <input
                                        className="input-field w-full"
                                        placeholder="e.g. 0712345678"
                                        value={newStudent.guardian_phone}
                                        onChange={e => setNewStudent(p => ({ ...p, guardian_phone: e.target.value }))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Name</label>
                                    <input
                                        className="input-field w-full"
                                        placeholder="e.g. Mary Moraa"
                                        value={newStudent.guardian_name}
                                        onChange={e => setNewStudent(p => ({ ...p, guardian_name: e.target.value }))}
                                    />
                                </div>
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

            {/* ── Edit Student Modal ────────────────────────── */}
            {editingStudent && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={handleCancelEditStudent}
                >
                    <div
                        className="card w-full max-w-md"
                        style={{ animation: 'fadeIn .2s ease' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Edit Student</h2>

                        <div className="flex flex-col gap-4 mb-6">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name *</label>
                                    <input
                                        className="input-field w-full"
                                        value={editData.first_name}
                                        onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name *</label>
                                    <input
                                        className="input-field w-full"
                                        value={editData.last_name}
                                        onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number</label>
                                <input
                                    className="input-field w-full"
                                    value={editData.admission_number}
                                    onChange={e => setEditData(p => ({ ...p, admission_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class</label>
                                <select
                                    className="input-field w-full"
                                    value={editData.grade_stream_id}
                                    onChange={e => setEditData(p => ({ ...p, grade_stream_id: e.target.value }))}
                                >
                                    <option value="">-- No Class --</option>
                                    {gradeStreams.map(gs => (
                                        <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Status</label>
                                <select
                                    className="input-field w-full"
                                    value={editData.status}
                                    onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="TRANSFERRED">TRANSFERRED</option>
                                    <option value="GRADUATED">GRADUATED</option>
                                    <option value="DEACTIVATED">DEACTIVATED</option>
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Phone</label>
                                    <input
                                        className="input-field w-full"
                                        value={editData.guardian_phone}
                                        onChange={e => setEditData(p => ({ ...p, guardian_phone: e.target.value }))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Name</label>
                                    <input
                                        className="input-field w-full"
                                        value={editData.guardian_name}
                                        onChange={e => setEditData(p => ({ ...p, guardian_name: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn-secondary"
                                onClick={handleCancelEditStudent}
                                disabled={savingEdit}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary disabled:opacity-50"
                                onClick={handleSaveStudent}
                                disabled={savingEdit}
                            >
                                {savingEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
