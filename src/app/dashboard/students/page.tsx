"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import Pagination from '@/components/dashboard/Pagination';
import { Card, CardContent, Button, Input, Select, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge } from '@/components/ui';
import { Users, UserPlus, Search, Eye, Pencil, FileText, Trash2, X, Phone, Calendar, Upload } from 'lucide-react';
import { toast } from 'sonner';

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

    const handleDeleteStudent = async (id: string, name: string) => { if (!confirm(`Delete ${name}? This removes all records.`)) return; setDeletingId(id); try { const res = await fetch(`/api/admin/delete-student?student_id=${id}&user_id=${profile?.id}`, { method: 'DELETE' }); const r = await res.json(); if (!res.ok) toast.error(r.error || 'Failed to delete student'); else { setStudents(p => p.filter(s => s.id !== id)); toast.success('Student deleted successfully'); } } catch { toast.error('Error deleting student.'); } setDeletingId(null); };
    const handleStartEdit = (s: StudentRow) => { setEditingStudent(s); setEditData({ first_name: s.users?.first_name || '', last_name: s.users?.last_name || '', admission_number: s.admission_number || '', guardian_phone: s.guardian_phone || '', guardian_name: s.guardian_name || '', guardian_email: s.guardian_email || '', gender: s.gender || '', date_of_birth: s.date_of_birth || '', grade_stream_id: s.grade_streams?.id || '', status: s.status || 'ACTIVE', avatar_url: s.avatar_url || '' }); };
    const handleSaveStudent = async () => { if (!editingStudent) return; setSavingEdit(true); try { const res = await fetch('/api/admin/update-student', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: editingStudent.id, first_name: editData.first_name.trim(), last_name: editData.last_name.trim(), admission_number: editData.admission_number.trim(), guardian_phone: editData.guardian_phone.trim() || null, guardian_name: editData.guardian_name.trim() || null, guardian_email: editData.guardian_email.trim() || null, gender: editData.gender || null, date_of_birth: editData.date_of_birth || null, grade_stream_id: editData.grade_stream_id || null, status: editData.status, avatar_url: editData.avatar_url || null }) }); const r = await res.json(); if (!res.ok) toast.error(r.error || 'Failed to update student'); else { setStudents(p => p.map(s => s.id !== editingStudent.id ? s : { ...s, admission_number: editData.admission_number.trim(), guardian_phone: editData.guardian_phone.trim() || null, guardian_name: editData.guardian_name.trim() || null, guardian_email: editData.guardian_email.trim() || null, gender: editData.gender || null, date_of_birth: editData.date_of_birth || null, avatar_url: editData.avatar_url || null, status: editData.status, users: s.users ? { ...s.users, first_name: editData.first_name.trim(), last_name: editData.last_name.trim() } : null, grade_streams: editData.grade_stream_id ? gradeStreams.find(gs => gs.id === editData.grade_stream_id) || s.grade_streams : null })); setEditingStudent(null); toast.success('Student updated successfully'); } } catch { toast.error('Error updating student.'); } setSavingEdit(false); };
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
                toast.error(data.error || 'Photo upload failed');
            }
        } catch {
            toast.error('Error uploading photo');
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard label="Total Students" value={students.length.toLocaleString()} sub={`${activeCount} active`} icon={Users} />
                <StatCard label="Active" value={activeCount.toLocaleString()} sub="Currently enrolled" icon={Users} iconClassName="bg-emerald-500/10 text-emerald-500" />
                <StatCard label="Classes" value={gradeStreams.length.toString()} sub="Streams available" icon={Users} iconClassName="bg-blue-500/10 text-blue-500" />
                <StatCard label="With Guardians" value={students.filter(s => s.guardian_phone).length.toString()} sub="Have phone contact" icon={Users} iconClassName="bg-violet-500/10 text-violet-500" />
            </div>

            <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex items-center input-field overflow-hidden px-0 flex-1">
                    <span className="flex items-center justify-center pl-2.5 text-muted-foreground shrink-0">
                        <Search size={16} />
                    </span>
                    <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search by name, admission no., or phone..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select className="h-9 text-xs w-full md:w-auto md:min-w-[150px]" value={filterGradeStream} onChange={e => setFilterGradeStream(e.target.value)}>
                    <option value="">All Classes</option>
                    {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                </Select>
                <Select className="h-9 text-xs w-full md:w-auto md:min-w-[150px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="TRANSFERRED">Transferred</option>
                    <option value="GRADUATED">Graduated</option>
                    <option value="DEACTIVATED">Deactivated</option>
                </Select>
                {(search || filterGradeStream || filterStatus) && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterGradeStream(''); setFilterStatus(''); }} className="text-primary whitespace-nowrap px-3 h-9">Clear filters</Button>}
            </div>

            {fetchError && <div className="mb-3 p-2 rounded-md text-xs bg-red-500/10 text-red-400 border border-red-500/30">⚠️ {fetchError}</div>}

            {/* Table Card */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {loading ? (
                    <InlineLoadingSkeleton rows={6} />
                ) : paginated.length === 0 ? (
                    <EmptyState icon={<Users style={{ width: 24, height: 24 }} />} title="No students found" description={search || filterGradeStream || filterStatus ? 'No students match your filters.' : 'Click "+ Add Student" to enroll your first student.'} action={!search && !filterGradeStream && !filterStatus ? <button className="btn-primary text-xs px-4 py-2" onClick={() => setShowAddModal(true)}>Add Student</button> : undefined} />
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Admission No.</TableHead><TableHead>Class</TableHead><TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {paginated.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{getInitials(s)}</div>
                                                    <div>
                                                        <div className="font-semibold text-[13px]">{s.users?.first_name || '—'} {s.users?.last_name || ''}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">{s.status === 'ACTIVE' ? 'Active' : s.status}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-[12px] text-muted-foreground">{s.admission_number || '—'}</TableCell>
                                            <TableCell className="text-[12px]">{s.grade_streams?.full_name || '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <Button variant="ghost" size="icon" className="w-7 h-7 text-primary" onClick={() => openViewPanel(s.id)} title="View Profile"><Eye className="w-3.5 h-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleStartEdit(s)} title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                                                    <a href={`/api/reports/student/${s.id}`} target="_blank" className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Report Card"><FileText className="w-3.5 h-3.5" /></a>
                                                    <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => handleDeleteStudent(s.id, `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim())} disabled={deletingId === s.id} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-2 p-2">
                            {paginated.map(s => (
                                <Card key={s.id} className="p-3 bg-muted border border-border/50">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">{getInitials(s)}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-[14px] truncate">{s.users?.first_name} {s.users?.last_name}</div>
                                            <div className="text-[11px] text-muted-foreground truncate">{s.admission_number || '—'} &middot; {s.grade_streams?.full_name || '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => openViewPanel(s.id)} className="flex-1 text-[11px] h-7">View</Button>
                                        <Button variant="secondary" size="sm" onClick={() => handleStartEdit(s)} className="flex-1 text-[11px] h-7">Edit</Button>
                                        <a href={`/api/reports/student/${s.id}`} target="_blank" className="flex-1 h-7 inline-flex items-center justify-center rounded-md border border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors text-center">Report</a>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
                    </>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setSaveMessage(null); }}>
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <CardContent className="p-6">
                            <h2 className="text-lg font-bold font-display mb-4">Add New Student</h2>
                            <div className="flex flex-col gap-4 mb-6">
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">First Name *</label><Input className="w-full text-sm h-9" value={newStudent.first_name} onChange={e => setNewStudent(p => ({ ...p, first_name: e.target.value }))} autoFocus /></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Last Name *</label><Input className="w-full text-sm h-9" value={newStudent.last_name} onChange={e => setNewStudent(p => ({ ...p, last_name: e.target.value }))} /></div></div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Admission Number</label><Input className="w-full text-sm h-9" placeholder="ADM-2026-001" value={newStudent.admission_number} onChange={e => setNewStudent(p => ({ ...p, admission_number: e.target.value }))} /></div>
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Gender</label><Select className="w-full text-sm h-9" value={newStudent.gender} onChange={e => setNewStudent(p => ({ ...p, gender: e.target.value }))}><option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option></Select></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Date of Birth</label><Input className="w-full text-sm h-9" type="date" value={newStudent.date_of_birth} onChange={e => setNewStudent(p => ({ ...p, date_of_birth: e.target.value }))} /></div></div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Photo</label>
                                    <div className="flex items-center gap-3">
                                        {newStudent.avatar_url ? (
                                            <div className="relative w-12 h-12 shrink-0">
                                                <img src={newStudent.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                                                <button type="button" onClick={() => setNewStudent(p => ({ ...p, avatar_url: '' }))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors">×</button>
                                            </div>
                                        ) : null}
                                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card cursor-pointer text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                                            <Upload className="w-3.5 h-3.5" />
                                            {uploadingPhoto ? 'Uploading...' : 'Choose File'}
                                            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setNewStudent(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} />
                                        </label>
                                    </div>
                                </div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Academic Level *</label><Select className="w-full text-sm h-9" value={newStudent.academic_level_id} onChange={e => setNewStudent(p => ({ ...p, academic_level_id: e.target.value, grade_stream_id: '' }))}><option value="">-- Select --</option>{academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}</Select></div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Class</label><Select className="w-full text-sm h-9" value={newStudent.grade_stream_id} onChange={e => setNewStudent(p => ({ ...p, grade_stream_id: e.target.value }))}><option value="">-- Select --</option>{gradeStreams.filter(gs => !newStudent.academic_level_id || gs.academic_level_id === newStudent.academic_level_id).map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}</Select></div>
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Guardian Phone</label><Input className="w-full text-sm h-9" value={newStudent.guardian_phone} onChange={e => setNewStudent(p => ({ ...p, guardian_phone: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Guardian Name</label><Input className="w-full text-sm h-9" value={newStudent.guardian_name} onChange={e => setNewStudent(p => ({ ...p, guardian_name: e.target.value }))} /></div></div>
                            </div>
                            {saveMessage && <div className={`mb-4 p-2.5 rounded-md text-xs font-medium border ${saveMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>{saveMessage.text}</div>}
                            <div className="flex gap-2 justify-end">
                                <Button variant="secondary" onClick={() => { setShowAddModal(false); setSaveMessage(null); }} disabled={saving}>Cancel</Button>
                                <Button variant="primary" onClick={handleAddStudent} disabled={saving}>{saving ? 'Saving...' : 'Add Student'}</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit Modal */}
            {editingStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingStudent(null)}>
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <CardContent className="p-6">
                            <h2 className="text-lg font-bold font-display mb-4">Edit Student</h2>
                            <div className="flex flex-col gap-4 mb-6">
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">First Name</label><Input className="w-full text-sm h-9" value={editData.first_name} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Last Name</label><Input className="w-full text-sm h-9" value={editData.last_name} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></div></div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Admission Number</label><Input className="w-full text-sm h-9" value={editData.admission_number} onChange={e => setEditData(p => ({ ...p, admission_number: e.target.value }))} /></div>
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Gender</label><Select className="w-full text-sm h-9" value={editData.gender} onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))}><option value="">-- Select --</option><option value="Male">Male</option><option value="Female">Female</option></Select></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Date of Birth</label><Input className="w-full text-sm h-9" type="date" value={editData.date_of_birth} onChange={e => setEditData(p => ({ ...p, date_of_birth: e.target.value }))} /></div></div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Photo</label>
                                    <div className="flex items-center gap-3">
                                        {editData.avatar_url ? (
                                            <div className="relative w-12 h-12 shrink-0">
                                                <img src={editData.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                                                <button type="button" onClick={() => setEditData(p => ({ ...p, avatar_url: '' }))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600 transition-colors">×</button>
                                            </div>
                                        ) : null}
                                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card cursor-pointer text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                                            <Upload className="w-3.5 h-3.5" />
                                            {uploadingPhoto ? 'Uploading...' : 'Choose File'}
                                            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setEditData(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} />
                                        </label>
                                    </div>
                                </div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Class</label><Select className="w-full text-sm h-9" value={editData.grade_stream_id} onChange={e => setEditData(p => ({ ...p, grade_stream_id: e.target.value }))}><option value="">-- None --</option>{gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}</Select></div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Status</label><Select className="w-full text-sm h-9" value={editData.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="TRANSFERRED">Transferred</option><option value="GRADUATED">Graduated</option><option value="DEACTIVATED">Deactivated</option></Select></div>
                                <div className="flex gap-3"><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Guardian Phone</label><Input className="w-full text-sm h-9" value={editData.guardian_phone} onChange={e => setEditData(p => ({ ...p, guardian_phone: e.target.value }))} /></div><div className="flex-1"><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Guardian Name</label><Input className="w-full text-sm h-9" value={editData.guardian_name} onChange={e => setEditData(p => ({ ...p, guardian_name: e.target.value }))} /></div></div>
                                <div><label className="block text-xs text-muted-foreground mb-1.5 font-medium">Guardian Email</label><Input className="w-full text-sm h-9" type="email" value={editData.guardian_email} onChange={e => setEditData(p => ({ ...p, guardian_email: e.target.value }))} /></div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="secondary" onClick={() => setEditingStudent(null)} disabled={savingEdit}>Cancel</Button>
                                <Button variant="primary" onClick={handleSaveStudent} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* View Profile Panel */}
            {viewStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewStudent(null)}>
                    <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 lg:px-6 border-b border-border shrink-0">
                            <div className="flex items-center gap-4">
                                {viewStudent.profile.avatar_url && !viewPhotoError ? (
                                    <img src={viewStudent.profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" onError={() => setViewPhotoError(true)} />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                        {`${viewStudent.profile.first_name?.[0] || '?'}${viewStudent.profile.last_name?.[0] || '?'}`.toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-xl font-bold font-display">
                                        {viewStudent.profile.first_name} {viewStudent.profile.last_name}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                        {viewStudent.profile.admission_number} &middot; {viewStudent.profile.grade_stream?.full_name || '—'}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setViewStudent(null)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex overflow-x-auto border-b border-border shrink-0 px-2 lg:px-4">
                            {(['profile', 'academic', 'reports', 'attendance'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setViewTab(tab)}
                                    className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${viewTab === tab ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                                >
                                    {tab === 'profile' ? 'Profile' : tab === 'academic' ? 'Academic History' : tab === 'reports' ? 'Report History' : 'Attendance'}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 lg:p-6">
                            {viewLoading ? (
                                <InlineLoadingSkeleton rows={4} />
                            ) : viewTab === 'profile' ? (
                                <div className="animate-in fade-in duration-200">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Full Name</label><div className="text-sm font-medium">{viewStudent.profile.first_name} {viewStudent.profile.last_name}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Admission No.</label><div className="text-sm font-mono font-medium">{viewStudent.profile.admission_number}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Email</label><div className="text-sm">{viewStudent.profile.email || '—'}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Phone</label><div className="text-sm">{viewStudent.profile.phone || '—'}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Gender</label><div className="text-sm">{viewStudent.profile.gender || '—'}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Date of Birth</label><div className="text-sm">{formatDate(viewStudent.profile.date_of_birth)}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Date Enrolled</label><div className="text-sm">{formatDate(viewStudent.profile.date_enrolled)}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Status</label><div><StatusBadge status={viewStudent.profile.status} /></div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Class</label><div className="text-sm">{viewStudent.profile.grade_stream?.full_name || '—'}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Academic Level</label><div className="text-sm">{viewStudent.profile.academic_level?.name || '—'}</div></div>
                                    </div>
                                    <hr className="my-6 border-t border-border" />
                                    <h3 className="text-sm font-semibold font-display mb-4">Guardian Information</h3>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Name</label><div className="text-sm">{viewStudent.profile.guardian_name || '—'}</div></div>
                                        <div><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Phone</label><div className="text-sm">{viewStudent.profile.guardian_phone || '—'}</div></div>
                                        <div className="col-span-2"><label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">Email</label><div className="text-sm">{viewStudent.profile.guardian_email || '—'}</div></div>
                                    </div>
                                </div>
                            ) : viewTab === 'academic' ? (
                                <div className="animate-in fade-in duration-200">
                                    {viewStudent.academicHistory.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-8">No academic records yet.</p>
                                    ) : (
                                        viewStudent.academicHistory.map(term => (
                                            <div key={term.term_id} className="mb-6 last:mb-0">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="text-sm font-semibold">{term.term_name}</h4>
                                                    <Badge variant={term.average >= 50 ? 'success' : 'danger'}>{term.average}%</Badge>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    {term.subjects.map((sub, i) => (
                                                        <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-muted border border-border/50 text-xs">
                                                            <span className="text-muted-foreground font-medium">{sub.subject_name}</span>
                                                            <span className={`font-semibold ${sub.percentage >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{sub.percentage}% {sub.grade_symbol ? `(${sub.grade_symbol})` : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : viewTab === 'reports' ? (
                                <div className="animate-in fade-in duration-200">
                                    {viewStudent.reportHistory.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-8">No report cards generated yet.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {viewStudent.reportHistory.map(r => (
                                                <div key={r.id} className="flex justify-between items-center p-3 lg:px-4 rounded-lg bg-muted border border-border/50">
                                                    <div>
                                                        <div className="text-sm font-semibold">{r.term} — {r.year}</div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5">Generated {formatDate(r.generated_at)}{r.average !== null && r.average !== undefined ? ` · Avg: ${r.average}%` : ''}{r.position ? ` · Rank: ${r.position}` : ''}</div>
                                                    </div>
                                                    <a href={`/api/reports/student/${viewStudent.profile.id}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="animate-in fade-in duration-200">
                                    {viewStudent.attendanceHistory.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-8">No attendance records yet. Attendance is tracked when generating report cards.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {viewStudent.attendanceHistory.map(a => (
                                                <div key={a.id} className="flex justify-between items-center p-3 lg:px-4 rounded-lg bg-muted border border-border/50">
                                                    <div>
                                                        <div className="text-sm font-semibold">{a.term} — {a.year}</div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5">{a.present} of {a.total} days present</div>
                                                    </div>
                                                    <span className={`text-sm font-bold ${a.percentage !== null && a.percentage >= 80 ? 'text-emerald-500' : a.percentage !== null && a.percentage >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{a.percentage !== null ? `${a.percentage}%` : '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
