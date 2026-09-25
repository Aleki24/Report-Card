import type { UserRole } from '@/types';

/**
 * Role groups shared by pages, navigation and API routes, so a role check
 * reads the same list everywhere instead of re-typing it per file.
 *
 * Client-safe: no server imports.
 */
export const TEACHER_ROLES = ['CLASS_TEACHER', 'SUBJECT_TEACHER'] as const satisfies readonly UserRole[];

/** Roles that run the school day to day: admins and teachers. */
export const STAFF_TEACHING_ROLES = ['ADMIN', ...TEACHER_ROLES] as const satisfies readonly UserRole[];

/** Roles an admin may give an account from the Users page. */
export const ASSIGNABLE_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF', 'STUDENT'] as const satisfies readonly UserRole[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isRoleIn<const T extends readonly string[]>(role: string | null | undefined, roles: T): role is T[number] {
    return !!role && (roles as readonly string[]).includes(role);
}

/**
 * The one role switch the app supports: a subject teacher who also holds a
 * class-teacher assignment may view the app as that class teacher.
 *
 * `active_role` lives in Clerk metadata and outlives role changes — an account
 * demoted to STUDENT or STAFF kept whatever active_role it had, and was then
 * shown the class-teacher UI. Anything other than the supported switch is
 * ignored, so the effective role can never exceed what the base role allows.
 */
export function resolveActiveRole(baseRole: UserRole | null, activeRole: unknown): UserRole | null {
    return baseRole === 'SUBJECT_TEACHER' && activeRole === 'CLASS_TEACHER' ? 'CLASS_TEACHER' : null;
}

/** Where a role lands when it opens a page it may not use. */
export function homePathForRole(role: UserRole | null): string {
    if (role === 'STUDENT') return '/student/dashboard';
    if (role === 'PENDING') return '/dashboard/onboarding';
    return '/dashboard';
}

/** How each role is named to people, e.g. on the activation screen. */
export const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Admin',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
    STAFF: 'Staff',
    STUDENT: 'Student',
    PENDING: 'Pending',
};
