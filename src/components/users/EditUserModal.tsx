"use client";

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const fullName = `${editingUser.first_name ?? ''} ${editingUser.last_name ?? ''}`.trim();

  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-xl" ariaLabel="Edit user">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Edit user &amp; assignments</h2>
          {fullName && <p className="mt-0.5 truncate text-sm text-muted-foreground">{fullName}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={onSubmit}>
        {formError && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field id="edit-first-name" label="First name" required>
            <input id="edit-first-name" className="input-field w-full" value={props.editFirstName} onChange={e => props.setEditFirstName(e.target.value)} required autoComplete="off" />
          </Field>
          <Field id="edit-last-name" label="Last name" required>
            <input id="edit-last-name" className="input-field w-full" value={props.editLastName} onChange={e => props.setEditLastName(e.target.value)} required autoComplete="off" />
          </Field>
          <Field id="edit-phone" label="Phone number">
            <input id="edit-phone" className="input-field w-full" type="tel" inputMode="tel" placeholder="e.g. 0712 345 678" value={props.editPhone} onChange={e => props.setEditPhone(e.target.value)} />
          </Field>
          <Field id="edit-status" label="Status">
            <select id="edit-status" className="input-field w-full" value={props.editIsActive ? 'true' : 'false'} onChange={e => props.setEditIsActive(e.target.value === 'true')}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
          <Field
            id="edit-role"
            label="Role"
            required
            className="sm:col-span-2"
            hint={editingUser.role === 'STUDENT' ? 'Students are managed from the People page.' : undefined}
          >
            <select
              id="edit-role"
              className="input-field w-full"
              value={isTeacherRole(props.editRole) ? 'CLASS_TEACHER' : props.editRole}
              onChange={e => props.setEditRole(e.target.value as UserRole)}
              disabled={editingUser.role === 'STUDENT'}
            >
              <option value="CLASS_TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Other staff</option>
              {editingUser.role === 'STUDENT' && <option value="STUDENT">Student</option>}
            </select>
          </Field>
          {props.editRole === 'STAFF' && (
            <Field id="edit-job-title" label="Staff role / title" required className="sm:col-span-2">
              <select id="edit-job-title" className="input-field w-full" value={props.editJobTitle} onChange={e => props.setEditJobTitle(e.target.value)} required>
                <option value="">Select a title</option>
                {STAFF_JOB_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}
        </div>

        {isTeacherRole(props.editRole) && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Class teacher <span className="font-normal normal-case">(optional)</span></p>
            <p className="mb-4 text-xs text-muted-foreground">A class teacher keeps the class register and its report cards.</p>
            <Field id="edit-class" label="Class">
              <select id="edit-class" className="input-field w-full" value={props.editClassTeacherStreamId} onChange={e => props.setEditClassTeacherStreamId(e.target.value)}>
                <option value="">Not a class teacher</option>
                {props.gradeStreams.map(gs => (
                  <option key={gs.id} value={gs.id} disabled={assignedStreamIds.has(gs.id)}>
                    {gs.full_name}{assignedStreamIds.has(gs.id) ? ' (already has a class teacher)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {isTeacherRole(props.editRole) && (
          <SubjectTeacherFields subjects={props.subjects} grades={props.grades} gradeStreams={props.gradeStreams} entries={props.editSubjectTeacherSubjects} setEntries={props.setEditSubjectTeacherSubjects} />
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary disabled:pointer-events-none disabled:opacity-50" disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, hint, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
