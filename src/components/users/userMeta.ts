import {
  Briefcase, GraduationCap, Hourglass, ShieldCheck, UserRound, Users, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types';
import type { UserRow } from '@/hooks/useUsersPage';
import { TEACHER_ROLES, isRoleIn } from '@/lib/roles';

/** The groups the directory filters by. Class and subject teachers are one "Teacher" group in the UI. */
export type RoleGroup = 'ADMIN' | 'TEACHER' | 'STAFF' | 'STUDENT';
export type RoleFilter = 'ALL' | RoleGroup;
export type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
export type UserSort = 'newest' | 'name';
export type DirectoryView = 'grid' | 'list';
/** No class filter, a whole grade ("grade:Grade 10"), or one stream ("class:Grade 10 East"). */
export type ClassFilter = '' | `grade:${string}` | `class:${string}`;

/** Grades in school order, each with its streams, for the class filter. */
export interface GradeGroup { grade: string; classes: string[] }

export function roleGroupOf(role: UserRole): RoleGroup | null {
  if (isRoleIn(role, TEACHER_ROLES)) return 'TEACHER';
  if (role === 'PENDING') return null;
  return role;
}

interface RoleMeta {
  label: string;
  icon: LucideIcon;
  /** Badge colours: tinted background, text and border. */
  badge: string;
  /** Gradient behind the initials when there is no photo, and the profile banner tint. */
  gradient: string;
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  ADMIN: { label: 'Admin', icon: ShieldCheck, badge: 'bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-400', gradient: 'from-rose-500 to-orange-400' },
  CLASS_TEACHER: { label: 'Class Teacher', icon: GraduationCap, badge: 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400', gradient: 'from-blue-500 to-cyan-400' },
  SUBJECT_TEACHER: { label: 'Subject Teacher', icon: BookOpen, badge: 'bg-violet-500/10 text-violet-600 border-violet-500/25 dark:text-violet-400', gradient: 'from-violet-500 to-fuchsia-400' },
  STAFF: { label: 'Staff', icon: Briefcase, badge: 'bg-sky-500/10 text-sky-600 border-sky-500/25 dark:text-sky-400', gradient: 'from-sky-500 to-teal-400' },
  STUDENT: { label: 'Student', icon: UserRound, badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400', gradient: 'from-emerald-500 to-lime-400' },
  PENDING: { label: 'Pending', icon: Hourglass, badge: 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400', gradient: 'from-amber-500 to-yellow-400' },
};

export const ROLE_FILTERS: readonly { value: RoleFilter; label: string; icon: LucideIcon }[] = [
  { value: 'ALL', label: 'All', icon: Users },
  { value: 'STUDENT', label: 'Students', icon: UserRound },
  { value: 'TEACHER', label: 'Teachers', icon: GraduationCap },
  { value: 'ADMIN', label: 'Admins', icon: ShieldCheck },
  { value: 'STAFF', label: 'Staff', icon: Briefcase },
];

export const fullName = (u: { first_name: string | null; last_name: string | null }): string =>
  `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed user';

/** One line under the name that says who this person is at the school. */
export function describeUser(u: UserRow): string {
  switch (u.role) {
    case 'STUDENT': return u.class_name ?? 'No class assigned';
    case 'STAFF': return u.job_title || 'Staff member';
    default: return u.email || u.username || '—';
  }
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** "12 Mar 2025", or an em dash when the date is missing or unparseable. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, DATE_FORMAT);
}

/** Whole years since a date of birth, or null when it is missing. */
export function ageFrom(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  const hadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  return now.getFullYear() - dob.getFullYear() - (hadBirthday ? 0 : 1);
}

export { humanize } from '@/lib/text';
