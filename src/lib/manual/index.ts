import type { UserRole } from '@/types';
import { adminManual } from './admin';
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
};

/** In the order people are offered them. */
export const MANUAL_SLUGS: readonly ManualSlug[] = ['admin', 'class-teacher', 'subject-teacher', 'staff', 'student'];

export const isManualSlug = (value: string): value is ManualSlug => value in MANUALS;

/** The guide a signed-in role should read first. */
export function manualForRole(role: UserRole | null | undefined): ManualSlug {
    switch (role) {
        case 'ADMIN': return 'admin';
        case 'CLASS_TEACHER': return 'class-teacher';
        case 'SUBJECT_TEACHER': return 'subject-teacher';
        case 'STAFF': return 'staff';
        case 'STUDENT': return 'student';
        default: return 'admin';
    }
}

/** The downloadable PDF, generated from /help/[slug] and kept in public/manuals. */
export const manualPdfHref = (slug: ManualSlug) => `/manuals/skulbase-${slug}-guide.pdf`;
export const manualWebHref = (slug: ManualSlug) => `/help/${slug}`;
