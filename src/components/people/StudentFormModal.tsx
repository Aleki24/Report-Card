"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { FormGrid, FormField, InputField, SelectField, Modal } from '@/components/ui';
import { pathwayLabel } from '@/lib/pathway-definitions';
import { CLASS_REQUIRED_MESSAGE } from '@/lib/classes';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { StudentStatus } from '@/types';
import type { AcademicLevelOption, CombinationOption, CreatedCredential, GradeStreamOption, StudentRow } from './peopleTypes';
import { errorMessage } from './peopleTypes';

const GENDER_OPTIONS = [
  { id: 'MALE', label: 'Male' },
  { id: 'FEMALE', label: 'Female' },
];

const STATUS_OPTIONS: readonly { id: StudentStatus; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'TRANSFERRED', label: 'Transferred' },
  { id: 'GRADUATED', label: 'Graduated' },
  { id: 'DEACTIVATED', label: 'Deactivated' },
];

const EMPTY_FORM = { status: 'ACTIVE' as StudentStatus, first_name: '', last_name: '', admission_number: '', gender: '', date_of_birth: '', guardian_name: '', guardian_phone: '', grade_stream_id: '', academic_level_id: '', pathway: '', track: '', subject_combination_id: '' };
type StudentForm = typeof EMPTY_FORM;

function formFor(s: StudentRow | null): StudentForm {
  if (!s) return { ...EMPTY_FORM };
  return {
    status: STATUS_OPTIONS.find(o => o.id === s.status)?.id ?? 'ACTIVE',
    first_name: s.users?.first_name ?? '', last_name: s.users?.last_name ?? '', admission_number: s.admission_number ?? '',
    gender: s.gender ?? '', date_of_birth: s.date_of_birth ?? '', guardian_name: s.guardian_name ?? '', guardian_phone: s.guardian_phone ?? '',
    grade_stream_id: s.current_grade_stream_id ?? '', academic_level_id: '', pathway: s.pathway ?? '', track: s.track ?? '', subject_combination_id: s.subject_combination_id ?? '',
  };
}

/** Why the form can't be saved yet, or null when it can. */
function formProblem(f: StudentForm): string | null {
  // The common mistake of typing the phone number into Guardian Name, caught
  // here so it doesn't silently break SMS later.
  const name = f.guardian_name.trim();
  if (name && /^[\d\s\-+()]+$/.test(name) && name.replace(/\D/g, '').length >= 7) {
    return 'Guardian name looks like a phone number — put the number in Guardian phone instead.';
  }
  // Only a student who has left may be without a class.
  if (!f.grade_stream_id && f.status === 'ACTIVE') return CLASS_REQUIRED_MESSAGE;
  const digits = f.guardian_phone.replace(/\D/g, '');
  if (f.guardian_phone.trim() && (digits.length < 9 || digits.length > 12)) {
    return "Guardian phone doesn't look right. Use a format like 0712345678.";
  }
  return null;
}

interface StudentFormModalProps {
  /** The student being edited, `null` to add one; the modal is closed when `open` is false. */
  student: StudentRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (created: CreatedCredential | null) => void;
  gradeStreams: GradeStreamOption[];
  academicLevels: AcademicLevelOption[];
  combinations: CombinationOption[];
  seniorStreamIds: ReadonlySet<string>;
  /** A class's curriculum (academic level), through its grade. */
  curriculumOfClass: (streamId: string) => string | undefined;
}

export function StudentFormModal(props: StudentFormModalProps) {
  // Remounted per student (see the key), so the form starts from their details.
  return props.open ? <StudentForm key={props.student?.id ?? 'new'} {...props} /> : null;
}

