"use client";

import React, { useEffect, useId, useState } from 'react';
import { z } from 'zod';
import { LoaderCircle, Save, School, UserRound, Users } from 'lucide-react';
import { FormField, FormGrid, InputField, SelectField, type SelectOption } from '@/components/ui/FormField';
import { StudentStatus } from '@/lib/schemas';
import { CLASS_REQUIRED_MESSAGE } from '@/lib/classes';
import type { StudentProfile } from '@/types/user-profile';
import { humanize } from '../userMeta';
import { ProfileSection } from './ProfileParts';
import { updateStudentDetails, type StudentDetailsUpdate } from './profileApi';

const GENDER_OPTIONS: readonly SelectOption[] = [
  { id: 'MALE', label: 'Male' },
  { id: 'FEMALE', label: 'Female' },
];

const STATUS_OPTIONS: readonly SelectOption[] = StudentStatus.options.map(s => ({ id: s, label: humanize(s) }));

const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} is too long`);

const studentDetailsSchema = z.object({
  admission_number: optionalText(30, 'Admission number'),
  gender: z.enum(['', 'MALE', 'FEMALE']),
  date_of_birth: z.string().refine(v => !v || new Date(v) < new Date(), 'Date of birth must be in the past'),
  grade_stream_id: z.string(),
  status: StudentStatus,
  guardian_name: optionalText(100, 'Guardian name'),
  // Same rule the People page applies, so a number that SMS can't reach is caught at entry.
  guardian_phone: z.string().trim().refine(v => {
    if (!v) return true;
    const digits = v.replace(/\D/g, '').length;
    return digits >= 9 && digits <= 12;
  }, 'Use a format like 0712345678'),
  guardian_email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
}).refine(v => v.status !== 'ACTIVE' || v.grade_stream_id !== '', { path: ['grade_stream_id'], message: CLASS_REQUIRED_MESSAGE });

type FormValues = z.input<typeof studentDetailsSchema>;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

function initialValues(p: StudentProfile): FormValues {
  const gender = p.gender?.toUpperCase();
  return {
    admission_number: p.admission_number ?? '',
    gender: gender === 'MALE' || gender === 'FEMALE' ? gender : '',
    date_of_birth: p.date_of_birth?.slice(0, 10) ?? '',
    grade_stream_id: p.grade_stream?.id ?? '',
    status: p.status,
    guardian_name: p.guardian_name ?? '',
    guardian_phone: p.guardian_phone ?? '',
    guardian_email: p.guardian_email ?? '',
  };
}

/** The school's classes for the class picker. */
function useClassOptions(): { options: SelectOption[]; error: string | null } {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/school/data?type=grade_streams', { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const body: unknown = await res.json();
        const rows = typeof body === 'object' && body !== null && 'data' in body && Array.isArray(body.data)
          ? (body.data as { id: string; full_name: string }[])
          : null;
        if (!res.ok || !rows) throw new Error('Could not load classes');
        setOptions(rows.map(r => ({ id: r.id, label: r.full_name })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load classes');
      });
    return () => controller.abort();
  }, []);

  return { options, error };
}

interface StudentDetailsFormProps {
  profile: StudentProfile;
  onCancel: () => void;
  /** Called after a successful save so the dialog and directory can refresh. */
  onSaved: () => void;
}

export function StudentDetailsForm({ profile, onCancel, onSaved }: StudentDetailsFormProps) {
  const initial = initialValues(profile);
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const classes = useClassOptions();
  const id = useId();

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) => {
    setValues(v => ({ ...v, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };
  const text = (key: Exclude<keyof FormValues, 'gender' | 'status'>) => ({
    id: `${id}-${key}`,
    value: values[key],
    error: Boolean(errors[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key)(e.target.value),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = studentDetailsSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        next[key] ??= issue.message;
      }
      setErrors(next);
      // Errors can sit below the fold of the dialog; take the user to the first one.
      const first = (Object.keys(values) as (keyof FormValues)[]).find(key => next[key]);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }

    // Send only what changed, so an untouched class never trips the move checks.
    const cleaned: StudentDetailsUpdate = parsed.data;
    const changes: Partial<StudentDetailsUpdate> = {};
    for (const key of Object.keys(cleaned) as (keyof StudentDetailsUpdate)[]) {
      if (cleaned[key] !== initial[key]) Object.assign(changes, { [key]: cleaned[key] });
    }
    if (Object.keys(changes).length === 0) { onCancel(); return; }

    setSaving(true);
    try {
      await updateStudentDetails(profile.id, changes);
      onSaved();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not save the student');
    } finally {
      setSaving(false);
    }
  };

  // The scroll margins keep a focused field clear of the sticky save bar and the sticky tabs.
  return (
    <form onSubmit={submit} noValidate className="space-y-4 [&_input]:scroll-mt-16 [&_input]:scroll-mb-24 [&_select]:scroll-mt-16 [&_select]:scroll-mb-24">
      <ProfileSection title="Personal details" icon={UserRound}>
        <FormGrid>
          <FormField label="Admission no." htmlFor={`${id}-admission_number`} error={errors.admission_number} span="half">
            <InputField {...text('admission_number')} placeholder="e.g. 1024" autoComplete="off" />
          </FormField>
          <FormField label="Gender" htmlFor={`${id}-gender`} span="half">
            <SelectField id={`${id}-gender`} value={values.gender} onChange={v => set('gender')(v as FormValues['gender'])} options={GENDER_OPTIONS} placeholder="Not set" />
          </FormField>
          <FormField label="Date of birth" htmlFor={`${id}-date_of_birth`} error={errors.date_of_birth} span="half">
            <InputField {...text('date_of_birth')} type="date" max={new Date().toISOString().slice(0, 10)} />
          </FormField>
          <FormField label="Enrolment status" htmlFor={`${id}-status`} span="half" hint={values.status === 'ACTIVE' ? undefined : 'Learners who have left can be without a class.'}>
            <SelectField id={`${id}-status`} value={values.status} onChange={v => set('status')(v as FormValues['status'])} options={STATUS_OPTIONS} placeholder={null} />
          </FormField>
        </FormGrid>
      </ProfileSection>

      <ProfileSection title="Class" icon={School}>
        <FormField label="Class" htmlFor={`${id}-grade_stream_id`} required={values.status === 'ACTIVE'} error={errors.grade_stream_id ?? classes.error ?? undefined}>
          <SelectField
            id={`${id}-grade_stream_id`}
            value={values.grade_stream_id}
            onChange={set('grade_stream_id')}
            options={classes.options.length ? classes.options : profile.grade_stream ? [{ id: profile.grade_stream.id, label: profile.grade_stream.full_name }] : []}
            placeholder="No class"
            error={Boolean(errors.grade_stream_id)}
          />
        </FormField>
      </ProfileSection>

      <ProfileSection title="Parent / guardian" icon={Users}>
        <FormGrid>
          <FormField label="Name" htmlFor={`${id}-guardian_name`} error={errors.guardian_name} span="full">
            <InputField {...text('guardian_name')} autoComplete="off" />
          </FormField>
          <FormField label="Phone" htmlFor={`${id}-guardian_phone`} error={errors.guardian_phone} span="half">
            <InputField {...text('guardian_phone')} type="tel" inputMode="tel" placeholder="0712345678" autoComplete="off" />
          </FormField>
          <FormField label="Email" htmlFor={`${id}-guardian_email`} error={errors.guardian_email} span="half">
            <InputField {...text('guardian_email')} type="email" inputMode="email" autoComplete="off" />
          </FormField>
        </FormGrid>
      </ProfileSection>

      {formError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:justify-end sm:px-6">
        <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
