"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import Pagination from '@/components/dashboard/Pagination';
import { Users, UserPlus, Search, Eye, Pencil, FileText, Trash2, X, Phone, Calendar, Upload } from 'lucide-react';

interface StudentRow {
    id: string; admission_number: string; status: string;
    guardian_phone: string | null; guardian_name: string | null; guardian_email: string | null;
    gender: string | null; date_of_birth: string | null; date_enrolled: string | null; avatar_url: string | null;
    users: { first_name: string; last_name: string; email: string } | null;
    grade_streams: { id: string; full_name: string } | null;
}
interface GradeStreamOption { id: string; full_name: string; academic_level_id: string | null; }
interface AcademicLevelOption { id: string; name: string; }

interface StudentDetail {
    profile: {
        id: string; first_name: string; last_name: string; email: string; phone: string | null;
        admission_number: string; gender: string | null; date_of_birth: string | null;
        date_enrolled: string | null; status: string; avatar_url: string | null;
        guardian_name: string | null; guardian_phone: string | null; guardian_email: string | null;
        grade_stream: { id: string; full_name: string } | null;
        academic_level: { id: string; name: string; code: string } | null;
    };
    academicHistory: { term_id: string; term_name: string; subjects: { subject_name: string; percentage: number; grade_symbol: string | null }[]; average: number }[];
    reportHistory: { id: string; generated_at: string; term: string; year: string; average: number | null; position: number | null }[];
    attendanceHistory: { id: string; term: string; year: string; present: number; total: number; percentage: number | null }[];
}

