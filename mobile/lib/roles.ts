/**
 * Roles and navigation. Who may open each screen comes from the web's own
 * rules (`src/lib/platform/pages.ts`, shared as `@shared/platform/pages`), so
 * a person sees the same pages here as in the web menu: by login role, by
 * duty (a nurse on Health, a bursar on Billing) and by the modules their
 * school runs. The tab bar mirrors the web's phone bar: a curated four per
 * role, duty pages filling any free slots, everything else under More.
 */
import { PAGE_ACCESS, canViewPage, type PageAccess, type PageViewer, type UserRole as SharedUserRole } from '@shared/platform/pages';

export const USER_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF', 'STUDENT', 'PARENT', 'PENDING'] as const satisfies readonly SharedUserRole[];
export type UserRole = (typeof USER_ROLES)[number];

export type Viewer = PageViewer;

export const TEACHER_ROLES = ['CLASS_TEACHER', 'SUBJECT_TEACHER'] as const satisfies readonly UserRole[];

/** Roles that run the school day to day: admins and teachers. */
export const STAFF_TEACHING_ROLES = ['ADMIN', ...TEACHER_ROLES] as const satisfies readonly UserRole[];

/** Every role that uses the staff tab tree (non-teaching STAFF included). */
export const STAFF_ROLES = [...STAFF_TEACHING_ROLES, 'STAFF'] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isRoleIn<const T extends readonly string[]>(role: string | null | undefined, roles: T): role is T[number] {
    return !!role && (roles as readonly string[]).includes(role);
}

/**
 * The one role switch the backend supports: a subject teacher who also holds a
 * class-teacher assignment may act as that class teacher. Anything else in
 * `activeRole` is stale and ignored.
 */
export function resolveEffectiveRole(baseRole: UserRole | null, activeRole: unknown): UserRole | null {
    if (baseRole === 'SUBJECT_TEACHER' && activeRole === 'CLASS_TEACHER') return 'CLASS_TEACHER';
    return baseRole;
}

/** Keyed by the web's roles, so a role added there fails to compile until it is labelled (and listed) here. */
export const ROLE_LABELS: Record<SharedUserRole, string> = {
    ADMIN: 'Administrator',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
    STAFF: 'Staff',
    STUDENT: 'Student',
    PARENT: 'Parent',
    PENDING: 'Pending',
};

export function roleLabel(role: string | null | undefined): string {
    return role && isRoleIn(role, USER_ROLES) ? ROLE_LABELS[role] : role ?? '—';
}

export interface ScreenMeta<Href extends string> {
    title: string;
    /** Short label for the tab bar. */
    tabLabel: string;
    icon: string;
    description: string;
    href: Href;
    /** Any one of these lets the viewer open the screen (People serves admins and class teachers). */
    access: readonly PageAccess[];
}

const canOpen = (meta: { access: readonly PageAccess[] }, viewer: Viewer) => meta.access.some((a) => canViewPage(a, viewer));

/** Pick the tab bar and the More list: curated picks first, then other visible screens fill free slots. */
function splitNav<S extends string>(order: readonly S[], curated: readonly S[], pinned: readonly S[], visible: (s: S) => boolean, slots = 4) {
    const shown = order.filter(visible);
    const picks = curated.filter(visible);
    const extra = shown.filter((s) => !picks.includes(s) && !pinned.includes(s));
    const primary = [...picks, ...extra].slice(0, Math.max(picks.length, slots));
    return { primary, overflow: shown.filter((s) => !primary.includes(s)) };
}

// ── Staff screens ────────────────────────────────────────────

/** Route names inside `app/staff/`, as Expo Router sees them. */
export type StaffScreen =
    | 'index' | 'exams' | 'reports' | 'attendance' | 'analytics'
    | 'calendar' | 'timetable' | 'exam-papers' | 'lesson-records' | 'cbc'
    | 'people/index' | 'parent-accounts' | 'classes' | 'subjects'
    | 'fees' | 'billing' | 'expenses'
    | 'boarding' | 'health' | 'discipline'
    | 'transport' | 'library' | 'inventory' | 'leave'
    | 'announcements' | 'assignments'
    | 'users' | 'settings' | 'profile';

const STAFF_EVERYONE: PageAccess = { roles: STAFF_ROLES };

