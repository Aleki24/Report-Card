"use client";

import React from 'react';
import { type UserRole } from '@/components/AuthProvider';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { type UserRow, type GradeStreamOption, type SubjectOption, type GradeOption, type ClassTeacherAssignment, isTeacherRole } from '@/hooks/useUsersPage';
import { SubjectTeacherFields } from './SubjectTeacherFields';
import { STAFF_JOB_TITLES } from '@/lib/staff-roles';

interface EditUserModalProps {
  editingUser: UserRow;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formError: string;
  submitting: boolean;
  editFirstName: string; setEditFirstName: (v: string) => void;
  editLastName: string; setEditLastName: (v: string) => void;
  editPhone: string; setEditPhone: (v: string) => void;
  editRole: UserRole; setEditRole: (v: UserRole) => void;
  editJobTitle: string; setEditJobTitle: (v: string) => void;
  editIsActive: boolean; setEditIsActive: (v: boolean) => void;
  editClassTeacherStreamId: string; setEditClassTeacherStreamId: (v: string) => void;
  editSubjectTeacherSubjects: {subject_id: string, grade_id: string}[];
  setEditSubjectTeacherSubjects: (v: {subject_id: string, grade_id: string}[]) => void;
  gradeStreams: GradeStreamOption[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  classTeacherAssignments: ClassTeacherAssignment[];
}

export function EditUserModal(props: EditUserModalProps) {
  const { editingUser, onClose, onSubmit, formError, submitting } = props;
  const assignedStreamIds = new Set(
    props.classTeacherAssignments.filter(a => a.user_id !== editingUser.id).map(a => a.current_grade_stream_id)
  );

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-6">Edit User & Assignments</h2>
      <form onSubmit={onSubmit}>
        {formError && <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{formError}</div>}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-xs text-muted-foreground mb-1">First Name *</label><input className="input-field w-full" value={props.editFirstName} onChange={e => props.setEditFirstName(e.target.value)} required /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Last Name *</label><input className="input-field w-full" value={props.editLastName} onChange={e => props.setEditLastName(e.target.value)} required /></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-xs text-muted-foreground mb-1">Phone Number</label><input className="input-field w-full" type="tel" value={props.editPhone} onChange={e => props.setEditPhone(e.target.value)} /></div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select className="input-field w-full" value={props.editIsActive ? 'true' : 'false'} onChange={e => props.setEditIsActive(e.target.value === 'true')}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1">Role *</label>
          <select
            className="input-field w-full"
            value={isTeacherRole(props.editRole) ? 'CLASS_TEACHER' : props.editRole}
            onChange={e => props.setEditRole(e.target.value as UserRole)}
            disabled={editingUser.role === 'STUDENT'}
          >
            <option value="CLASS_TEACHER">Teacher</option><option value="ADMIN">Admin</option>
            <option value="STAFF">Other Staff</option>
            {editingUser.role === 'STUDENT' && <option value="STUDENT">Student</option>}
          </select>
          {editingUser.role === 'STUDENT' && <p className="text-[10px] text-muted-foreground mt-1 opacity-70">Students must be managed separately.</p>}
        </div>

        {props.editRole === 'STAFF' && (
          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1">Staff Role / Title *</label>
            <select className="input-field w-full" value={props.editJobTitle} onChange={e => props.setEditJobTitle(e.target.value)} required>
              <option value="">-- Select --</option>
              {STAFF_JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {isTeacherRole(props.editRole) && (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Class Teacher Assignment (optional)</p>
            <div><label className="block text-xs text-muted-foreground mb-1">Class</label>
              <select className="input-field w-full" value={props.editClassTeacherStreamId} onChange={e => props.setEditClassTeacherStreamId(e.target.value)}>
                <option value="">-- Not a class teacher --</option>
                {props.gradeStreams.map(gs => (
                  <option key={gs.id} value={gs.id} disabled={assignedStreamIds.has(gs.id)}>
                    {gs.full_name}{assignedStreamIds.has(gs.id) ? ' (already has a class teacher)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isTeacherRole(props.editRole) && (
          <SubjectTeacherFields subjects={props.subjects} grades={props.grades} gradeStreams={props.gradeStreams} entries={props.editSubjectTeacherSubjects} setEntries={props.setEditSubjectTeacherSubjects} />
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={submitting}>{submitting ? '⏳ Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
