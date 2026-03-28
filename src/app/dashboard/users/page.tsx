"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, type UserRole } from '@/components/AuthProvider';

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  username: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  plain_password?: string | null;
  admission_number?: string | null;
}

interface GradeStreamOption { id: string; full_name: string; grade_id?: string; grades?: { academic_level_id: string; name_display: string } }
interface AcademicLevelOption { id: string; code: string; name: string; }
interface SubjectOption { id: string; name: string; }
interface GradeOption { id: string; name_display: string; }

export default function UsersPage() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInviteResult, setShowInviteResult] = useState(false);
  const [invitedUsername, setInvitedUsername] = useState('');
  const [invitedPassword, setInvitedPassword] = useState('');
  const [invitedName, setInvitedName] = useState('');

  // Filter and search state
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  // Password reset state
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [showResetResult, setShowResetResult] = useState(false);
  const [resetResultPassword, setResetResultPassword] = useState('');

  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('CLASS_TEACHER');
  const [formSequenceNumber, setFormSequenceNumber] = useState<number>(1);

  const [formAdmissionNumber, setFormAdmissionNumber] = useState('');
  const [formGradeStreamId, setFormGradeStreamId] = useState('');
  const [formAcademicLevelId, setFormAcademicLevelId] = useState('');
  
  const [formClassTeacherStreamId, setFormClassTeacherStreamId] = useState('');
  const [formSubjectTeacherSubjects, setFormSubjectTeacherSubjects] = useState<{subject_id: string, grade_id: string}[]>([{ subject_id: '', grade_id: '' }]);

  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch users via server API (school-scoped) ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/data?type=users');
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      console.error('Failed to fetch users data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Fetch dropdowns for invite form ─────────────────
  useEffect(() => {
    if (showModal) {
      const fetchDropdowns = async () => {
        const [gsRes, structureRes] = await Promise.all([
          fetch('/api/school/data?type=grade_streams', { cache: 'no-store' }),
          fetch('/api/admin/academic-structure', { cache: 'no-store' }),
        ]);
        const [gsJson, structureJson] = await Promise.all([
          gsRes.json(),
          structureRes.json(),
        ]);
        setGradeStreams(gsJson.data || []);
        setAcademicLevels(structureJson.academic_levels || []);
        setSubjects(structureJson.subjects || []);
        setGrades(structureJson.grades || []);
      };
      fetchDropdowns();
    }
  }, [showModal]);

  const resetForm = () => {
    setFormFirstName(''); setFormLastName(''); setFormPhone('');
    setFormRole('CLASS_TEACHER'); setFormSequenceNumber(1);
    setFormAdmissionNumber(''); setFormGradeStreamId(''); setFormAcademicLevelId('');
    setFormClassTeacherStreamId('');
    setFormSubjectTeacherSubjects([{ subject_id: '', grade_id: '' }]);
    setFormError('');
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    // school_id is resolved server-side from the session in /api/admin/create-user
    const payload: Record<string, any> = {
      first_name: formFirstName.trim(),
      last_name: formLastName.trim(),
      phone: formPhone.trim(),
      role: formRole,
      sequence_number: formSequenceNumber,
      school_id: profile?.school_id ?? undefined,
    };

    if (formRole === 'STUDENT') {
      payload.admission_number = formAdmissionNumber;
      payload.grade_stream_id = formGradeStreamId;
      payload.academic_level_id = formAcademicLevelId;
    } else if (formRole === 'CLASS_TEACHER') {
      payload.class_teacher_grade_stream_id = formClassTeacherStreamId;
    } else if (formRole === 'SUBJECT_TEACHER') {
      payload.subject_teacher_subjects = formSubjectTeacherSubjects.filter(s => s.subject_id && s.grade_id);
    }

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to add user');
      } else {
        setInvitedUsername(data.credentials?.username ?? '');
        setInvitedPassword(data.credentials?.raw_password ?? '');
        setInvitedName(`${data.user?.first_name || ''} ${data.user?.last_name || ''}`);
        setShowModal(false);
        setShowInviteResult(true);
        fetchData();
        resetForm();
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STUDENT: '#10B981',
  };

  // Reset password handler
  const resetUserPassword = async (user: UserRow) => {
    if (!confirm(`Reset password for ${user.first_name} ${user.last_name}?`)) return;
    setResettingPasswordId(user.id);
    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to reset password');
      } else {
        setResetResultPassword(data.password);
        setShowResetResult(true);
        fetchData();
      }
    } catch {
      alert('Network error');
    } finally {
      setResettingPasswordId(null);
    }
  };

  // Reset to page 1 when users list changes (for simplicity)
  useEffect(() => {
    setCurrentPage(1);
  }, [users.length, roleFilter, searchQuery]);

  // Compute filtered and paginated users
  const { paginatedUsers, totalPages, filteredUsers } = useMemo(() => {
    let filtered = users;
    
    // Apply role filter
    if (roleFilter !== 'ALL') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.phone && u.phone.includes(query)) ||
        u.admission_number?.toLowerCase().includes(query)
      );
    }
    
    const total = Math.ceil(filtered.length / usersPerPage);
    const paginated = filtered.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);
    return { paginatedUsers: paginated, totalPages: total, filteredUsers: filtered };
  }, [users, currentPage, usersPerPage, roleFilter, searchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">User Management</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Add teachers and students by phone number</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      {/* Guide */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1 text-[var(--color-primary)]">How your users log in:</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90 text-[var(--color-text)]">
            <li><strong>Admins & Principals:</strong> Must log in using their <strong>Email Address</strong>.</li>
            <li><strong>Teachers & Students:</strong> Must log in using their unique auto-generated <strong>Username</strong> (listed in the table below).</li>
            <li><strong>Default Passwords:</strong> Users created before the recent update have the default password <strong>password123</strong>. New users will be assigned an exact password shown to you at creation time.</li>
            <li><strong>Creating Users:</strong> Click <strong>+ Add User</strong>. After providing their details, the system will instantly generate a username and password for them. Simply share those details so they can log in!</li>
          </ul>
        </div>
      </div>

      {/* Active Users */}
      <div className="card overflow-hidden">
        {/* Filter Tabs and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <h3 className="font-bold text-base font-[family-name:var(--font-display)]">Active Users ({filteredUsers.length})</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input - visible on mobile */}
            <div className="relative">
              <input
                type="text"
                className="input-field w-full sm:w-64 pl-9"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Role Filter Tabs - hidden on very small screens, shown as scrollable on mobile */}
        <div className="flex overflow-x-auto pb-2 mb-4 -mx-2 px-2 gap-1">
          {(['ALL', 'ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                roleFilter === role
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
              }`}
            >
              {role === 'ALL' ? 'All' : role.replace('_', ' ')}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="p-12 text-center text-[var(--color-text-muted)]">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-text-muted)]">
            <img src="https://em-content.zobj.net/source/apple/354/bust-in-silhouette_1f464.png" alt="User" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <p>No users yet. Click &quot;Add User&quot; to add your first team member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full sm:whitespace-nowrap">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Username</th><th>Password</th><th>Role</th><th>Joined</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {paginatedUsers.map(u => (
                  <tr key={u.id}>
                    <td data-label="Name" className="font-medium">{u.first_name} {u.last_name}</td>
                    <td data-label="Email" className="text-[var(--color-text-muted)] text-sm">{u.email || '—'}</td>
                    <td data-label="Username" className="text-[var(--color-text-muted)] text-sm">{u.username || '—'}</td>
                    <td data-label="Password" className="text-[var(--color-text-muted)] text-sm font-mono">{u.plain_password || '—'}</td>
                    <td data-label="Role">
                      <span className="badge" style={{ background: `${roleBadgeColors[u.role]}20`, color: roleBadgeColors[u.role], border: `1px solid ${roleBadgeColors[u.role]}40` }}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td data-label="Joined" className="text-[var(--color-text-muted)] text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${u.is_active ? 'badge-success' : ''}`} style={!u.is_active ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' } : {}}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => resetUserPassword(u)} 
                          disabled={resettingPasswordId === u.id}
                          className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition disabled:opacity-50"
                          title="Reset Password"
                        >
                          {resettingPasswordId === u.id ? '...' : '🔑'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t border-[var(--color-border)]">
                <div className="text-sm text-[var(--color-text-muted)]">
                  Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-50" style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)} className="px-3 py-1.5 text-sm rounded-lg border transition" style={{ backgroundColor: currentPage === page ? 'var(--color-accent)' : 'var(--color-surface-raised)', borderColor: currentPage === page ? 'var(--color-accent)' : 'var(--color-border)', color: currentPage === page ? '#fff' : 'var(--color-text-secondary)' }}>
                      {page}
                    </button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-50" style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="card w-full max-w-lg" style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">Add User</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">Add a phone number. The user will receive an invite code to set up their own account.</p>

            <form onSubmit={handleInviteUser}>
              {formError && (
                <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">First Name *</label>
                  <input className="input-field w-full" value={formFirstName} onChange={e => setFormFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Last Name *</label>
                  <input className="input-field w-full" value={formLastName} onChange={e => setFormLastName(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone Number *</label>
                  <input className="input-field w-full" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="e.g. 0712345678" required />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Sequence # *</label>
                  <input className="input-field w-full" type="number" min="1" value={formSequenceNumber} onChange={e => setFormSequenceNumber(parseInt(e.target.value) || 1)} required />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Increment for same-name users</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Role *</label>
                <select className="input-field w-full" value={formRole} onChange={e => setFormRole(e.target.value as UserRole)}>
                  <option value="CLASS_TEACHER">Class Teacher</option>
                  <option value="SUBJECT_TEACHER">Subject Teacher</option>
                  <option value="STUDENT">Student</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {formRole === 'STUDENT' && (
                <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">Student Details</p>
                  <div className="mb-4">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Admission Number *</label>
                    <input className="input-field w-full" value={formAdmissionNumber} onChange={e => setFormAdmissionNumber(e.target.value)} placeholder="e.g. ADM-001" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Academic Level *</label>
                      <select className="input-field w-full" value={formAcademicLevelId} onChange={e => setFormAcademicLevelId(e.target.value)} required>
                        <option value="">-- Select --</option>
                        {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class (Optional)</label>
                      <select className="input-field w-full" value={formGradeStreamId} onChange={e => setFormGradeStreamId(e.target.value)}>
                        <option value="">-- Select --</option>
                        {gradeStreams
                           .filter(gs => !formAcademicLevelId || gs.grades?.academic_level_id === formAcademicLevelId)
                           .map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {formRole === 'CLASS_TEACHER' && (
                <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">Class Teacher Assignment</p>
                  <div>
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class</label>
                    <select className="input-field w-full" value={formClassTeacherStreamId} onChange={e => setFormClassTeacherStreamId(e.target.value)}>
                      <option value="">-- Unassigned --</option>
                      {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {formRole === 'SUBJECT_TEACHER' && (
                <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">Subject Teacher Assignment</p>
                  {formSubjectTeacherSubjects.map((st, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                       <div className="flex-1">
                          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Subject</label>
                          <select className="input-field w-full py-1 text-sm" value={st.subject_id} onChange={e => {
                             const newSubj = [...formSubjectTeacherSubjects];
                             newSubj[i].subject_id = e.target.value;
                             setFormSubjectTeacherSubjects(newSubj);
                          }}>
                            <option value="">-- Subject --</option>
                            {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                          </select>
                       </div>
                       <div className="flex-1">
                          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Grade Level</label>
                          <select className="input-field w-full py-1 text-sm" value={st.grade_id} onChange={e => {
                             const newSubj = [...formSubjectTeacherSubjects];
                             newSubj[i].grade_id = e.target.value;
                             setFormSubjectTeacherSubjects(newSubj);
                          }}>
                            <option value="">-- Grade --</option>
                             {grades
                               .filter(g => gradeStreams.some(gs => gs.grade_id === g.id))
                               .map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
                          </select>
                       </div>
                       <button
                          type="button"
                          onClick={() => setFormSubjectTeacherSubjects(formSubjectTeacherSubjects.filter((_, idx) => idx !== i))}
                          className="mt-6 text-red-500 hover:text-red-400 p-1"
                       >
                         &times;
                       </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormSubjectTeacherSubjects([...formSubjectTeacherSubjects, { subject_id: '', grade_id: '' }])} className="text-xs text-[var(--color-accent)] hover:underline mt-1">
                    + Add Subject
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary disabled:opacity-50" disabled={submitting}>
                  {submitting ? '⏳ Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Success Modal */}
      {showInviteResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowInviteResult(false)}>
          <div className="card w-full max-w-md text-center" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <img src="https://em-content.zobj.net/source/apple/354/check-mark-button_2705.png" alt="Success" className="mb-4" style={{ width: 64, height: 64, objectFit: 'contain' }} />
            <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">User Added!</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              Please provide these login details to <strong>{invitedName}</strong>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
              <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div className="text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Username</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-accent)' }}>{invitedUsername}</div>
              </div>
              <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div className="text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Password</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{invitedPassword}</div>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              The user can log in immediately at <strong>/login</strong>. It's recommended they update their password after their first login.
            </p>
            <button className="btn-primary w-full" onClick={() => setShowInviteResult(false)}>Done</button>
          </div>
        </div>
      )}

      {/* Reset Password Result Modal */}
      {showResetResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowResetResult(false)}>
          <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
                <span className="text-3xl">🔑</span>
              </div>
              <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">Password Reset</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                New password for this user:
              </p>
              <div className="bg-[var(--color-surface-raised)] border rounded-lg p-4 mb-4">
                <code className="text-xl font-mono font-bold" style={{ color: 'var(--color-success)' }}>{resetResultPassword}</code>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Share this password with the user securely.
              </p>
              <button onClick={() => setShowResetResult(false)} className="btn-primary w-full">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
