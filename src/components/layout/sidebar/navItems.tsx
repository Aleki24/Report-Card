import React from 'react';
import {
    LayoutDashboard, GraduationCap, LineChart, FileText, Users, School,
    UserCircle, Settings, BookOpen, ClipboardList, CalendarCheck, Bell,
    Briefcase, DollarSign, CalendarDays, FileLock2, Clock, NotebookPen, Target,
    Receipt, Wallet, BedDouble, HeartPulse, ShieldAlert, Bus, Library, Package, Plane,
} from 'lucide-react';
import { type UserRole } from '@/components/AuthProvider';
import type { ModuleKey } from '@/lib/platform/modules';
import type { Permission } from '@/lib/platform/permissions';

export interface NavItem {
    label: string;
    /** Shorter name for the phone's bottom bar, where each tab is a fifth of the width. */
    shortLabel?: string;
    href: string;
    icon: React.ReactNode;
    /** Login roles that always see the item. */
    roles: UserRole[];
    /** Also shown to anyone granted one of these (a bursar on Fees, a nurse on Health). */
    permissions?: readonly Permission[];
    /** Hidden while the school has this module off. */
    module?: ModuleKey;
}

/** Who is looking at the menu: their role and what their duties and school allow. */
export interface NavViewer {
    role: UserRole | null;
    can: (permission: Permission) => boolean;
    hasModule: (module: ModuleKey) => boolean;
}

export interface NavGroup {
    /** null = no group header (top-level items like Dashboard). */
    title: string | null;
    items: NavItem[];
}

const staffRoles: UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'];
const adminRoles: UserRole[] = ['ADMIN'];

const icon = (I: React.ComponentType<{ size?: number; style?: React.CSSProperties }>) => (
    <I size={18} style={{ flexShrink: 0 }} />
);

/* Items are named constants and groups reference them directly, so a group
   can never point at a nav item that doesn't exist (the old label-string
   lookup silently dropped items when the strings drifted). */