export const STAFF_SCREENS: Record<StaffScreen, ScreenMeta<`/staff${string}`>> = {
    index: { title: 'Dashboard', tabLabel: 'Home', icon: '🏠', description: 'Your school at a glance', href: '/staff', access: [PAGE_ACCESS.dashboard] },
    exams: { title: 'Exams & Marks', tabLabel: 'Marks', icon: '📝', description: 'Enter marks, view results, release them', href: '/staff/exams', access: [PAGE_ACCESS.examsMarks] },
    reports: { title: 'Report Cards', tabLabel: 'Reports', icon: '📄', description: 'Download report cards and mark sheets', href: '/staff/reports', access: [PAGE_ACCESS.reports] },
    attendance: { title: 'Attendance', tabLabel: 'Attendance', icon: '📅', description: 'Take the daily register', href: '/staff/attendance', access: [PAGE_ACCESS.attendance] },
    analytics: { title: 'Analytics', tabLabel: 'Analytics', icon: '📊', description: 'How each class is doing', href: '/staff/analytics', access: [PAGE_ACCESS.analytics] },
    calendar: { title: 'Calendar', tabLabel: 'Calendar', icon: '🗓️', description: 'Term dates, exams, events and meetings', href: '/staff/calendar', access: [PAGE_ACCESS.calendar] },
    timetable: { title: 'Timetable', tabLabel: 'Timetable', icon: '⏰', description: 'Lessons by class, teacher and room', href: '/staff/timetable', access: [PAGE_ACCESS.timetable] },
    'exam-papers': { title: 'Exam Papers', tabLabel: 'Papers', icon: '🔐', description: 'Submit, moderate and print papers', href: '/staff/exam-papers', access: [PAGE_ACCESS.examPapers] },
    'lesson-records': { title: 'Professional Records', tabLabel: 'Records', icon: '📓', description: 'Schemes of work, lesson plans, records of work', href: '/staff/lesson-records', access: [PAGE_ACCESS.lessonRecords] },
    cbc: { title: 'CBC Assessment', tabLabel: 'CBC', icon: '🎯', description: 'Rubric levels by strand', href: '/staff/cbc', access: [PAGE_ACCESS.cbc] },
    'people/index': { title: 'People', tabLabel: 'People', icon: '👥', description: 'Students and teachers', href: '/staff/people', access: [PAGE_ACCESS.people, PAGE_ACCESS.myStudents] },
    'parent-accounts': { title: 'Parent accounts', tabLabel: 'Parents', icon: '🤝', description: 'Link parents to their children', href: '/staff/parent-accounts', access: [PAGE_ACCESS.parentAccounts] },
    classes: { title: 'Classes', tabLabel: 'Classes', icon: '🏫', description: 'Streams, class teachers and rosters', href: '/staff/classes', access: [PAGE_ACCESS.classes] },
    subjects: { title: 'Subjects', tabLabel: 'Subjects', icon: '📘', description: 'What the school offers and who teaches it', href: '/staff/subjects', access: [PAGE_ACCESS.subjects] },
    fees: { title: 'Fees', tabLabel: 'Fees', icon: '💰', description: 'Balances and collections', href: '/staff/fees', access: [PAGE_ACCESS.fees] },
    billing: { title: 'Billing', tabLabel: 'Billing', icon: '🧾', description: 'Vote heads, fee structures, invoices and bursaries', href: '/staff/billing', access: [PAGE_ACCESS.billing] },
    expenses: { title: 'Expenses', tabLabel: 'Expenses', icon: '👛', description: 'Requests, approvals and payments', href: '/staff/expenses', access: [PAGE_ACCESS.expenses] },
    boarding: { title: 'Boarding', tabLabel: 'Boarding', icon: '🛏️', description: 'Dorms, roll calls, exeats and inspections', href: '/staff/boarding', access: [PAGE_ACCESS.boarding] },
    health: { title: 'Health', tabLabel: 'Health', icon: '🩺', description: 'Sick bay, clinic visits and medicine', href: '/staff/health', access: [PAGE_ACCESS.health] },
    discipline: { title: 'Discipline', tabLabel: 'Discipline', icon: '🛡️', description: 'Incidents and actions taken', href: '/staff/discipline', access: [PAGE_ACCESS.discipline] },
    transport: { title: 'Transport', tabLabel: 'Transport', icon: '🚌', description: 'Buses, routes, trips and the live map', href: '/staff/transport', access: [PAGE_ACCESS.transport] },
    library: { title: 'Library', tabLabel: 'Library', icon: '📚', description: 'Catalogue, loans and overdue books', href: '/staff/library', access: [PAGE_ACCESS.library] },
    inventory: { title: 'Inventory', tabLabel: 'Stores', icon: '📦', description: 'Stock, assets and requisitions', href: '/staff/inventory', access: [PAGE_ACCESS.inventory] },
    leave: { title: 'Staff Leave', tabLabel: 'Leave', icon: '✈️', description: 'Requests and approvals', href: '/staff/leave', access: [PAGE_ACCESS.leave] },
    announcements: { title: 'Announcements', tabLabel: 'News', icon: '📣', description: 'School news and updates', href: '/staff/announcements', access: [PAGE_ACCESS.announcements] },
    assignments: { title: 'Assignments', tabLabel: 'Work', icon: '✏️', description: 'Homework for your classes', href: '/staff/assignments', access: [PAGE_ACCESS.assignments] },
    users: { title: 'Users', tabLabel: 'Users', icon: '🪪', description: 'Accounts, roles and access', href: '/staff/users', access: [PAGE_ACCESS.users] },
    settings: { title: 'Settings', tabLabel: 'Settings', icon: '⚙️', description: 'School profile, terms, modules and duties', href: '/staff/settings', access: [PAGE_ACCESS.settings] },
    profile: { title: 'Profile', tabLabel: 'Profile', icon: '👤', description: 'Your account', href: '/staff/profile', access: [STAFF_EVERYONE] },
};

