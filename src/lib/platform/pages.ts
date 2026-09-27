/**
 * Who may open each page, shared by the web menu (`navItems.tsx`) and the
 * mobile app's tabs (`mobile/lib/roles.ts`) so both show a person the same
 * pages. The server still enforces every rule; this only decides what to show.
 *
 * Platform-neutral with relative imports only (the mobile app imports it).
 */
import type { UserRole } from '../../types';
import type { ModuleKey } from './modules';
import type { Permission } from './permissions';

export type { UserRole };

export interface PageAccess {
    /** Login roles that always see the page. */
    roles: readonly UserRole[];
    /** Also shown to anyone granted one of these (a bursar on Fees, a nurse on Health). */
    permissions?: readonly Permission[];
    /** Hidden while the school has this module off. */
    module?: ModuleKey;
}

/** Who is looking: their role and what their duties and school allow. */
export interface PageViewer {
    role: UserRole | null;
    can: (permission: Permission) => boolean;
    hasModule: (module: ModuleKey) => boolean;
}

const STAFF: readonly UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'];
const ADMIN: readonly UserRole[] = ['ADMIN'];

export const PAGE_ACCESS = {
    dashboard: { roles: [...STAFF, 'STAFF'] },
    studentDashboard: { roles: ['STUDENT'] },
    examsMarks: { roles: STAFF, module: 'exams' },
    reports: { roles: ['ADMIN', 'CLASS_TEACHER'], module: 'report_cards' },
    attendance: { roles: ['ADMIN', 'CLASS_TEACHER'], module: 'attendance' },
    analytics: { roles: ADMIN, module: 'analytics' },
    calendar: { roles: [], permissions: ['calendar.view'], module: 'calendar' },
    examPapers: { roles: [], permissions: ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'], module: 'exam_papers' },
    timetable: { roles: [], permissions: ['timetable.view'], module: 'timetable' },
    lessonRecords: { roles: [], permissions: ['lesson_records.write', 'lesson_records.review'], module: 'lesson_records' },
    cbc: { roles: [], permissions: ['cbc.assess', 'cbc.view'], module: 'cbc_assessment' },
    people: { roles: ADMIN },
    myStudents: { roles: ['CLASS_TEACHER'] },
    parentAccounts: { roles: ADMIN, module: 'parent_portal' },
    classes: { roles: ADMIN },
    subjects: { roles: ADMIN },
    fees: { roles: ADMIN, permissions: ['fees.view'], module: 'fees' },
    billing: { roles: [], permissions: ['billing.view'], module: 'fee_structures' },
    expenses: { roles: [], permissions: ['expenses.request', 'expenses.view', 'expenses.approve'], module: 'expenses' },
    boarding: { roles: [], permissions: ['boarding.view'], module: 'boarding' },
    health: { roles: [], permissions: ['health.view'], module: 'health' },
    discipline: { roles: [], permissions: ['discipline.record', 'discipline.manage'], module: 'discipline' },
    transport: { roles: [], permissions: ['transport.view', 'transport.drive'], module: 'transport' },
    library: { roles: [], permissions: ['library.view'], module: 'library' },
    inventory: { roles: [], permissions: ['inventory.request', 'inventory.manage'], module: 'inventory' },
    leave: { roles: [], permissions: ['hr.request', 'hr.manage'], module: 'staff_hr' },
    announcements: { roles: [...STAFF, 'STAFF'] },
    assignments: { roles: STAFF, module: 'assignments' },
    users: { roles: ADMIN },
    settings: { roles: ADMIN },
    myResults: { roles: ['STUDENT'], module: 'exams' },
    mySubjects: { roles: ['STUDENT'] },
    myAttendance: { roles: ['STUDENT'], module: 'attendance' },
    myTimetable: { roles: ['STUDENT'], module: 'timetable' },
    myFees: { roles: ['STUDENT'], module: 'fees' },
    parentHome: { roles: ['PARENT'], module: 'parent_portal' },
    myProfile: { roles: ['STUDENT'] },
} as const satisfies Record<string, PageAccess>;

export type PageKey = keyof typeof PAGE_ACCESS;

/*
 * No role yet (still loading, or signed out) shows nothing rather than
 * briefly showing every signed-in user the admin menu. Students and parents
 * never pick up staff pages through a permission (students hold
 * calendar.view, for instance).
 */
export function canViewPage(page: PageAccess, viewer: PageViewer): boolean {
    const { role } = viewer;
    if (!role) return false;
    if (page.module && !viewer.hasModule(page.module)) return false;
    if (page.roles.includes(role)) return true;
    if (role === 'STUDENT' || role === 'PARENT' || role === 'PENDING') return false;
    return !!page.permissions?.some(p => viewer.can(p));
}
