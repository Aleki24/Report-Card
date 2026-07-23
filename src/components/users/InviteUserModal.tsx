"use client";

import React from 'react';
import { type UserRole } from '@/components/AuthProvider';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { type GradeStreamOption, type AcademicLevelOption, type SubjectOption, type GradeOption, type ClassTeacherAssignment, isTeacherRole } from '@/hooks/useUsersPage';
import { SubjectTeacherFields } from './SubjectTeacherFields';

interface InviteUserModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formError: string;
  submitting: boolean;
  formFirstName: string; setFormFirstName: (v: string) => void;
  formLastName: string; setFormLastName: (v: string) => void;
  formPhone: string; setFormPhone: (v: string) => void;
  formRole: UserRole; setFormRole: (v: UserRole) => void;
  formSequenceNumber: number; setFormSequenceNumber: (v: number) => void;
  formAdmissionNumber: string; setFormAdmissionNumber: (v: string) => void;
  formGradeStreamId: string; setFormGradeStreamId: (v: string) => void;
  formAcademicLevelId: string; setFormAcademicLevelId: (v: string) => void;
  formClassTeacherStreamId: string; setFormClassTeacherStreamId: (v: string) => void;
  formSubjectTeacherSubjects: {subject_id: string, grade_id: string}[];
  setFormSubjectTeacherSubjects: (v: {subject_id: string, grade_id: string}[]) => void;
  gradeStreams: GradeStreamOption[];
  academicLevels: AcademicLevelOption[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  classTeacherAssignments: ClassTeacherAssignment[];
}

export function InviteUserModal(props: InviteUserModalProps) {
  const { onClose, onSubmit, formError, submitting } = props;
  const assignedStreamIds = new Set(props.classTeacherAssignments.map(a => a.current_grade_stream_id));

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">Add User</h2>
      <p className="text-xs text-muted-foreground mb-6">Add a phone number. The user will receive an invite code to set up their own account.</p>

      <form onSubmit={onSubmit}>
        {formError && <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{formError}</div>}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-xs text-muted-foreground mb-1">First Name *</label><input className="input-field w-full" value={props.formFirstName} onChange={e => props.setFormFirstName(e.target.value)} required /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Last Name *</label><input className="input-field w-full" value={props.formLastName} onChange={e => props.setFormLastName(e.target.value)} required /></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="block text-xs text-muted-foreground mb-1">Phone Number *</label><input className="input-field w-full" type="tel" value={props.formPhone} onChange={e => props.setFormPhone(e.target.value)} placeholder="e.g. 0712345678" required /></div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Sequence # *</label>
            <input className="input-field w-full" type="number" min="1" value={props.formSequenceNumber} onChange={e => props.setFormSequenceNumber(parseInt(e.target.value) || 1)} required />
            <p className="text-[10px] text-muted-foreground mt-1">Increment for same-name users</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1">Role *</label>
          <select className="input-field w-full" value={props.formRole} onChange={e => props.setFormRole(e.target.value as UserRole)}>
            <option value="CLASS_TEACHER">Teacher</option>
            <option value="STUDENT">Student</option><option value="ADMIN">Admin</option>
          </select>
        </div>

        {props.formRole === 'STUDENT' && (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Student Details</p>
            <div className="mb-4"><label className="block text-xs text-muted-foreground mb-1">Admission Number *</label><input className="input-field w-full" value={props.formAdmissionNumber} onChange={e => props.setFormAdmissionNumber(e.target.value)} placeholder="e.g. ADM-001" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Academic Level *</label>
                <select className="input-field w-full" value={props.formAcademicLevelId} onChange={e => props.setFormAcademicLevelId(e.target.value)} required>
                  <option value="">-- Select --</option>
                  {props.academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Class *</label>
                <select className="input-field w-full" value={props.formGradeStreamId} onChange={e => props.setFormGradeStreamId(e.target.value)} required>
                  <option value="">-- Select --</option>
                  {props.gradeStreams.filter(gs => !props.formAcademicLevelId || gs.grades?.academic_level_id === props.formAcademicLevelId).map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {isTeacherRole(props.formRole) && (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Class Teacher Assignment (optional)</p>
            <div><label className="block text-xs text-muted-foreground mb-1">Class</label>
              <select className="input-field w-full" value={props.formClassTeacherStreamId} onChange={e => props.setFormClassTeacherStreamId(e.target.value)}>
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

        {isTeacherRole(props.formRole) && (
          <SubjectTeacherFields subjects={props.subjects} grades={props.grades} gradeStreams={props.gradeStreams} entries={props.formSubjectTeacherSubjects} setEntries={props.setFormSubjectTeacherSubjects} />
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={submitting}>{submitting ? '⏳ Adding...' : 'Add User'}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