/** The web menu's order: its groups top to bottom, then the pinned items. */
const STAFF_SCREEN_ORDER: readonly StaffScreen[] = [
    'index',
    'exams', 'reports', 'attendance', 'analytics', 'calendar', 'timetable', 'exam-papers', 'lesson-records', 'cbc',
    'people/index', 'parent-accounts', 'classes', 'subjects',
    'fees', 'billing', 'expenses',
    'boarding', 'health', 'discipline',
    'transport', 'library', 'inventory', 'leave',
    'announcements', 'assignments',
    'users', 'settings', 'profile',
];

/** Kept off the tab bar, as the web pins them to the sidebar's foot. */
const STAFF_PINNED: readonly StaffScreen[] = ['users', 'settings', 'profile'];

/** A curated four per role — the same picks as the web's phone bar. */
const PRIMARY_BY_ROLE: Record<StaffRole, readonly StaffScreen[]> = {
    ADMIN: ['index', 'exams', 'people/index', 'fees'],
    CLASS_TEACHER: ['index', 'exams', 'attendance', 'reports'],
    SUBJECT_TEACHER: ['index', 'exams', 'assignments', 'announcements'],
    STAFF: ['index', 'announcements'],
};

export function canAccessStaffScreen(screen: StaffScreen, viewer: Viewer): boolean {
    return isRoleIn(viewer.role, STAFF_ROLES) && canOpen(STAFF_SCREENS[screen], viewer);
}

export function getStaffNav(viewer: Viewer): { primary: StaffScreen[]; overflow: StaffScreen[] } {
    if (!isRoleIn(viewer.role, STAFF_ROLES)) return { primary: [], overflow: [] };
    return splitNav(STAFF_SCREEN_ORDER, PRIMARY_BY_ROLE[viewer.role], STAFF_PINNED, (s) => canAccessStaffScreen(s, viewer));
}

// ── Student screens ──────────────────────────────────────────

export type StudentScreen = 'index' | 'results' | 'subjects/index' | 'timetable' | 'attendance' | 'fees' | 'profile';

export const STUDENT_SCREENS: Record<StudentScreen, ScreenMeta<`/student${string}`>> = {
    index: { title: 'Dashboard', tabLabel: 'Home', icon: '🏠', description: 'Your day at a glance', href: '/student', access: [PAGE_ACCESS.studentDashboard] },
    results: { title: 'My Results', tabLabel: 'Results', icon: '🎓', description: 'Exam marks and report cards', href: '/student/results', access: [PAGE_ACCESS.myResults] },
    'subjects/index': { title: 'My Subjects', tabLabel: 'Subjects', icon: '📚', description: 'Performance, homework and notes per subject', href: '/student/subjects', access: [PAGE_ACCESS.mySubjects] },
    timetable: { title: 'Timetable', tabLabel: 'Timetable', icon: '⏰', description: 'Your class timetable', href: '/student/timetable', access: [PAGE_ACCESS.myTimetable] },
    fees: { title: 'Fees', tabLabel: 'Fees', icon: '💰', description: 'Balance, payments and paying online', href: '/student/fees', access: [PAGE_ACCESS.myFees] },
    attendance: { title: 'Attendance', tabLabel: 'Attendance', icon: '📅', description: 'Your attendance history', href: '/student/attendance', access: [PAGE_ACCESS.myAttendance] },
    profile: { title: 'My Profile', tabLabel: 'Profile', icon: '👤', description: 'Your details and account', href: '/student/profile', access: [PAGE_ACCESS.myProfile] },
};

const STUDENT_ORDER: readonly StudentScreen[] = ['index', 'results', 'subjects/index', 'timetable', 'attendance', 'fees', 'profile'];

export function canAccessStudentScreen(screen: StudentScreen, viewer: Viewer): boolean {
    return canOpen(STUDENT_SCREENS[screen], viewer);
}

/** The web's phone bar shows Dashboard, Results and Subjects; Fees is added as the one thing families act on. */
export function getStudentNav(viewer: Viewer): { primary: StudentScreen[]; overflow: StudentScreen[] } {
    return splitNav(STUDENT_ORDER, ['index', 'results', 'subjects/index', 'fees'], ['profile'], (s) => canAccessStudentScreen(s, viewer));
}
