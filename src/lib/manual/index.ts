import type { UserRole } from '../../types';
import type { DutyKey } from '../platform/permissions';
import { adminManual } from './admin';
import { financeManual, healthManual, leadershipManual, operationsManual, transportManual, welfareManual } from './duties';
import { parentManual } from './parent';
import { staffManual } from './staff';
import { studentManual } from './student';
import { classTeacherManual, subjectTeacherManual } from './teacher';
import type { Manual, ManualSlug } from './types';

export type { Manual, ManualChapter, ManualFigure, ManualSection, ManualSlug, ManualStep } from './types';

export const MANUALS: Record<ManualSlug, Manual> = {
    admin: adminManual,
    'class-teacher': classTeacherManual,
    'subject-teacher': subjectTeacherManual,
    staff: staffManual,
    student: studentManual,
    parent: parentManual,
    leadership: leadershipManual,
    finance: financeManual,
    welfare: welfareManual,
    health: healthManual,
    transport: transportManual,
    operations: operationsManual,
};

/** Guides by login role, in the order people are offered them. */
export const ROLE_MANUAL_SLUGS: readonly ManualSlug[] = ['admin', 'class-teacher', 'subject-teacher', 'staff', 'student', 'parent'];
/** Guides for duties assigned on top of a role. */
export const DUTY_MANUAL_SLUGS: readonly ManualSlug[] = ['leadership', 'finance', 'welfare', 'health', 'transport', 'operations'];
export const MANUAL_SLUGS: readonly ManualSlug[] = [...ROLE_MANUAL_SLUGS, ...DUTY_MANUAL_SLUGS];

export const isManualSlug = (value: string): value is ManualSlug => value in MANUALS;

/** The guide for each duty. `satisfies` makes a new duty without a guide a compile error. */
export const DUTY_MANUAL = {
    PRINCIPAL: 'leadership',
    DEPUTY_PRINCIPAL: 'leadership',
    DOS: 'leadership',
    HOD: 'leadership',
    TIMETABLER: 'leadership',
    EXAMS_OFFICER: 'leadership',
    BURSAR: 'finance',
    ACCOUNTANT: 'finance',
    MATRON: 'welfare',
    PATRON: 'welfare',
    DISCIPLINE_MASTER: 'welfare',
    NURSE: 'health',
    TRANSPORT_MANAGER: 'transport',
    DRIVER: 'transport',
    LIBRARIAN: 'operations',
    STOREKEEPER: 'operations',
    HR_OFFICER: 'operations',
} as const satisfies Record<DutyKey, ManualSlug>;

/** The guide a signed-in role should read first. */
export function manualForRole(role: UserRole | null | undefined): ManualSlug {
    switch (role) {
        case 'CLASS_TEACHER': return 'class-teacher';
        case 'SUBJECT_TEACHER': return 'subject-teacher';
        case 'STAFF': return 'staff';
        case 'STUDENT': return 'student';
        case 'PARENT': return 'parent';
        default: return 'admin';
    }
}

/**
 * Every guide that applies to someone: their role's, then one per duty they
 * hold. Administrators get every duty guide, since they can open every page.
 */
export function manualsFor(role: UserRole | null | undefined, duties: readonly DutyKey[]): ManualSlug[] {
    const primary = manualForRole(role);
    const extra = role === 'ADMIN' ? DUTY_MANUAL_SLUGS : duties.map(d => DUTY_MANUAL[d]);
    return [...new Set<ManualSlug>([primary, ...extra])];
}

/** The downloadable PDF, generated from /help/[slug] and kept in public/manuals. */
export const manualPdfHref = (slug: ManualSlug) => `/manuals/skulbase-${slug}-guide.pdf`;
export const manualWebHref = (slug: ManualSlug) => `/help/${slug}`;