export default function StudentsPage() {
    const { profile } = useAuth();
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterGradeStream, setFilterGradeStream] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', admission_number: '', grade_stream_id: '', academic_level_id: '', guardian_phone: '', guardian_name: '', guardian_email: '', gender: '', date_of_birth: '', avatar_url: '' });
    const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
    const [editData, setEditData] = useState({ first_name: '', last_name: '', admission_number: '', guardian_phone: '', guardian_name: '', guardian_email: '', gender: '', date_of_birth: '', grade_stream_id: '', status: '', avatar_url: '' });
    const [savingEdit, setSavingEdit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [viewStudent, setViewStudent] = useState<StudentDetail | null>(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewTab, setViewTab] = useState<'profile' | 'academic' | 'reports' | 'attendance'>('profile');
    const [viewPhotoError, setViewPhotoError] = useState(false);

    const fetchStudents = async () => { setFetchError(null); try { const res = await fetch('/api/school/data?type=students'); const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Failed'); setStudents(json.data || []); } catch (err: unknown) { setFetchError(err instanceof Error ? err.message : 'Unknown error'); } setLoading(false); };
    const fetchGradeStreams = async () => { try { const res = await fetch('/api/school/data?type=grade_streams'); const json = await res.json(); if (!res.ok) return; setGradeStreams((json.data || []).map((d: any) => ({ id: d.id, full_name: d.full_name, academic_level_id: d.grades?.academic_level_id || d.academic_level_id || null }))); } catch {} };
    const fetchAcademicLevels = async () => { try { const res = await fetch('/api/admin/academic-structure'); const json = await res.json(); setAcademicLevels(json.academic_levels || []); } catch {} };
    useEffect(() => { fetchStudents(); fetchGradeStreams(); fetchAcademicLevels(); }, []);

    const openViewPanel = async (studentId: string) => { setViewLoading(true); setViewStudent(null); setViewTab('profile'); setFetchError(null); setViewPhotoError(false); try { const res = await fetch(`/api/school/students/${studentId}`); if (res.ok) { const json = await res.json(); setViewStudent(json); } else { const err = await res.json().catch(() => ({})); setFetchError(err.error || 'Failed to load student details'); } } catch (e: unknown) { setFetchError(e instanceof Error ? e.message : 'Failed to load student details'); } setViewLoading(false); };

    const filtered = useMemo(() => {
        let r = students;
        if (filterGradeStream) r = r.filter(s => s.grade_streams?.id === filterGradeStream);
        if (filterStatus) r = r.filter(s => s.status === filterStatus);
        const q = search?.trim()?.toLowerCase();
        if (q) r = r.filter(s => `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.toLowerCase().includes(q) || (s.admission_number || '').toLowerCase().includes(q) || (s.guardian_phone || '').includes(q));
        return r;
    }, [students, search, filterGradeStream, filterStatus]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = useMemo(() => { const s = (currentPage - 1) * pageSize; return filtered.slice(s, s + pageSize); }, [filtered, currentPage, pageSize]);
    useEffect(() => { setCurrentPage(1); }, [search, filterGradeStream, filterStatus]);

    const handleDeleteStudent = async (id: string, name: string) => { if (!confirm(`Delete ${name}? This removes all records.`)) return; setDeletingId(id); try { const res = await fetch(`/api/admin/delete-student?student_id=${id}&user_id=${profile?.id}`, { method: 'DELETE' }); const r = await res.json(); if (!res.ok) alert(r.error || 'Failed'); else setStudents(p => p.filter(s => s.id !== id)); } catch { alert('Error deleting student.'); } setDeletingId(null); };
    const handleStartEdit = (s: StudentRow) => { setEditingStudent(s); setEditData({ first_name: s.users?.first_name || '', last_name: s.users?.last_name || '', admission_number: s.admission_number || '', guardian_phone: s.guardian_phone || '', guardian_name: s.guardian_name || '', guardian_email: s.guardian_email || '', gender: s.gender || '', date_of_birth: s.date_of_birth || '', grade_stream_id: s.grade_streams?.id || '', status: s.status || 'ACTIVE', avatar_url: s.avatar_url || '' }); };
    const handleSaveStudent = async () => { if (!editingStudent) return; setSavingEdit(true); try { const res = await fetch('/api/admin/update-student', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: editingStudent.id, first_name: editData.first_name.trim(), last_name: editData.last_name.trim(), admission_number: editData.admission_number.trim(), guardian_phone: editData.guardian_phone.trim() || null, guardian_name: editData.guardian_name.trim() || null, guardian_email: editData.guardian_email.trim() || null, gender: editData.gender || null, date_of_birth: editData.date_of_birth || null, grade_stream_id: editData.grade_stream_id || null, status: editData.status, avatar_url: editData.avatar_url || null }) }); const r = await res.json(); if (!res.ok) alert(r.error || 'Failed'); else { setStudents(p => p.map(s => s.id !== editingStudent.id ? s : { ...s, admission_number: editData.admission_number.trim(), guardian_phone: editData.guardian_phone.trim() || null, guardian_name: editData.guardian_name.trim() || null, guardian_email: editData.guardian_email.trim() || null, gender: editData.gender || null, date_of_birth: editData.date_of_birth || null, avatar_url: editData.avatar_url || null, status: editData.status, users: s.users ? { ...s.users, first_name: editData.first_name.trim(), last_name: editData.last_name.trim() } : null, grade_streams: editData.grade_stream_id ? gradeStreams.find(gs => gs.id === editData.grade_stream_id) || s.grade_streams : null })); setEditingStudent(null); } } catch { alert('Error updating.'); } setSavingEdit(false); };
    const handleAddStudent = async () => { if (!newStudent.first_name.trim() || !newStudent.last_name.trim()) { setSaveMessage({ type: 'error', text: 'Name required.' }); return; } if (!newStudent.academic_level_id) { setSaveMessage({ type: 'error', text: 'Select academic level.' }); return; } setSaving(true); setSaveMessage(null); try { const res = await fetch('/api/admin/add-student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: newStudent.first_name.trim(), last_name: newStudent.last_name.trim(), admission_number: newStudent.admission_number.trim() || null, grade_stream_id: newStudent.grade_stream_id || null, academic_level_id: newStudent.academic_level_id, guardian_phone: newStudent.guardian_phone.trim() || null, guardian_name: newStudent.guardian_name.trim() || null, guardian_email: newStudent.guardian_email.trim() || null, gender: newStudent.gender || null, date_of_birth: newStudent.date_of_birth || null, avatar_url: newStudent.avatar_url || null, admin_user_id: profile?.id }) }); const r = await res.json(); if (!res.ok) setSaveMessage({ type: 'error', text: r.error || 'Failed' }); else { setSaveMessage({ type: 'success', text: 'Student added!' }); setNewStudent({ first_name: '', last_name: '', admission_number: '', grade_stream_id: '', academic_level_id: '', guardian_phone: '', guardian_name: '', guardian_email: '', gender: '', date_of_birth: '', avatar_url: '' }); await fetchStudents(); setTimeout(() => { setShowAddModal(false); setSaveMessage(null); }, 1200); } } catch (e: unknown) { setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Error' }); } setSaving(false); };

    const handlePhotoFileSelect = async (file: File, setUrl: (url: string) => void) => {
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/upload-photo', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.url) {
                setUrl(data.url);
            } else {
                alert(data.error || 'Photo upload failed');
            }
        } catch {
            alert('Error uploading photo');
        }
        setUploadingPhoto(false);
    };

    const getInitials = (s: StudentRow) => `${(s.users?.first_name || '?')[0]}${(s.users?.last_name || '?')[0]}`.toUpperCase();
    const activeCount = students.filter(s => s.status === 'ACTIVE').length;
    const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="w-full max-w-7xl mx-auto">
            <PageHeader title="Students" description="Manage student profiles, admission records, classes, and guardian contacts." breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Students' }]} action={<button className="btn-primary text-xs px-4 py-2" onClick={() => setShowAddModal(true)}><UserPlus style={{ width: 14, height: 14 }} /> Add Student</button>} />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '12px', marginBottom: '16px' }}>
                <StatCard label="Total Students" value={students.length.toLocaleString()} sub={`${activeCount} active`} icon={Users} />
                <StatCard label="Active" value={activeCount.toLocaleString()} sub="Currently enrolled" icon={Users} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" />
                <StatCard label="Classes" value={gradeStreams.length.toString()} sub="Streams available" icon={Users} iconBg="rgba(59,130,246,0.12)" iconColor="#3B82F6" />
                <StatCard label="With Guardians" value={students.filter(s => s.guardian_phone).length.toString()} sub="Have phone contact" icon={Users} iconBg="rgba(139,92,246,0.12)" iconColor="#8B5CF6" />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center" style={{ gap: '8px', marginBottom: '12px' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)' }} />
                    <input className="input-field text-xs" placeholder="Search by name, admission no., or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', height: '34px', fontSize: '0.75rem' }} />
                </div>
                <select className="input-field text-xs" value={filterGradeStream} onChange={e => setFilterGradeStream(e.target.value)} style={{ width: 'auto', minWidth: '130px', height: '34px', fontSize: '0.75rem' }}>
                    <option value="">All Classes</option>
                    {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                </select>
                <select className="input-field text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: '130px', height: '34px', fontSize: '0.75rem' }}>
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TRANSFERRED">Transferred</option>
                    <option value="GRADUATED">Graduated</option>
                    <option value="DEACTIVATED">Deactivated</option>
                </select>
                {(search || filterGradeStream || filterStatus) && <button onClick={() => { setSearch(''); setFilterGradeStream(''); setFilterStatus(''); }} style={{ fontSize: '0.6875rem', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear filters</button>}
            </div>

            {fetchError && <div className="mb-3 p-2 rounded-md text-xs bg-red-500/10 text-red-400 border border-red-500/30">⚠️ {fetchError}</div>}

            {/* Table Card */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {loading ? (
                    <InlineLoadingSkeleton rows={6} />
                ) : paginated.length === 0 ? (
                    <EmptyState icon={<Users style={{ width: 24, height: 24 }} />} title="No students found" description={search || filterGradeStream || filterStatus ? 'No students match your filters.' : 'Click "+ Add Student" to enroll your first student.'} action={!search && !filterGradeStream && !filterStatus ? <button className="btn-primary text-xs px-4 py-2" onClick={() => setShowAddModal(true)}>Add Student</button> : undefined} />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="data-table w-full">
                                <thead><tr><th>Name</th><th>Admission No.</th><th>Class</th><th style={{ width: '100px' }}>Actions</th></tr></thead>
                                <tbody>
                                    {paginated.map(s => (
                                        <tr key={s.id}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-accent)', flexShrink: 0 }}>{getInitials(s)}</div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{s.users?.first_name || '—'} {s.users?.last_name || ''}</div>
                                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{s.status === 'ACTIVE' ? 'Active' : s.status}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.admission_number || '—'}</td>
                                            <td style={{ fontSize: '0.75rem' }}>{s.grade_streams?.full_name || '—'}</td>
                                            <td>
                                                <div className="flex items-center gap-1">
                                                    <button type="button" onClick={() => openViewPanel(s.id)} title="View Profile" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-accent)' }}><Eye style={{ width: 12, height: 12 }} /></button>
                                                    <button type="button" onClick={() => handleStartEdit(s)} title="Edit" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Pencil style={{ width: 12, height: 12 }} /></button>
                                                    <a href={`/api/reports/student/${s.id}`} target="_blank" title="Report Card" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}><FileText style={{ width: 12, height: 12 }} /></a>
                                                    <button type="button" onClick={() => handleDeleteStudent(s.id, `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim())} disabled={deletingId === s.id} title="Delete" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', opacity: deletingId === s.id ? 0.5 : 1 }}><Trash2 style={{ width: 12, height: 12 }} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden" style={{ padding: '8px' }}>
                            {paginated.map(s => (
                                <div key={s.id} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '8px' }}>
                                    <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-accent)' }}>{getInitials(s)}</div>
                                        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{s.users?.first_name} {s.users?.last_name}</div><div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{s.admission_number || '—'} &middot; {s.grade_streams?.full_name || '—'}</div></div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openViewPanel(s.id)} className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 8px', flex: 1 }}>View</button>
                                        <button onClick={() => handleStartEdit(s)} className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 8px', flex: 1 }}>Edit</button>
                                        <a href={`/api/reports/student/${s.id}`} target="_blank" className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 8px', flex: 1, textAlign: 'center' }}>Report</a>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
                    </>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowAddModal(false); setSaveMessage(null); }}>
                    <div className="card w-full max-w-md" style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '16px' }}>Add New Student</h2>
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name *</label><input className="input-field w-full text-xs" value={newStudent.first_name} onChange={e => setNewStudent(p => ({ ...p, first_name: e.target.value }))} autoFocus /></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name *</label><input className="input-field w-full text-xs" value={newStudent.last_name} onChange={e => setNewStudent(p => ({ ...p, last_name: e.target.value }))} /></div></div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number</label><input className="input-field w-full text-xs" placeholder="ADM-2026-001" value={newStudent.admission_number} onChange={e => setNewStudent(p => ({ ...p, admission_number: e.target.value }))} /></div>
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Gender</label><select className="input-field w-full text-xs" value={newStudent.gender} onChange={e => setNewStudent(p => ({ ...p, gender: e.target.value }))}><option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Date of Birth</label><input className="input-field w-full text-xs" type="date" value={newStudent.date_of_birth} onChange={e => setNewStudent(p => ({ ...p, date_of_birth: e.target.value }))} /></div></div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Photo</label>
                                <div className="flex items-center gap-2">
                                    {newStudent.avatar_url ? (
                                        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                                            <img src={newStudent.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                                            <button type="button" onClick={() => setNewStudent(p => ({ ...p, avatar_url: '' }))} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
                                        </div>
                                    ) : null}
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        <Upload style={{ width: 12, height: 12 }} />
                                        {uploadingPhoto ? 'Uploading...' : 'Choose File'}
                                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setNewStudent(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} />
                                    </label>
                                </div>
                            </div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Level *</label><select className="input-field w-full text-xs" value={newStudent.academic_level_id} onChange={e => setNewStudent(p => ({ ...p, academic_level_id: e.target.value, grade_stream_id: '' }))}><option value="">-- Select --</option>{academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}</select></div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Class</label><select className="input-field w-full text-xs" value={newStudent.grade_stream_id} onChange={e => setNewStudent(p => ({ ...p, grade_stream_id: e.target.value }))}><option value="">-- Select --</option>{gradeStreams.filter(gs => !newStudent.academic_level_id || gs.academic_level_id === newStudent.academic_level_id).map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}</select></div>
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Phone</label><input className="input-field w-full text-xs" value={newStudent.guardian_phone} onChange={e => setNewStudent(p => ({ ...p, guardian_phone: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Name</label><input className="input-field w-full text-xs" value={newStudent.guardian_name} onChange={e => setNewStudent(p => ({ ...p, guardian_name: e.target.value }))} /></div></div>
                        </div>
                        {saveMessage && <div className={`mb-3 p-2 rounded-md text-xs ${saveMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{saveMessage.text}</div>}
                        <div className="flex gap-2 justify-end"><button type="button" className="btn-secondary text-xs" onClick={() => { setShowAddModal(false); setSaveMessage(null); }} disabled={saving}>Cancel</button><button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={handleAddStudent} disabled={saving}>{saving ? 'Saving...' : 'Add Student'}</button></div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingStudent(null)}>
                    <div className="card w-full max-w-md" style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '16px' }}>Edit Student</h2>
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name</label><input className="input-field w-full text-xs" value={editData.first_name} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name</label><input className="input-field w-full text-xs" value={editData.last_name} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></div></div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number</label><input className="input-field w-full text-xs" value={editData.admission_number} onChange={e => setEditData(p => ({ ...p, admission_number: e.target.value }))} /></div>
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Gender</label><select className="input-field w-full text-xs" value={editData.gender} onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))}><option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option></select></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Date of Birth</label><input className="input-field w-full text-xs" type="date" value={editData.date_of_birth} onChange={e => setEditData(p => ({ ...p, date_of_birth: e.target.value }))} /></div></div>
                            <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Photo</label>
                                <div className="flex items-center gap-2">
                                    {editData.avatar_url ? (
                                        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                                            <img src={editData.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                                            <button type="button" onClick={() => setEditData(p => ({ ...p, avatar_url: '' }))} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
                                        </div>
                                    ) : null}
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        <Upload style={{ width: 12, height: 12 }} />
                                        {uploadingPhoto ? 'Uploading...' : 'Choose File'}
                                        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setEditData(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} />
                                    </label>
                                </div>
                            </div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Class</label><select className="input-field w-full text-xs" value={editData.grade_stream_id} onChange={e => setEditData(p => ({ ...p, grade_stream_id: e.target.value }))}><option value="">-- None --</option>{gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}</select></div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Status</label><select className="input-field w-full text-xs" value={editData.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="TRANSFERRED">Transferred</option><option value="GRADUATED">Graduated</option><option value="DEACTIVATED">Deactivated</option></select></div>
                            <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Phone</label><input className="input-field w-full text-xs" value={editData.guardian_phone} onChange={e => setEditData(p => ({ ...p, guardian_phone: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Name</label><input className="input-field w-full text-xs" value={editData.guardian_name} onChange={e => setEditData(p => ({ ...p, guardian_name: e.target.value }))} /></div></div>
                            <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Guardian Email</label><input className="input-field w-full text-xs" type="email" value={editData.guardian_email} onChange={e => setEditData(p => ({ ...p, guardian_email: e.target.value }))} /></div>
                        </div>
                        <div className="flex gap-2 justify-end"><button type="button" className="btn-secondary text-xs" onClick={() => setEditingStudent(null)} disabled={savingEdit}>Cancel</button><button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={handleSaveStudent} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button></div>
                    </div>
                </div>
            )}

            {/* View Profile Panel */}
            {viewStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setViewStudent(null)}>
                    <div className="card w-full max-w-2xl" style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                {viewStudent.profile.avatar_url && !viewPhotoError ? (
                                    <img src={viewStudent.profile.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={() => setViewPhotoError(true)} />
                                ) : (
                                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', flexShrink: 0 }}>
                                        {`${viewStudent.profile.first_name?.[0] || '?'}${viewStudent.profile.last_name?.[0] || '?'}`.toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                                        {viewStudent.profile.first_name} {viewStudent.profile.last_name}
                                    </h2>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                        {viewStudent.profile.admission_number} &middot; {viewStudent.profile.grade_stream?.full_name || '—'}
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setViewStudent(null)} style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X style={{ width: 14, height: 14 }} /></button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto' }}>
                            {(['profile', 'academic', 'reports', 'attendance'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setViewTab(tab)}
                                    style={{
                                        padding: 'var(--space-3) var(--space-4)', fontSize: '0.75rem', fontWeight: 600,
                                        background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                        color: viewTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                        borderBottom: viewTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                                    }}
                                >
                                    {tab === 'profile' ? 'Profile' : tab === 'academic' ? 'Academic History' : tab === 'reports' ? 'Report History' : 'Attendance'}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)' }}>
                            {viewLoading ? (
                                <InlineLoadingSkeleton rows={4} />
                            ) : viewTab === 'profile' ? (
                                <div>
                                    <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Full Name</label><div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{viewStudent.profile.first_name} {viewStudent.profile.last_name}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Admission No.</label><div style={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'monospace' }}>{viewStudent.profile.admission_number}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Email</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.email || '—'}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Phone</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.phone || '—'}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Gender</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.gender || '—'}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Date of Birth</label><div style={{ fontSize: '0.8125rem' }}>{formatDate(viewStudent.profile.date_of_birth)}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Date Enrolled</label><div style={{ fontSize: '0.8125rem' }}>{formatDate(viewStudent.profile.date_enrolled)}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Status</label><div><StatusBadge status={viewStudent.profile.status} /></div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.grade_stream?.full_name || '—'}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Academic Level</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.academic_level?.name || '—'}</div></div>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-4) 0' }} />
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Guardian Information</h3>
                                    <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Name</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.guardian_name || '—'}</div></div>
                                        <div><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Phone</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.guardian_phone || '—'}</div></div>
                                        <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Email</label><div style={{ fontSize: '0.8125rem' }}>{viewStudent.profile.guardian_email || '—'}</div></div>
                                    </div>
                                </div>
                            ) : viewTab === 'academic' ? (
                                <div>
                                    {viewStudent.academicHistory.length === 0 ? (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No academic records yet.</p>
                                    ) : (
                                        viewStudent.academicHistory.map(term => (
                                            <div key={term.term_id} style={{ marginBottom: 'var(--space-5)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{term.term_name}</h4>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px', background: term.average >= 50 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: term.average >= 50 ? '#10B981' : '#EF4444' }}>{term.average}%</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {term.subjects.map((sub, i) => (
                                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-raised)', fontSize: '0.75rem' }}>
                                                            <span style={{ color: 'var(--color-text-secondary)' }}>{sub.subject_name}</span>
                                                            <span style={{ fontWeight: 600, color: sub.percentage >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>{sub.percentage}% {sub.grade_symbol ? `(${sub.grade_symbol})` : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : viewTab === 'reports' ? (
                                <div>
                                    {viewStudent.reportHistory.length === 0 ? (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No report cards generated yet.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {viewStudent.reportHistory.map(r => (
                                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.term} — {r.year}</div>
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Generated {formatDate(r.generated_at)}{r.average !== null && r.average !== undefined ? ` · Avg: ${r.average}%` : ''}{r.position ? ` · Rank: ${r.position}` : ''}</div>
                                                    </div>
                                                    <a href={`/api/reports/student/${viewStudent.profile.id}`} target="_blank" className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 10px', textDecoration: 'none' }}><FileText style={{ width: 12, height: 12 }} /> PDF</a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    {viewStudent.attendanceHistory.length === 0 ? (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No attendance records yet. Attendance is tracked when generating report cards.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {viewStudent.attendanceHistory.map(a => (
                                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{a.term} — {a.year}</div>
                                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{a.present} of {a.total} days present</div>
                                                    </div>
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: a.percentage !== null && a.percentage >= 80 ? 'var(--color-success)' : a.percentage !== null && a.percentage >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{a.percentage !== null ? `${a.percentage}%` : '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
