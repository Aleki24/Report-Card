import React from 'react';
import {
    LayoutDashboard, GraduationCap, LineChart, FileText, Users, School,
    UserCircle, Settings, BookOpen, ClipboardList, CalendarCheck, Bell,
    Briefcase, DollarSign, CalendarDays, FileLock2, Clock, NotebookPen, Target,
    Receipt, Wallet, BedDouble, HeartPulse, ShieldAlert, Bus, Library, Package, Plane, HeartHandshake,
} from 'lucide-react';
import { type UserRole } from '@/components/AuthProvider';
import { PAGE_ACCESS, canViewPage, type PageAccess, type PageViewer } from '@/lib/platform/pages';

/** A menu entry: who may open the page (shared with the mobile app) plus how it is shown. */
export interface NavItem extends PageAccess {
    label: string;
    /** Shorter name for the phone's bottom bar, where each tab is a fifth of the width. */
    shortLabel?: string;
    href: string;
    icon: React.ReactNode;
}

/** Who is looking at the menu: their role and what their duties and school allow. */
export type NavViewer = PageViewer;

export interface NavGroup {
    /** null = no group header (top-level items like Dashboard). */
    title: string | null;
    items: NavItem[];
}

const icon = (I: React.ComponentType<{ size?: number; style?: React.CSSProperties }>) => (
    <I size={18} style={{ flexShrink: 0 }} />
);

/* Items are named constants and groups reference them directly, so a group
   can never point at a nav item that doesn't exist (the old label-string
   lookup silently dropped items when the strings drifted). */
