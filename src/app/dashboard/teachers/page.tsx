"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import Pagination from '@/components/dashboard/Pagination';
import { GraduationCap, Users, BookOpen, UserCheck, Search, Eye, Pencil, Phone, Mail, X, BarChart3, FileText, Calendar, ClipboardList, Upload } from 'lucide-react';

interface TeacherRow {
  id: string; name: string; email: string; phone: string;
  employeeId: string; role: string; displayRole: string;
  subjects: string[]; classes: string[];
  status: string; workload: string;
  is_active: boolean; created_at: string;
  hasClass: boolean; hasSubjects: boolean;
}

interface TeacherDetail {
  profile: {
    id: string; first_name: string; last_name: string;
    email: string; phone: string; role: string;
    is_active: boolean; created_at: string;
  };
  classAssignments: { id: string; stream: string; year: string }[];
  subjectAssignments: { subject: string; subject_code: string; category: string; grade: string; stream: string | null; year: string }[];
  recentExams: { id: string; name: string; type: string; date: string; subject: string; grade: string }[];
  stats: { markCount: number; reportCount: number; examCount: number; classCount: number; subjectCount: number };
}

type TeacherTab = 'overview' | 'subjects' | 'classes' | 'exams';

export default function TeachersPage() {
  const { role } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [viewTeacher, setViewTeacher] = useState<TeacherDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTab, setViewTab] = useState<TeacherTab>('overview');
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editData, setEditData] = useState({ first_name: '', last_name: '', phone: '', avatar_url: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/teachers');
        const json = await res.json();
        if (res.ok) setTeachers(json.data || []);
      } catch (err) {
        console.error('Failed to fetch teachers:', err);
      }
      setLoading(false);
    })();
  }, []);

  const openViewPanel = async (teacherId: string) => {
    setViewLoading(true);
    setViewTeacher(null);
    setViewTab('overview');
    try {
      const res = await fetch(`/api/school/teachers/${teacherId}`);
      if (res.ok) {
        const json = await res.json();
        setViewTeacher(json);
      }
    } catch {}
    setViewLoading(false);
  };

  const handleStartEdit = (t: TeacherRow) => {
    setEditingTeacher(t);
    const parts = t.name.split(' ');
    const tRow = teachers.find(tc => tc.id === t.id);
    setEditData({
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      phone: t.phone === '—' ? '' : t.phone,
      avatar_url: '',
    });
  };

  const handleSaveTeacher = async () => {
    if (!editingTeacher) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/update-teacher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: editingTeacher.id,
          first_name: editData.first_name.trim(),
          last_name: editData.last_name.trim(),
          phone: editData.phone.trim() || null,
          avatar_url: editData.avatar_url.trim() || null,
        }),
      });
      const r = await res.json();
      if (!res.ok) {
        alert(r.error || 'Failed');
      } else {
        setTeachers(prev => prev.map(t => t.id !== editingTeacher.id ? t : {
          ...t,
          name: `${editData.first_name.trim()} ${editData.last_name.trim()}`,
          phone: editData.phone.trim() || '—',
        }));
        setEditingTeacher(null);
      }
    } catch {
      alert('Error updating.');
    }
    setSavingEdit(false);
  };

  const filtered = useMemo(() => {
    let r = teachers;
    if (filterRole) r = r.filter(t => t.displayRole === filterRole);
    if (filterStatus) r = r.filter(t => t.status === filterStatus);
    const q = search?.trim()?.toLowerCase();
    if (q) r = r.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.employeeId.toLowerCase().includes(q) || t.phone.includes(q));
    return r;
  }, [teachers, search, filterRole, filterStatus]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => { const s = (currentPage - 1) * pageSize; return filtered.slice(s, s + pageSize); }, [filtered, currentPage, pageSize]);
  useEffect(() => { setCurrentPage(1); }, [search, filterRole, filterStatus]);

  const classTeachers = teachers.filter(t => t.displayRole === 'Class Teacher').length;
  const subjectTeachers = teachers.filter(t => t.displayRole === 'Subject Teacher').length;
  const activeStaff = teachers.filter(t => t.status === 'Active').length;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="w-full max-w-7xl mx-auto">
      <PageHeader title="Teacher Management" description="Manage teacher records, assigned subjects, classes, roles, and workload." breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Teachers' }]} action={role === 'ADMIN' ? <button className="btn-primary text-xs px-4 py-2"><Users style={{ width: 14, height: 14 }} /> Add Teacher</button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '12px', marginBottom: '16px' }}>
        <StatCard label="Total Staff" value={teachers.length} sub={`${activeStaff} active`} icon={Users} />
        <StatCard label="Class Teachers" value={classTeachers} sub="Homeroom assigned" icon={UserCheck} iconBg="rgba(59,130,246,0.12)" iconColor="#3B82F6" />
        <StatCard label="Subject Teachers" value={subjectTeachers} sub="Specialist roles" icon={BookOpen} iconBg="rgba(139,92,246,0.12)" iconColor="#8B5CF6" />
        <StatCard label="Active Staff" value={activeStaff} sub={teachers.length > 0 ? `${Math.round(activeStaff / teachers.length * 100)}% of total` : ''} icon={GraduationCap} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center" style={{ gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)' }} />
          <input className="input-field" placeholder="Search by name, ID or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', height: '34px', fontSize: '0.75rem' }} />
        </div>
        <select className="input-field" value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ width: 'auto', minWidth: '130px', height: '34px', fontSize: '0.75rem' }}>
          <option value="">All Roles</option>
          <option value="Class Teacher">Class Teacher</option>
          <option value="Subject Teacher">Subject Teacher</option>
          <option value="Admin">Admin</option>
        </select>
        <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: '120px', height: '34px', fontSize: '0.75rem' }}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        {(search || filterRole || filterStatus) && <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); }} style={{ fontSize: '0.6875rem', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <InlineLoadingSkeleton rows={6} />
        ) : paginated.length === 0 ? (
          <EmptyState icon={<GraduationCap style={{ width: 24, height: 24 }} />} title="No teachers found" description={search || filterRole || filterStatus ? 'No teachers match your filters.' : 'No teachers have been added yet.'} />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Name</th><th>Teacher ID</th><th>Contact</th><th style={{ width: '90px' }}>Actions</th></tr></thead>
                <tbody>
                  {paginated.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.role === 'ADMIN' ? 'rgba(139,92,246,0.15)' : 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: t.role === 'ADMIN' ? '#8B5CF6' : 'var(--color-accent)', flexShrink: 0 }}>{getInitials(t.name)}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t.name}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}><StatusBadge status={t.displayRole} /></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t.employeeId}</td>
                      <td>
                        <div className="flex items-center gap-1" style={{ fontSize: '0.6875rem' }}><Phone style={{ width: 10, height: 10, color: 'var(--color-text-muted)' }} />{t.phone}</div>
                        <div className="flex items-center gap-1" style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '1px' }}><Mail style={{ width: 10, height: 10 }} />{t.email}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openViewPanel(t.id)} title="View Profile" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-accent)' }}><Eye style={{ width: 12, height: 12 }} /></button>
                          <button type="button" onClick={() => handleStartEdit(t)} title="Edit" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Pencil style={{ width: 12, height: 12 }} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden" style={{ padding: '8px' }}>
              {paginated.map(t => (
                <div key={t.id} style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '8px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-accent)' }}>{getInitials(t.name)}</div>
                      <div><div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t.name}</div><div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{t.employeeId}</div></div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openViewPanel(t.id)} className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 8px', flex: 1 }}>View</button>
                    <button onClick={() => handleStartEdit(t)} className="btn-secondary" style={{ fontSize: '0.625rem', padding: '4px 8px', flex: 1 }}>Edit</button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingTeacher(null)}>
          <div className="card w-full max-w-md" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '16px' }}>Edit Teacher</h2>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name</label><input className="input-field w-full text-xs" value={editData.first_name} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></div>
                <div className="flex-1"><label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name</label><input className="input-field w-full text-xs" value={editData.last_name} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></div>
              </div>
              <div><label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone</label><input className="input-field w-full text-xs" value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} /></div>
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
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary text-xs" onClick={() => setEditingTeacher(null)} disabled={savingEdit}>Cancel</button>
              <button type="button" className="btn-primary text-xs disabled:opacity-50" onClick={handleSaveTeacher} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Panel */}
      {viewTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setViewTeacher(null)}>
          <div className="card w-full max-w-2xl" style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                  {getInitials(`${viewTeacher.profile.first_name} ${viewTeacher.profile.last_name}`)}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {viewTeacher.profile.first_name} {viewTeacher.profile.last_name}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {viewTeacher.profile.email} &middot; {viewTeacher.profile.phone}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewTeacher(null)} style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X style={{ width: 14, height: 14 }} /></button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto' }}>
              {(['overview', 'subjects', 'classes', 'exams'] as TeacherTab[]).map(tab => (
                <button key={tab} onClick={() => setViewTab(tab)} style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', color: viewTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)', borderBottom: viewTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent' }}>{tab === 'overview' ? 'Overview' : tab === 'subjects' ? 'Subjects' : tab === 'classes' ? 'Classes' : 'Exams'}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)' }}>
              {viewLoading ? (
                <InlineLoadingSkeleton rows={4} />
              ) : viewTab === 'overview' ? (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-accent)' }}>{viewTeacher.stats.subjectCount}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>Subjects</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3B82F6' }}>{viewTeacher.stats.classCount}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>Classes</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F59E0B' }}>{viewTeacher.stats.examCount}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>Exams</div>
                    </div>
                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8B5CF6' }}>{viewTeacher.stats.markCount}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>Marks Entered</div>
                    </div>
                  </div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Related Tasks</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <a href="/dashboard/marks" style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <ClipboardList size={16} style={{ color: 'var(--color-accent)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Marks Entry — Record and manage student exam scores</span>
                      </div>
                    </a>
                    <a href="/dashboard/exams" style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <Calendar size={16} style={{ color: '#3B82F6' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Subject Allocation — Manage assigned subjects and classes</span>
                      </div>
                    </a>
                    <a href="/dashboard/reports" style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <FileText size={16} style={{ color: '#F59E0B' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Report Card Generation — Generate end-of-term reports</span>
                      </div>
                    </a>
                    <a href="/dashboard/attendance" style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <Users size={16} style={{ color: '#EF4444' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Attendance Supervision — Track and monitor student attendance</span>
                      </div>
                    </a>
                  </div>
                  <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600, background: viewTeacher.profile.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: viewTeacher.profile.is_active ? '#10B981' : '#EF4444' }}>{viewTeacher.profile.is_active ? 'Active' : 'Inactive'}</span>
                    <StatusBadge status={viewTeacher.profile.role === 'CLASS_TEACHER' ? 'Class Teacher' : viewTeacher.profile.role === 'SUBJECT_TEACHER' ? 'Subject Teacher' : 'Admin'} />
                  </div>
                </div>
              ) : viewTab === 'subjects' ? (
                <div>
                  {viewTeacher.subjectAssignments.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No subject assignments yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {viewTeacher.subjectAssignments.map((sa, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{sa.subject}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{sa.category} &middot; {sa.subject_code}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            <div>{sa.grade}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{sa.stream || 'All streams'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : viewTab === 'classes' ? (
                <div>
                  {viewTeacher.classAssignments.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No homeroom class assigned.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {viewTeacher.classAssignments.map(ca => (
                        <div key={ca.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{ca.stream}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ca.year}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {viewTeacher.recentExams.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>No exams created yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {viewTeacher.recentExams.map(ex => (
                        <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{ex.name}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{ex.subject} &middot; {ex.grade}</div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ex.date ? new Date(ex.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
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
