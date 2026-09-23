/**
 * Roles and navigation, mirroring the web app's `src/lib/roles.ts` and
 * `src/components/layout/sidebar/navItems.tsx` so a role sees the same
 * screens on both. The web's phone layout shows four curated items per role
 * plus a "More" sheet; the tab bar here does the same.
 */

export const USER_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF', 'STUDENT', 'PENDING'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Administrator',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
    STAFF: 'Staff',
    STUDENT: 'Student',
    PENDING: 'Pending',
};

export function roleLabel(role: string | null | undefined): string {
    return role && isRoleIn(role, USER_ROLES) ? ROLE_LABELS[role] : role ?? '—';
}

// ── Staff screens ────────────────────────────────────────────

/** Route names inside `app/staff/`, as Expo Router sees them. */
export type StaffScreen =
    | 'index'
    | 'exams'
    | 'reports'
    | 'attendance'
    | 'analytics'
    | 'people/index'
    | 'fees'
    | 'announcements'
    | 'assignments'
    | 'classes'
    | 'subjects'
    | 'users'
    | 'settings'
    | 'profile';

export interface StaffScreenMeta {
    title: string;
    /** Short label for the tab bar. */
    tabLabel: string;
    icon: string;
    description: string;
    href: `/staff${string}`;
    roles: readonly StaffRole[];
}

/** Same role lists as the web sidebar — keep the two in step. */
export const STAFF_SCREENS: Record<StaffScreen, StaffScreenMeta> = {
    index: { title: 'Dashboard', tabLabel: 'Home', icon: '🏠', description: 'Your school at a glance', href: '/staff', roles: STAFF_ROLES },
    exams: { title: 'Exams & Marks', tabLabel: 'Marks', icon: '📝', description: 'Enter marks, view results, release them', href: '/staff/exams', roles: STAFF_TEACHING_ROLES },
    reports: { title: 'Report Cards', tabLabel: 'Reports', icon: '📄', description: 'Download report cards and mark sheets', href: '/staff/reports', roles: ['ADMIN', 'CLASS_TEACHER'] },
    attendance: { title: 'Attendance', tabLabel: 'Attendance', icon: '📅', description: 'Take the daily register', href: '/staff/attendance', roles: ['ADMIN', 'CLASS_TEACHER'] },
    analytics: { title: 'Analytics', tabLabel: 'Analytics', icon: '📊', description: 'How each class is doing', href: '/staff/analytics', roles: ['ADMIN'] },
    'people/index': { title: 'People', tabLabel: 'People', icon: '👥', description: 'Students and teachers', href: '/staff/people', roles: ['ADMIN', 'CLASS_TEACHER'] },
    fees: { title: 'Fees', tabLabel: 'Fees', icon: '💰', description: 'Balances and collections', href: '/staff/fees', roles: ['ADMIN', 'CLASS_TEACHER'] },
    announcements: { title: 'Announcements', tabLabel: 'News', icon: '📣', description: 'School news and updates', href: '/staff/announcements', roles: STAFF_ROLES },
    assignments: { title: 'Assignments', tabLabel: 'Work', icon: '📚', description: 'Homework for your classes', href: '/staff/assignments', roles: STAFF_TEACHING_ROLES },
    classes: { title: 'Classes', tabLabel: 'Classes', icon: '🏫', description: 'Streams, class teachers and rosters', href: '/staff/classes', roles: ['ADMIN'] },
    subjects: { title: 'Subjects', tabLabel: 'Subjects', icon: '📘', description: 'What the school offers and who teaches it', href: '/staff/subjects', roles: ['ADMIN'] },
    users: { title: 'Users', tabLabel: 'Users', icon: '🪪', description: 'Accounts, roles and access', href: '/staff/users', roles: ['ADMIN'] },
    settings: { title: 'Settings', tabLabel: 'Settings', icon: '⚙️', description: 'School profile and terms', href: '/staff/settings', roles: ['ADMIN'] },
    profile: { title: 'Profile', tabLabel: 'Profile', icon: '👤', description: 'Your account', href: '/staff/profile', roles: STAFF_ROLES },
};

/** Order screens appear in the More list. */
const STAFF_SCREEN_ORDER: readonly StaffScreen[] = [
    'index', 'exams', 'reports', 'attendance', 'analytics', 'people/index', 'classes', 'subjects', 'fees', 'announcements', 'assignments', 'users', 'settings', 'profile',
];

/** A curated four per role for the tab bar — same picks as the web's phone bar. */
const PRIMARY_BY_ROLE: Record<StaffRole, readonly StaffScreen[]> = {
    ADMIN: ['index', 'exams', 'people/index', 'fees'],
    CLASS_TEACHER: ['index', 'exams', 'attendance', 'reports'],
    SUBJECT_TEACHER: ['index', 'exams', 'assignments', 'announcements'],
    STAFF: ['index', 'announcements'],
};

export function canAccessStaffScreen(screen: StaffScreen, role: UserRole | null): boolean {
    return isRoleIn(role, STAFF_SCREENS[screen].roles);
}

export function getStaffNav(role: UserRole | null): { primary: StaffScreen[]; overflow: StaffScreen[] } {
    if (!isRoleIn(role, STAFF_ROLES)) return { primary: [], overflow: [] };
    const primary = PRIMARY_BY_ROLE[role].filter((s) => canAccessStaffScreen(s, role));
    const overflow = STAFF_SCREEN_ORDER.filter((s) => !primary.includes(s) && canAccessStaffScreen(s, role));
    return { primary, overflow };
}

// ── Student screens ──────────────────────────────────────────

export type StudentScreen = 'index' | 'results' | 'subjects/index' | 'attendance' | 'fees' | 'profile';

export const STUDENT_SCREENS: Record<StudentScreen, Omit<StaffScreenMeta, 'roles' | 'href'> & { href: `/student${string}` }> = {
    index: { title: 'Dashboard', tabLabel: 'Home', icon: '🏠', description: 'Your day at a glance', href: '/student' },
    results: { title: 'My Results', tabLabel: 'Results', icon: '🎓', description: 'Exam marks and report cards', href: '/student/results' },
    'subjects/index': { title: 'My Subjects', tabLabel: 'Subjects', icon: '📚', description: 'Performance, homework and notes per subject', href: '/student/subjects' },
    fees: { title: 'Fees', tabLabel: 'Fees', icon: '💰', description: 'Balance, payments and paying online', href: '/student/fees' },
    attendance: { title: 'Attendance', tabLabel: 'Attendance', icon: '📅', description: 'Your attendance history', href: '/student/attendance' },
    profile: { title: 'My Profile', tabLabel: 'Profile', icon: '👤', description: 'Your details and account', href: '/student/profile' },
};

/** The web's phone bar shows Dashboard, Results and Subjects; Fees is added as the one thing families act on. */
export const STUDENT_PRIMARY: readonly StudentScreen[] = ['index', 'results', 'subjects/index', 'fees'];
export const STUDENT_OVERFLOW: readonly StudentScreen[] = ['attendance', 'profile'];
