import React from 'react';
import { LayoutDashboard, PenTool, GraduationCap, LineChart, FileText, Users, Trophy, School, UserCircle, Settings, BookOpen, Home, ClipboardList, CalendarCheck, Heart, Bell, Briefcase, DollarSign } from 'lucide-react';
import { type UserRole } from '@/components/AuthProvider';

export interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    roles: UserRole[];
}

const allRoles: UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];

export const navItems: NavItem[] = [
    { label: 'Homepage', href: '/', roles: allRoles, icon: <Home size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Dashboard', href: '/dashboard', roles: allRoles, icon: <LayoutDashboard size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Report Cards', href: '/dashboard/reports', roles: ['ADMIN', 'CLASS_TEACHER'], icon: <FileText size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Students', href: '/dashboard/students', roles: ['ADMIN', 'CLASS_TEACHER'], icon: <Users size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Teachers', href: '/dashboard/teachers', roles: ['ADMIN'], icon: <GraduationCap size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Classes', href: '/dashboard/classes', roles: ['ADMIN'], icon: <School size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Subjects', href: '/dashboard/subjects', roles: ['ADMIN'], icon: <BookOpen size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Exams', href: '/dashboard/exams', roles: ['ADMIN', 'SUBJECT_TEACHER'], icon: <ClipboardList size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Mark Entry', href: '/dashboard/marks', roles: ['ADMIN', 'SUBJECT_TEACHER'], icon: <PenTool size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Exam Results', href: '/dashboard/exam-results', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: <Trophy size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Attendance', href: '/dashboard/attendance', roles: ['ADMIN', 'CLASS_TEACHER'], icon: <CalendarCheck size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Parents', href: '/dashboard/parents', roles: ['ADMIN'], icon: <Heart size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Analytics', href: '/dashboard/analytics', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: <LineChart size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Users', href: '/dashboard/users', roles: ['ADMIN', 'CLASS_TEACHER'], icon: <UserCircle size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Announcements', href: '/dashboard/announcements', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: <Bell size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Assignments', href: '/dashboard/assignments', roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'], icon: <Briefcase size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Fees', href: '/dashboard/fees', roles: ['ADMIN', 'CLASS_TEACHER'], icon: <DollarSign size={18} style={{ flexShrink: 0 }} /> },
    { label: 'Settings', href: '/dashboard/settings', roles: ['ADMIN'], icon: <Settings size={18} style={{ flexShrink: 0 }} /> },
];

export const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STUDENT: '#10B981',
};