function StudentForm({ student, onClose, onSaved, gradeStreams, academicLevels, combinations, seniorStreamIds, curriculumOfClass }: StudentFormModalProps) {
  const [form, setForm] = useState<StudentForm>(() => formFor(student));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StudentForm>(key: K, value: StudentForm[K]) => setForm(p => ({ ...p, [key]: value }));
  const editing = student !== null;

  const save = async () => {
    const problem = formProblem(form);
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const res = await fetch(editing ? '/api/admin/update-student' : '/api/admin/add-student', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, student_id: student.id } : { ...form, status: undefined }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, editing ? 'Could not save the student.' : 'Could not add the student.'));
      toast.success(editing ? 'Student updated' : 'Student added');
      const created = json as { invite_code?: string; username?: string } | null;
      onSaved(!editing && created?.invite_code && created.username
        ? { first_name: form.first_name, last_name: form.last_name, username: created.username, invite_code: created.invite_code }
        : null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const showPathway = combinations.length > 0 && seniorStreamIds.has(form.grade_stream_id);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? 'Edit student' : 'Add student'}
      size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add student'}
        </button>
      </>}
    >
      <FormGrid>
        <FormField label="First name" span="half" required><InputField value={form.first_name} autoComplete="off" onChange={e => set('first_name', e.target.value)} /></FormField>
        <FormField label="Last name" span="half" required><InputField value={form.last_name} autoComplete="off" onChange={e => set('last_name', e.target.value)} /></FormField>
        <FormField label="Class" span="half" required={form.status === 'ACTIVE'} hint={gradeStreams.length === 0 ? 'No classes yet — add them on the Classes page first.' : undefined}>
          <SelectField
            placeholder="Choose a class"
            value={form.grade_stream_id}
            // The class decides the curriculum, so pick it for the admin.
            onChange={v => setForm(p => ({ ...p, grade_stream_id: v, academic_level_id: curriculumOfClass(v) ?? p.academic_level_id }))}
            options={gradeStreams.map(gs => ({ id: gs.id, label: gs.full_name }))}
          />
        </FormField>
        <FormField label="Admission no." span="half" hint="Leave empty if the school has not assigned one yet."><InputField placeholder="Optional" value={form.admission_number} onChange={e => set('admission_number', e.target.value)} /></FormField>
        <FormField label="Gender" span="half"><SelectField placeholder="—" value={form.gender} onChange={v => set('gender', v)} options={GENDER_OPTIONS} /></FormField>
        <FormField label="Date of birth" span="half"><InputField type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></FormField>
        <FormField label="Curriculum" span={editing ? 'half' : 'full'}><SelectField placeholder="—" value={form.academic_level_id} onChange={v => set('academic_level_id', v)} options={academicLevels.map(al => ({ id: al.id, label: al.name }))} /></FormField>
        {editing && (
          <FormField label="Status" span="half" hint={form.status === 'ACTIVE' ? undefined : 'Keeps their records; they drop off class lists.'}>
            <SelectField placeholder={null} value={form.status} onChange={v => set('status', STATUS_OPTIONS.find(o => o.id === v)?.id ?? 'ACTIVE')} options={STATUS_OPTIONS} />
          </FormField>
        )}

        <div className="col-span-full mt-1 border-t border-border/70 pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Guardian</p>
        </div>
        <FormField label="Guardian name" span="half"><InputField value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} /></FormField>
        <FormField label="Guardian phone" span="half" hint="Used for SMS results and absence alerts."><InputField type="tel" inputMode="tel" placeholder="0712345678" value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} /></FormField>

        {showPathway && (
          <>
            <div className="col-span-full mt-1 border-t border-border/70 pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Senior School pathway (Grades 10–12)</p>
            </div>
            <FormField label="Subject combination" span="half">
              <SelectField
                placeholder="— None —"
                value={form.subject_combination_id}
                onChange={v => {
                  const combo = combinations.find(c => c.id === v);
                  setForm(p => ({ ...p, subject_combination_id: v, pathway: combo?.pathway ?? '', track: combo?.track ?? '' }));
                }}
                options={combinations.filter(c => c.is_active || c.id === form.subject_combination_id).map(c => ({ id: c.id, label: `${c.code} — ${c.name}` }))}
              />
            </FormField>
            <FormField label="Pathway / track" span="half" hint="Set from the combination.">
              <InputField readOnly value={form.pathway ? `${pathwayLabel(form.pathway)}${form.track ? ` — ${form.track}` : ''}` : '—'} />
            </FormField>
          </>
        )}
      </FormGrid>
    </Modal>
  );
}
