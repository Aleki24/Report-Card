"use client";

import React, { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useAuth, type UserRole } from '@/components/AuthProvider';

interface UserRow {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
}

interface PendingInvite {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: UserRole;
    invite_code: string;
    created_at: string;
}

interface GradeStreamOption { id: string; full_name: string; }
interface AcademicLevelOption { id: string; code: string; name: string; }

export default function UsersPage() {
    const supabase = createSupabaseBrowserClient();
    const { profile } = useAuth();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showInviteResult, setShowInviteResult] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [invitedName, setInvitedName] = useState('');
    const [invitedPhone, setInvitedPhone] = useState('');

    // Form state
    const [formFirstName, setFormFirstName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formRole, setFormRole] = useState<UserRole>('CLASS_TEACHER');

    // Student-specific
    const [formAdmissionNumber, setFormAdmissionNumber] = useState('');
    const [formGradeStreamId, setFormGradeStreamId] = useState('');
    const [formAcademicLevelId, setFormAcademicLevelId] = useState('');

    // Dropdown data
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);

    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        const [usersRes, invitesRes] = await Promise.all([
            supabase
                .from('users')
                .select('id, first_name, last_name, email, phone, role, is_active, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('pending_invites')
                .select('id, first_name, last_name, phone, role, invite_code, created_at')
                .order('created_at', { ascending: false }),
        ]);

        if (usersRes.error) console.error('Users fetch error:', usersRes.error);
        if (invitesRes.error) console.error('Invites fetch error:', invitesRes.error);

        setUsers((usersRes.data as UserRow[]) || []);
        setPendingInvites((invitesRes.data as PendingInvite[]) || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch student-specific dropdowns when modal opens
    useEffect(() => {
        if (showModal && formRole === 'STUDENT') {
            const fetchDropdowns = async () => {
                const [gsRes, alRes] = await Promise.all([
                    supabase.from('grade_streams').select('id, full_name').order('full_name'),
                    supabase.from('academic_levels').select('id, code, name').order('code'),
                ]);
                setGradeStreams(gsRes.data || []);
                setAcademicLevels(alRes.data || []);
            };
            fetchDropdowns();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, formRole]);

    const resetForm = () => {
        setFormFirstName(''); setFormLastName(''); setFormPhone('');
        setFormRole('CLASS_TEACHER');
        setFormAdmissionNumber(''); setFormGradeStreamId(''); setFormAcademicLevelId('');
        setFormError('');
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        let schoolId = profile?.school_id;
        if (!schoolId) {
            // JWT may be stale — look up school_id from the DB
            const { data: userData } = await supabase.from('users').select('school_id').eq('id', profile?.id ?? '').single();
            schoolId = userData?.school_id;
        }
        if (!schoolId) {
            setFormError('You must create a school first. Go to Settings → School Profile.');
            setSubmitting(false);
            return;
        }

        const payload: Record<string, string | undefined> = {
            first_name: formFirstName.trim(),
            last_name: formLastName.trim(),
            phone: formPhone.trim(),
            role: formRole,
            school_id: schoolId,
        };

        if (formRole === 'STUDENT') {
            payload.admission_number = formAdmissionNumber;
            payload.grade_stream_id = formGradeStreamId;
            payload.academic_level_id = formAcademicLevelId;
        }

        try {
            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                setFormError(data.error || 'Failed to invite user');
            } else {
                // Show invite result
                setInviteCode(data.invite_code);
                setInvitedName(`${data.user.first_name} ${data.user.last_name}`);
                setInvitedPhone(data.user.phone);
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

    return (
        <div className="w-full max-w-7xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">User Management</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Invite teachers and students by phone number
                    </p>
                </div>
                <button className="btn-primary shrink-0" onClick={() => { resetForm(); setShowModal(true); }}>
                    + Invite User
                </button>
            </div>

            {/* Pending Invites Section */}
            {pendingInvites.length > 0 && (
                <div className="card overflow-hidden mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">📨</span>
                        <h3 className="font-bold text-base font-[family-name:var(--font-display)]">
                            Pending Invites ({pendingInvites.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="data-table w-full sm:whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Role</th>
                                    <th>Invite Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingInvites.map(inv => (
                                    <tr key={inv.id}>
                                        <td data-label="Name" className="font-medium">{inv.first_name} {inv.last_name}</td>
                                        <td data-label="Phone" className="text-[var(--color-text-muted)] text-sm">{inv.phone}</td>
                                        <td data-label="Role">
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${roleBadgeColors[inv.role]}20`,
                                                    color: roleBadgeColors[inv.role],
                                                    border: `1px solid ${roleBadgeColors[inv.role]}40`,
                                                }}
                                            >
                                                {inv.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td data-label="Invite Code">
                                            <span style={{
                                                fontFamily: 'var(--font-mono, monospace)',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: 'var(--color-accent)',
                                                letterSpacing: '0.1em',
                                            }}>
                                                {inv.invite_code}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Active Users Table */}
            <div className="card overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">👥</span>
                    <h3 className="font-bold text-base font-[family-name:var(--font-display)]">
                        Active Users ({users.length})
                    </h3>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-[var(--color-text-muted)]">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center text-[var(--color-text-muted)]">
                        <div className="text-4xl mb-4">👤</div>
                        <p>No users yet. Click &quot;Invite User&quot; to add your first team member.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table w-full sm:whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td data-label="Name" className="font-medium">{u.first_name} {u.last_name}</td>
                                        <td data-label="Phone" className="text-[var(--color-text-muted)] text-sm">{u.phone || '—'}</td>
                                        <td data-label="Email" className="text-[var(--color-text-muted)] text-sm">{u.email || '—'}</td>
                                        <td data-label="Role">
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${roleBadgeColors[u.role]}20`,
                                                    color: roleBadgeColors[u.role],
                                                    border: `1px solid ${roleBadgeColors[u.role]}40`,
                                                }}
                                            >
                                                {u.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td data-label="Status">
                                            <span className={`badge ${u.is_active ? 'badge-success' : ''}`} style={!u.is_active ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' } : {}}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Invite User Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { setShowModal(false); resetForm(); }}
                >
                    <div
                        className="card w-full max-w-lg"
                        style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">Invite User</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mb-6">Add a phone number. The user will receive an invite code to set up their own account.</p>

                        <form onSubmit={handleInviteUser}>
                            {formError && (
                                <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">
                                    {formError}
                                </div>
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

                            <div className="mb-4">
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone Number *</label>
                                <input className="input-field w-full" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="e.g. 0712345678" required />
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

                            {/* Student-specific fields */}
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
                                                {academicLevels.map(al => (
                                                    <option key={al.id} value={al.id}>{al.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade Stream *</label>
                                            <select className="input-field w-full" value={formGradeStreamId} onChange={e => setFormGradeStreamId(e.target.value)} required>
                                                <option value="">-- Select --</option>
                                                {gradeStreams.map(gs => (
                                                    <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
                                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }} disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary disabled:opacity-50" disabled={submitting}>
                                    {submitting ? '⏳ Inviting...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite Success Modal — Shows the invite code */}
            {showInviteResult && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowInviteResult(false)}
                >
                    <div
                        className="card w-full max-w-md text-center"
                        style={{ animation: 'fadeIn .2s ease' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-5xl mb-4">✅</div>
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">User Invited!</h2>
                        <p className="text-sm text-[var(--color-text-muted)] mb-6">
                            Share this invite code with <strong>{invitedName}</strong> ({invitedPhone})
                        </p>

                        <div style={{
                            background: 'var(--color-surface-raised)',
                            border: '2px dashed var(--color-accent)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-6)',
                            marginBottom: 'var(--space-6)',
                        }}>
                            <div className="text-xs text-[var(--color-text-muted)] mb-2">INVITE CODE</div>
                            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.15em', color: 'var(--color-accent)' }}>
                                {inviteCode}
                            </div>
                        </div>

                        <p className="text-xs text-[var(--color-text-muted)] mb-6">
                            The user should visit <strong>/register</strong> and enter their phone number + this code to set up their account.
                        </p>

                        <button className="btn-primary w-full" onClick={() => setShowInviteResult(false)}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
