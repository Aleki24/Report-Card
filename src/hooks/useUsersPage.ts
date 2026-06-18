"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, type UserRole } from '@/components/AuthProvider';

export interface UserRow {
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

export interface GradeStreamOption { id: string; full_name: string; grade_id?: string; grades?: { academic_level_id: string; name_display: string } }
export interface AcademicLevelOption { id: string; code: string; name: string; }
export interface SubjectOption { id: string; name: string; }
export interface GradeOption { id: string; name_display: string; }

export function useUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite result state
  const [showInviteResult, setShowInviteResult] = useState(false);
  const [invitedUsername, setInvitedUsername] = useState('');
  const [invitedCode, setInvitedCode] = useState('');
  const [invitedName, setInvitedName] = useState('');

  // Filter, search, pagination state
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  // Password reset
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [showResetResult, setShowResetResult] = useState(false);
  const [resetResultInviteCode, setResetResultInviteCode] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  // Shared form state
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dropdown data
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);

  // Edit user form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('CLASS_TEACHER');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editClassTeacherStreamId, setEditClassTeacherStreamId] = useState('');
  const [editSubjectTeacherSubjects, setEditSubjectTeacherSubjects] = useState<{subject_id: string, grade_id: string}[]>([]);

  // Invite form state
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/data?type=users', { cache: 'no-store' });
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) { console.error('Failed to fetch users data:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [gsRes, structureRes] = await Promise.all([
        fetch('/api/school/data?type=grade_streams', { cache: 'no-store' }),
        fetch('/api/admin/academic-structure', { cache: 'no-store' }),
      ]);
      const [gsJson, structureJson] = await Promise.all([gsRes.json(), structureRes.json()]);
      if (gsRes.ok) setGradeStreams(gsJson.data || []);
      if (structureRes.ok) {
        setAcademicLevels(structureJson.academic_levels || []);
        setSubjects(structureJson.subjects || []);
        setGrades(structureJson.grades || []);
      }
    } catch (err) {
      console.error('Failed to load dropdown data', err);
    }
  }, []);

  useEffect(() => { if (showModal) fetchDropdowns(); }, [showModal, fetchDropdowns]);

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
    setFormError(''); setSubmitting(true);
    const payload: Record<string, any> = {
      first_name: formFirstName.trim(), last_name: formLastName.trim(), phone: formPhone.trim(),
      role: formRole, sequence_number: formSequenceNumber, school_id: profile?.school_id ?? undefined,
    };
    if (formRole === 'STUDENT') { payload.admission_number = formAdmissionNumber; payload.grade_stream_id = formGradeStreamId; payload.academic_level_id = formAcademicLevelId; }
    else if (formRole === 'CLASS_TEACHER') { 
      payload.class_teacher_grade_stream_id = formClassTeacherStreamId; 
      payload.subject_teacher_subjects = formSubjectTeacherSubjects.filter(s => s.subject_id && s.grade_id);
    }
    else if (formRole === 'SUBJECT_TEACHER') { payload.subject_teacher_subjects = formSubjectTeacherSubjects.filter(s => s.subject_id && s.grade_id); }
    try {
      const res = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Failed to add user'); }
      else {
        setInvitedUsername(data.credentials?.username ?? ''); setInvitedCode(data.credentials?.invite_code ?? '');
        setInvitedName(`${data.user?.first_name || ''} ${data.user?.last_name || ''}`);
        setShowModal(false); setShowInviteResult(true); fetchData(); resetForm();
      }
    } catch { setFormError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const resetUserPassword = async (user: UserRow) => {
    if (!confirm(`Reset password for ${user.first_name} ${user.last_name}?`)) return;
    setResettingPasswordId(user.id);
    try {
      const res = await fetch('/api/admin/reset-user-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to reset password'); }
      else { setResetResultInviteCode(data.password); setShowResetResult(true); fetchData(); }
    } catch { alert('Network error'); }
    finally { setResettingPasswordId(null); }
  };

  const handleEditClick = async (user: UserRow) => {
    setEditingUser(user); setEditFirstName(user.first_name); setEditLastName(user.last_name);
    setEditPhone(user.phone || ''); setEditRole(user.role); setEditIsActive(user.is_active);
    setEditClassTeacherStreamId(''); setEditSubjectTeacherSubjects([]);
    try { await fetchDropdowns(); } catch (err) { console.error('Failed to load dropdowns', err); }
    setShowEditModal(true); setFormError('');
    if (user.role === 'CLASS_TEACHER' || user.role === 'SUBJECT_TEACHER') {
      try {
        const res = await fetch(`/api/admin/user-assignments?user_id=${user.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (res.ok) {
          if (data.class_teacher) setEditClassTeacherStreamId(data.class_teacher.grade_stream_id);
          if (data.subject_assignments?.length > 0) setEditSubjectTeacherSubjects(data.subject_assignments.map((a: any) => ({ subject_id: a.subject_id, grade_id: a.grade_id })));
          else if (user.role === 'SUBJECT_TEACHER' || user.role === 'CLASS_TEACHER') setEditSubjectTeacherSubjects([{ subject_id: '', grade_id: '' }]);
        }
      } catch (err) { console.error('Failed to fetch assignments', err); }
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(''); setSubmitting(true);
    const payload: Record<string, any> = { user_id: editingUser.id, first_name: editFirstName.trim(), last_name: editLastName.trim(), phone: editPhone.trim(), role: editRole, is_active: editIsActive };
    if (editRole === 'CLASS_TEACHER') { 
      payload.class_teacher_grade_stream_id = editClassTeacherStreamId; 
      payload.subject_teacher_subjects = editSubjectTeacherSubjects.filter(s => s.subject_id && s.grade_id);
    }
    else if (editRole === 'SUBJECT_TEACHER') { payload.subject_teacher_subjects = editSubjectTeacherSubjects.filter(s => s.subject_id && s.grade_id); payload.class_teacher_grade_stream_id = null; }
    try {
      const res = await fetch('/api/admin/update-user', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Failed to update user'); }
      else { setShowEditModal(false); fetchData(); }
    } catch { setFormError('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  useEffect(() => { setCurrentPage(1); }, [users.length, roleFilter, searchQuery]);

  const { paginatedUsers, totalPages, filteredUsers } = useMemo(() => {
    let filtered = users;
    if (roleFilter !== 'ALL') filtered = filtered.filter(u => u.role === roleFilter);
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

  return {
    // Data
    users, loading, paginatedUsers, totalPages, filteredUsers,
    // Filter / search / pagination
    roleFilter, setRoleFilter, searchQuery, setSearchQuery, currentPage, setCurrentPage, usersPerPage,
    // Invite modal
    showModal, setShowModal, resetForm, handleInviteUser,
    formFirstName, setFormFirstName, formLastName, setFormLastName, formPhone, setFormPhone,
    formRole, setFormRole, formSequenceNumber, setFormSequenceNumber,
    formAdmissionNumber, setFormAdmissionNumber, formGradeStreamId, setFormGradeStreamId,
    formAcademicLevelId, setFormAcademicLevelId, formClassTeacherStreamId, setFormClassTeacherStreamId,
    formSubjectTeacherSubjects, setFormSubjectTeacherSubjects,
    // Edit modal
    showEditModal, setShowEditModal, editingUser, handleEditClick, handleUpdateUser,
    editFirstName, setEditFirstName, editLastName, setEditLastName, editPhone, setEditPhone,
    editRole, setEditRole, editIsActive, setEditIsActive,
    editClassTeacherStreamId, setEditClassTeacherStreamId, editSubjectTeacherSubjects, setEditSubjectTeacherSubjects,
    // Invite result
    showInviteResult, setShowInviteResult, invitedUsername, invitedCode, invitedName,
    // Password reset
    resetUserPassword, resettingPasswordId, showResetResult, setShowResetResult, resetResultInviteCode,
    // Shared
    formError, submitting, gradeStreams, academicLevels, subjects, grades,
  };
}