const dashboard: NavItem = { label: 'Dashboard', href: '/dashboard', roles: [...staffRoles, 'STAFF'], icon: icon(LayoutDashboard) };
const studentDashboard: NavItem = { label: 'Dashboard', href: '/student/dashboard', roles: ['STUDENT'], icon: icon(LayoutDashboard) };
const examsMarks: NavItem = { label: 'Exams & Marks', shortLabel: 'Exams', href: '/dashboard/exams-marks', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], module: 'exams', icon: icon(ClipboardList) };
const reports: NavItem = { label: 'Report Cards', shortLabel: 'Reports', href: '/dashboard/reports', roles: ['ADMIN', 'CLASS_TEACHER'], module: 'report_cards', icon: icon(FileText) };
const attendance: NavItem = { label: 'Attendance', href: '/dashboard/attendance', roles: ['ADMIN', 'CLASS_TEACHER'], module: 'attendance', icon: icon(CalendarCheck) };
const analytics: NavItem = { label: 'Analytics', href: '/dashboard/analytics', roles: adminRoles, module: 'analytics', icon: icon(LineChart) };
const calendar: NavItem = { label: 'Calendar', href: '/dashboard/calendar', roles: [], permissions: ['calendar.view'], module: 'calendar', icon: icon(CalendarDays) };
const examPapers: NavItem = { label: 'Exam Papers', shortLabel: 'Papers', href: '/dashboard/exam-papers', roles: [], permissions: ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'], module: 'exam_papers', icon: icon(FileLock2) };
const timetable: NavItem = { label: 'Timetable', href: '/dashboard/timetable', roles: [], permissions: ['timetable.view'], module: 'timetable', icon: icon(Clock) };
const lessonRecords: NavItem = { label: 'Professional Records', shortLabel: 'Records', href: '/dashboard/lesson-records', roles: [], permissions: ['lesson_records.write', 'lesson_records.review'], module: 'lesson_records', icon: icon(NotebookPen) };
const cbc: NavItem = { label: 'CBC Assessment', shortLabel: 'CBC', href: '/dashboard/cbc', roles: [], permissions: ['cbc.assess', 'cbc.view'], module: 'cbc_assessment', icon: icon(Target) };
const people: NavItem = { label: 'People', href: '/dashboard/people', roles: adminRoles, icon: icon(Users) };
// The same page, scoped to the class teacher's own class.
const myStudents: NavItem = { label: 'My Students', shortLabel: 'Students', href: '/dashboard/people', roles: ['CLASS_TEACHER'], icon: icon(Users) };
const classes: NavItem = { label: 'Classes', href: '/dashboard/classes', roles: adminRoles, icon: icon(School) };
const subjects: NavItem = { label: 'Subjects', href: '/dashboard/subjects', roles: adminRoles, icon: icon(BookOpen) };
// The bursar's page: the principal/admin, or anyone holding a finance duty. Learners see their own under /student/fees.
const fees: NavItem = { label: 'Fees', href: '/dashboard/fees', roles: adminRoles, permissions: ['fees.view'], module: 'fees', icon: icon(DollarSign) };
const billing: NavItem = { label: 'Billing', href: '/dashboard/billing', roles: [], permissions: ['billing.view'], module: 'fee_structures', icon: icon(Receipt) };
const expenses: NavItem = { label: 'Expenses', href: '/dashboard/expenses', roles: [], permissions: ['expenses.request', 'expenses.view', 'expenses.approve'], module: 'expenses', icon: icon(Wallet) };
const boarding: NavItem = { label: 'Boarding', href: '/dashboard/boarding', roles: [], permissions: ['boarding.view'], module: 'boarding', icon: icon(BedDouble) };
const health: NavItem = { label: 'Health', href: '/dashboard/health', roles: [], permissions: ['health.view'], module: 'health', icon: icon(HeartPulse) };
const discipline: NavItem = { label: 'Discipline', href: '/dashboard/discipline', roles: [], permissions: ['discipline.record', 'discipline.manage'], module: 'discipline', icon: icon(ShieldAlert) };
const transport: NavItem = { label: 'Transport', href: '/dashboard/transport', roles: [], permissions: ['transport.view', 'transport.drive'], module: 'transport', icon: icon(Bus) };
const library: NavItem = { label: 'Library', href: '/dashboard/library', roles: [], permissions: ['library.view'], module: 'library', icon: icon(Library) };
const inventory: NavItem = { label: 'Inventory', href: '/dashboard/inventory', roles: [], permissions: ['inventory.request', 'inventory.manage'], module: 'inventory', icon: icon(Package) };
const leave: NavItem = { label: 'Staff Leave', shortLabel: 'Leave', href: '/dashboard/leave', roles: [], permissions: ['hr.request', 'hr.manage'], module: 'staff_hr', icon: icon(Plane) };
const announcements: NavItem = { label: 'Announcements', shortLabel: 'Notices', href: '/dashboard/announcements', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF'], icon: icon(Bell) };
const assignments: NavItem = { label: 'Assignments', shortLabel: 'Tasks', href: '/dashboard/assignments', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], module: 'assignments', icon: icon(Briefcase) };
const users: NavItem = { label: 'Users', href: '/dashboard/users', roles: adminRoles, icon: icon(UserCircle) };
const settings: NavItem = { label: 'Settings', href: '/dashboard/settings', roles: adminRoles, icon: icon(Settings) };
const myResults: NavItem = { label: 'My Results', href: '/student/results', roles: ['STUDENT'], module: 'exams', icon: icon(GraduationCap) };
const mySubjects: NavItem = { label: 'My Subjects', href: '/student/subjects', roles: ['STUDENT'], icon: icon(BookOpen) };
const myAttendance: NavItem = { label: 'Attendance', href: '/student/attendance', roles: ['STUDENT'], module: 'attendance', icon: icon(CalendarCheck) };
const myTimetable: NavItem = { label: 'Timetable', href: '/student/timetable', roles: ['STUDENT'], module: 'timetable', icon: icon(Clock) };
const myFees: NavItem = { label: 'Fees', href: '/student/fees', roles: ['STUDENT'], module: 'fees', icon: icon(DollarSign) };
const myProfile: NavItem = { label: 'My Profile', href: '/student/profile', roles: ['STUDENT'], icon: icon(UserCircle) };

/** Flat list (legacy consumers + search). */
const groups: NavGroup[] = [
    { title: null, items: [dashboard, studentDashboard, myResults, mySubjects, myTimetable, myAttendance, myFees] },
    { title: 'Academics', items: [examsMarks, reports, attendance, analytics, calendar, timetable, examPapers, lessonRecords, cbc] },
    { title: 'School', items: [people, myStudents, classes, subjects] },
    { title: 'Finance', items: [fees, billing, expenses] },
    { title: 'Welfare', items: [boarding, health, discipline] },
    { title: 'Operations', items: [transport, library, inventory, leave] },
    { title: 'Communication', items: [announcements, assignments] },
];

/** Pinned to the sidebar bottom, outside the scrolling group list. */
const pinnedItems: NavItem[] = [users, settings, myProfile];

/** Flat list (access checks + search). Derived, so it can never miss an item. */
export const navItems: NavItem[] = [...groups.flatMap(g => g.items), ...pinnedItems];

/* No role yet (still loading, or signed out) shows nothing rather than
   briefly showing every signed-in user the admin menu. Students never pick up
   staff pages through a permission (they hold calendar.view, for instance). */
export function canSee(item: NavItem, viewer: NavViewer): boolean {
    const { role } = viewer;
    if (!role) return false;
    if (item.module && !viewer.hasModule(item.module)) return false;
    if (item.roles.includes(role)) return true;
    if (role === 'STUDENT' || role === 'PENDING') return false;
    return !!item.permissions?.some(p => viewer.can(p));
}

/** Home links match only themselves, not every page nested below them. */
export const EXACT_MATCH_HREFS: ReadonlySet<string> = new Set([dashboard.href, studentDashboard.href]);


/**
 * Whether a menu link covers `pathname`: its own page, or a page nested under
 * it (never a sibling that merely shares the prefix). Home links match only
 * themselves. Shared by access checks and every menu's active state.
 */
export const routeMatches = (pathname: string, href: string) =>
    pathname === href || (!EXACT_MATCH_HREFS.has(href) && pathname.startsWith(`${href}/`));

/**
 * Whether `role` may open `pathname`, judged by the most specific menu entry
 * that covers it. Pages with no entry (onboarding, redirects) stay open; the
 * page or its API still enforces anything finer.
 */
/** Every entry for the most specific page covering `pathname` (one page can have an entry per role). */
function closestEntries<T extends Pick<NavItem, 'href'>>(items: readonly T[], pathname: string): T[] {
    const matches = items.filter(item => routeMatches(pathname, item.href));
    const longest = Math.max(0, ...matches.map(m => m.href.length));
    return matches.filter(m => m.href.length === longest);
}

export function canAccessPath(pathname: string, viewer: NavViewer): boolean {
    const matches = closestEntries(navItems, pathname);
    return matches.length === 0 || matches.some(m => canSee(m, viewer));
}

/** The menu entry for the page being viewed, as this viewer's menu names it, for titles. */
export function findNavItem(pathname: string, viewer: NavViewer): NavItem | null {
    const matches = closestEntries(navItems, pathname);
    return matches.find(m => canSee(m, viewer)) ?? matches[0] ?? null;
}

export function getNavGroups(viewer: NavViewer): NavGroup[] {
    return groups
        .map(g => ({ title: g.title, items: g.items.filter(i => canSee(i, viewer)) }))
        .filter(g => g.items.length > 0);
}

export function getPinnedItems(viewer: NavViewer): NavItem[] {
    return pinnedItems.filter(i => canSee(i, viewer));
}

/* Mobile bottom bar: a curated four per role — never an arbitrary slice.
   Someone whose role has fewer (non-teaching staff) gets their duty pages in
   the free slots, so a nurse finds Health one tap away. Everything else stays
   reachable through the More sheet. */
const MOBILE_PRIMARY_SLOTS = 4;
const mobilePrimaryByRole: Record<Exclude<UserRole, 'PENDING'>, NavItem[]> = {
    ADMIN: [dashboard, examsMarks, people, fees],
    CLASS_TEACHER: [dashboard, examsMarks, attendance, reports],
    SUBJECT_TEACHER: [dashboard, examsMarks, assignments, announcements],
    STAFF: [dashboard, announcements],
    STUDENT: [studentDashboard, myResults, mySubjects],
};

export function getMobileNav(viewer: NavViewer): { primary: NavItem[]; overflow: NavItem[] } {
    const { role } = viewer;
    if (!role || role === 'PENDING') return { primary: [], overflow: [] };
    // The visibility filter first: People and My Students share a page, and
    // the one this viewer cannot see must not take the other's place.
    const visible = navItems
        .filter(i => canSee(i, viewer))
        .filter((i, idx, arr) => arr.findIndex(x => x.href === i.href) === idx);
    const curated = mobilePrimaryByRole[role].filter(i => canSee(i, viewer));
    const extra = visible.filter(i => !curated.includes(i) && !pinnedItems.includes(i));
    const primary = [...curated, ...extra].slice(0, Math.max(curated.length, MOBILE_PRIMARY_SLOTS));
    const primaryHrefs = new Set(primary.map(i => i.href));
    return { primary, overflow: visible.filter(i => !primaryHrefs.has(i.href)) };
}

export const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STAFF: '#0EA5E9',
    STUDENT: '#10B981',
    PENDING: '#F59E0B',
};
