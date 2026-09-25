import type { UserRole } from '@/types';
import type { UserRow } from '@/hooks/useUsersPage';

/** A student as /api/school/data?type=students returns one. */
export interface StudentRow {
  id: string;
  admission_number: string | null;
  current_grade_stream_id: string | null;
  status: string;
  gender: string | null;
  date_of_birth: string | null;
  users: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  avatar_url: string | null;
  grade_streams: { id: string; full_name: string; grade_id: string } | null;
  pathway: string | null;
  track: string | null;
  subject_combination_id: string | null;
  subject_combinations: { id: string; code: string; name: string } | null;
}

/** A staff member as /api/school/data?type=teachers returns one. */
export interface StaffRow {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    avatar_url: string | null;
    is_active: boolean;
    role: UserRole;
    job_title: string | null;
  };
  subjects: string;
  classes: string;
}

export interface CombinationOption { id: string; code: string; name: string; pathway: string; track: string | null; is_active: boolean }
export interface GradeStreamOption { id: string; full_name: string; grade_id: string }
export interface GradeOption { id: string; code: string | null; name_display: string; academic_level_id: string; numeric_order: number }
export interface AcademicLevelOption { id: string; name: string; code?: string }

/** One student row read from an import file, as sent to /api/admin/bulk-import-students. */
export interface ImportRow {
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  date_of_birth: string;
  guardian_phone: string;
  guardian_name: string;
  guardian_email: string;
  class: string;
  stream: string;
  academic_level_id: string;
}

/** Sign-in details made for new students; shown once. */
export interface CreatedCredential { first_name: string; last_name: string; username: string; invite_code: string }

/** Admission numbers are optional, so every display falls back to a dash. */
export const admNoLabel = (value: string | null | undefined) => value?.trim() || '—';

export const studentName = (s: StudentRow) => `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''}`.trim() || 'Student';

/** The profile dialog is shared with the Users page and speaks UserRow. */
export function studentAsUser(s: StudentRow): UserRow {
  return {
    id: s.id,
    first_name: s.users?.first_name ?? '',
    last_name: s.users?.last_name ?? '',
    email: s.users?.email ?? null,
    username: '',
    phone: s.users?.phone ?? null,
    role: 'STUDENT',
    is_active: s.status === 'ACTIVE',
    created_at: '',
    admission_number: s.admission_number,
    avatar_url: s.avatar_url,
    class_name: s.grade_streams?.full_name ?? null,
  };
}

export function staffAsUser(t: StaffRow): UserRow {
  return {
    id: t.id,
    first_name: t.profile.first_name,
    last_name: t.profile.last_name,
    email: t.profile.email,
    username: '',
    phone: t.profile.phone || null,
    role: t.profile.role,
    is_active: t.profile.is_active,
    created_at: '',
    job_title: t.profile.job_title,
    avatar_url: t.profile.avatar_url,
  };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');
