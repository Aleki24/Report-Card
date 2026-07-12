import React from 'react';
import {
    LayoutDashboard, GraduationCap, LineChart, FileText, Users, School,
    UserCircle, Settings, BookOpen, ClipboardList, CalendarCheck, Bell,
    Briefcase, DollarSign,
} from 'lucide-react';
import { type UserRole } from '@/components/AuthProvider';

export interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    roles: UserRole[];
}

export interface NavGroup {
    /** null = no group header (top-level items like Dashboard). */
    title: string | null;
    items: NavItem[];
}

const allRoles: UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];
const adminRoles: UserRole[] = ['ADMIN'];

const icon = (I: React.ComponentType<{ size?: number; style?: React.CSSProperties }>) => (
    <I size={18} style={{ flexShrink: 0 }} />
);

/* Items are named constants and groups reference them directly, so a group
   can never point at a nav item that doesn't exist (the old label-string
   lookup silently dropped items when the strings drifted). */
const dashboard: NavItem = { label: 'Dashboard', href: '/dashboard', roles: allRoles, icon: icon(LayoutDashboard) };
const examsMarks: NavItem = { label: 'Exams & Marks', href: '/dashboard/exams-marks', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: icon(ClipboardList) };
const reports: NavItem = { label: 'Report Cards', href: '/dashboard/reports', roles: ['ADMIN', 'CLASS_TEACHER'], icon: icon(FileText) };
const attendance: NavItem = { label: 'Attendance', href: '/dashboard/attendance', roles: ['ADMIN', 'CLASS_TEACHER'], icon: icon(CalendarCheck) };
const analytics: NavItem = { label: 'Analytics', href: '/dashboard/analytics', roles: adminRoles, icon: icon(LineChart) };
const people: NavItem = { label: 'People', href: '/dashboard/people', roles: ['ADMIN', 'CLASS_TEACHER'], icon: icon(Users) };
const classes: NavItem = { label: 'Classes', href: '/dashboard/classes', roles: adminRoles, icon: icon(School) };
const subjects: NavItem = { label: 'Subjects', href: '/dashboard/subjects', roles: adminRoles, icon: icon(BookOpen) };
const fees: NavItem = { label: 'Fees', href: '/dashboard/fees', roles: ['ADMIN', 'CLASS_TEACHER'], icon: icon(DollarSign) };
const announcements: NavItem = { label: 'Announcements', href: '/dashboard/announcements', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: icon(Bell) };
const assignments: NavItem = { label: 'Assignments', href: '/dashboard/assignments', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: icon(Briefcase) };
const users: NavItem = { label: 'Users', href: '/dashboard/users', roles: adminRoles, icon: icon(UserCircle) };
const settings: NavItem = { label: 'Settings', href: '/dashboard/settings', roles: adminRoles, icon: icon(Settings) };
const myResults: NavItem = { label: 'My Results', href: '/student/results', roles: ['STUDENT'], icon: icon(GraduationCap) };

/** Flat list (legacy consumers + search). */
export const navItems: NavItem[] = [
    dashboard, examsMarks, reports, attendance, analytics, people, classes,
    subjects, fees, announcements, assignments, users, settings, myResults,
];

const groups: NavGroup[] = [
    { title: null, items: [dashboard, myResults] },
    { title: 'Academics', items: [examsMarks, reports, attendance, analytics] },
    { title: 'School', items: [people, classes, subjects] },
    { title: 'Finance', items: [fees] },
    { title: 'Communication', items: [announcements, assignments] },
];

/** Pinned to the sidebar bottom, outside the scrolling group list. */
const pinnedItems: NavItem[] = [users, settings];

const forRole = (item: NavItem, role: UserRole | null) =>
    item.roles.includes(role ?? 'ADMIN');

export function getNavGroups(role: UserRole | null): NavGroup[] {
    return groups
        .map(g => ({ title: g.title, items: g.items.filter(i => forRole(i, role)) }))
        .filter(g => g.items.length > 0);
}

export function getPinnedItems(role: UserRole | null): NavItem[] {
    return pinnedItems.filter(i => forRole(i, role));
}

/* Mobile bottom bar: a curated four per role — never an arbitrary slice.
   Everything else stays reachable through the More sheet. */
const mobilePrimaryByRole: Record<Exclude<UserRole, 'PENDING'>, NavItem[]> = {
    ADMIN: [dashboard, examsMarks, people, fees],
    CLASS_TEACHER: [dashboard, examsMarks, attendance, reports],
    SUBJECT_TEACHER: [dashboard, examsMarks, assignments, announcements],
    STUDENT: [dashboard, myResults],
};

export function getMobileNav(role: UserRole | null): { primary: NavItem[]; overflow: NavItem[] } {
    const effective = role && role !== 'PENDING' ? role : 'ADMIN';
    const primary = mobilePrimaryByRole[effective].filter(i => forRole(i, effective));
    const primaryHrefs = new Set(primary.map(i => i.href));
    const overflow = [...navItems, ...pinnedItems]
        .filter((i, idx, arr) => arr.findIndex(x => x.href === i.href) === idx)
        .filter(i => forRole(i, effective) && !primaryHrefs.has(i.href));
    return { primary, overflow };
}

export const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STUDENT: '#10B981',
    PENDING: '#F59E0B',
};