const dashboard: NavItem = { label: 'Dashboard', href: '/dashboard', ...PAGE_ACCESS.dashboard, icon: icon(LayoutDashboard) };
const studentDashboard: NavItem = { label: 'Dashboard', href: '/student/dashboard', ...PAGE_ACCESS.studentDashboard, icon: icon(LayoutDashboard) };
const examsMarks: NavItem = { label: 'Exams & Marks', shortLabel: 'Exams', href: '/dashboard/exams-marks', ...PAGE_ACCESS.examsMarks, icon: icon(ClipboardList) };
const reports: NavItem = { label: 'Report Cards', shortLabel: 'Reports', href: '/dashboard/reports', ...PAGE_ACCESS.reports, icon: icon(FileText) };
const attendance: NavItem = { label: 'Attendance', href: '/dashboard/attendance', ...PAGE_ACCESS.attendance, icon: icon(CalendarCheck) };
const analytics: NavItem = { label: 'Analytics', href: '/dashboard/analytics', ...PAGE_ACCESS.analytics, icon: icon(LineChart) };
const calendar: NavItem = { label: 'Calendar', href: '/dashboard/calendar', ...PAGE_ACCESS.calendar, icon: icon(CalendarDays) };
const examPapers: NavItem = { label: 'Exam Papers', shortLabel: 'Papers', href: '/dashboard/exam-papers', ...PAGE_ACCESS.examPapers, icon: icon(FileLock2) };
const timetable: NavItem = { label: 'Timetable', href: '/dashboard/timetable', ...PAGE_ACCESS.timetable, icon: icon(Clock) };
const lessonRecords: NavItem = { label: 'Professional Records', shortLabel: 'Records', href: '/dashboard/lesson-records', ...PAGE_ACCESS.lessonRecords, icon: icon(NotebookPen) };
const cbc: NavItem = { label: 'CBC Assessment', shortLabel: 'CBC', href: '/dashboard/cbc', ...PAGE_ACCESS.cbc, icon: icon(Target) };
const people: NavItem = { label: 'People', href: '/dashboard/people', ...PAGE_ACCESS.people, icon: icon(Users) };
// The same page, scoped to the class teacher's own class.
const myStudents: NavItem = { label: 'My Students', shortLabel: 'Students', href: '/dashboard/people', ...PAGE_ACCESS.myStudents, icon: icon(Users) };
const parentAccounts: NavItem = { label: 'Parent accounts', shortLabel: 'Parents', href: '/dashboard/parent-accounts', ...PAGE_ACCESS.parentAccounts, icon: icon(HeartHandshake) };
const classes: NavItem = { label: 'Classes', href: '/dashboard/classes', ...PAGE_ACCESS.classes, icon: icon(School) };
const subjects: NavItem = { label: 'Subjects', href: '/dashboard/subjects', ...PAGE_ACCESS.subjects, icon: icon(BookOpen) };
// The bursar's page: the principal/admin, or anyone holding a finance duty. Learners see their own under /student/fees.
const fees: NavItem = { label: 'Fees', href: '/dashboard/fees', ...PAGE_ACCESS.fees, icon: icon(DollarSign) };
const billing: NavItem = { label: 'Billing', href: '/dashboard/billing', ...PAGE_ACCESS.billing, icon: icon(Receipt) };
const expenses: NavItem = { label: 'Expenses', href: '/dashboard/expenses', ...PAGE_ACCESS.expenses, icon: icon(Wallet) };
const boarding: NavItem = { label: 'Boarding', href: '/dashboard/boarding', ...PAGE_ACCESS.boarding, icon: icon(BedDouble) };
const health: NavItem = { label: 'Health', href: '/dashboard/health', ...PAGE_ACCESS.health, icon: icon(HeartPulse) };
const discipline: NavItem = { label: 'Discipline', href: '/dashboard/discipline', ...PAGE_ACCESS.discipline, icon: icon(ShieldAlert) };
const transport: NavItem = { label: 'Transport', href: '/dashboard/transport', ...PAGE_ACCESS.transport, icon: icon(Bus) };
const library: NavItem = { label: 'Library', href: '/dashboard/library', ...PAGE_ACCESS.library, icon: icon(Library) };
const inventory: NavItem = { label: 'Inventory', href: '/dashboard/inventory', ...PAGE_ACCESS.inventory, icon: icon(Package) };
const leave: NavItem = { label: 'Staff Leave', shortLabel: 'Leave', href: '/dashboard/leave', ...PAGE_ACCESS.leave, icon: icon(Plane) };
const announcements: NavItem = { label: 'Announcements', shortLabel: 'Notices', href: '/dashboard/announcements', ...PAGE_ACCESS.announcements, icon: icon(Bell) };
const assignments: NavItem = { label: 'Assignments', shortLabel: 'Tasks', href: '/dashboard/assignments', ...PAGE_ACCESS.assignments, icon: icon(Briefcase) };
const users: NavItem = { label: 'Users', href: '/dashboard/users', ...PAGE_ACCESS.users, icon: icon(UserCircle) };
const settings: NavItem = { label: 'Settings', href: '/dashboard/settings', ...PAGE_ACCESS.settings, icon: icon(Settings) };
const myResults: NavItem = { label: 'My Results', href: '/student/results', ...PAGE_ACCESS.myResults, icon: icon(GraduationCap) };
const mySubjects: NavItem = { label: 'My Subjects', href: '/student/subjects', ...PAGE_ACCESS.mySubjects, icon: icon(BookOpen) };
const myAttendance: NavItem = { label: 'Attendance', href: '/student/attendance', ...PAGE_ACCESS.myAttendance, icon: icon(CalendarCheck) };
const myTimetable: NavItem = { label: 'Timetable', href: '/student/timetable', ...PAGE_ACCESS.myTimetable, icon: icon(Clock) };
const myFees: NavItem = { label: 'Fees', href: '/student/fees', ...PAGE_ACCESS.myFees, icon: icon(DollarSign) };
const parentHome: NavItem = { label: 'My children', shortLabel: 'Children', href: '/parent', ...PAGE_ACCESS.parentHome, icon: icon(Users) };
const myProfile: NavItem = { label: 'My Profile', href: '/student/profile', ...PAGE_ACCESS.myProfile, icon: icon(UserCircle) };

/** Flat list (legacy consumers + search). */
const groups: NavGroup[] = [
    { title: null, items: [dashboard, studentDashboard, parentHome, myResults, mySubjects, myTimetable, myAttendance, myFees] },
    { title: 'Academics', items: [examsMarks, reports, attendance, analytics, calendar, timetable, examPapers, lessonRecords, cbc] },
    { title: 'School', items: [people, myStudents, parentAccounts, classes, subjects] },
    { title: 'Finance', items: [fees, billing, expenses] },
    { title: 'Welfare', items: [boarding, health, discipline] },
    { title: 'Operations', items: [transport, library, inventory, leave] },
    { title: 'Communication', items: [announcements, assignments] },
];

/** Pinned to the sidebar bottom, outside the scrolling group list. */
const pinnedItems: NavItem[] = [users, settings, myProfile];

/** Flat list (access checks + search). Derived, so it can never miss an item. */
export const navItems: NavItem[] = [...groups.flatMap(g => g.items), ...pinnedItems];

export const canSee: (item: NavItem, viewer: NavViewer) => boolean = canViewPage;

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
    PARENT: [parentHome],
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
    PARENT: '#EC4899',
    PENDING: '#F59E0B',
};
