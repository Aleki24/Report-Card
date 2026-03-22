"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth, type UserRole } from '@/components/AuthProvider';

function ThemeToggleButton({ collapsed }: { collapsed: boolean }) {
    const { theme, toggleTheme } = useTheme();
    return (
        <button
            className="hidden md:flex items-center justify-center cursor-pointer transition-colors"
            style={{
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-2)',
                marginLeft: 'var(--space-4)',
                marginRight: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                fontWeight: 500,
                gap: 'var(--space-3)',
            }}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {theme === 'dark' ? '☀️' : '🌙'}
            {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
        </button>
    );
}

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    roles: UserRole[]; // Which roles can see this link
}

const allRoles: UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        roles: allRoles,
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
        )
    },
    {
        label: 'Mark Entry',
        href: '/dashboard/marks',
        roles: ['ADMIN', 'SUBJECT_TEACHER'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
        )
    },
    {
        label: 'Exam Results',
        href: '/dashboard/exam-results',
        roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" />
            </svg>
        )
    },
    {
        label: 'Analytics',
        href: '/dashboard/analytics',
        roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        )
    },
    {
        label: 'Reports',
        href: '/dashboard/reports',
        roles: ['ADMIN', 'CLASS_TEACHER'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        )
    },
    {
        label: 'Students',
        href: '/dashboard/students',
        roles: ['ADMIN', 'CLASS_TEACHER'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        )
    },
    {
        label: 'My Results',
        href: '/dashboard/my-results',
        roles: ['STUDENT'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        )
    },
    {
        label: 'Classes',
        href: '/dashboard/classes',
        roles: ['ADMIN'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
        )
    },
    {
        label: 'Users',
        href: '/dashboard/users',
        roles: ['ADMIN'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
        )
    },
    {
        label: 'Settings',
        href: '/dashboard/settings',
        roles: ['ADMIN'],
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        )
    },
];

const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STUDENT: '#10B981',
};

interface SidebarProps {
    mobileMenuOpen?: boolean;
    setMobileMenuOpen?: (val: boolean) => void;
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen, collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const { profile, role, availableRoles, switchRole, schoolName, loading, signOut } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Filter nav items based on user role (show all if still loading or no role)
    const visibleNavItems = role
        ? navItems.filter(item => item.roles.includes(role))
        : navItems.filter(item => item.roles.includes('ADMIN')); // Fallback to admin view

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/login';
    };

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-45 ${mobileMenuOpen ? 'block' : 'hidden'}`}
                onClick={() => setMobileMenuOpen?.(false)}
            />

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 flex flex-col h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-transform duration-300 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{
                    width: collapsed ? '72px' : '260px',
                }}
            >
                {/* Logo */}
                <div style={{
                    padding: 'var(--space-6)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8B5CF6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 16,
                        color: '#fff',
                        flexShrink: 0,
                    }}>
                        RA
                    </div>
                    {!collapsed && (
                        <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                                {schoolName || 'ResultsApp'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {schoolName ? 'Student Analytics' : 'Analytics Platform'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {visibleNavItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen?.(false)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: `var(--space-3) ${collapsed ? 'var(--space-3)' : 'var(--space-4)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    color: isActive ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
                                    background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                                    textDecoration: 'none',
                                    fontSize: 14,
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'all 0.15s ease',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                }}
                            >
                                {item.icon}
                                {!collapsed && item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile Section — Clickable with dropdown */}
                {!loading && profile && (
                    <div style={{ position: 'relative', padding: '0 var(--space-4)', marginBottom: 'var(--space-2)' }}>
                        {/* Dropdown menu */}
                        {showUserMenu && (
                            <>
                                {/* Click-away overlay */}
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                                    onClick={(e) => { e.stopPropagation(); setShowUserMenu(false); }}
                                />
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 'var(--space-4)',
                                        right: 'var(--space-4)',
                                        marginBottom: 'var(--space-2)',
                                        background: 'var(--color-surface-raised)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-3)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                        zIndex: 61,
                                        minWidth: collapsed ? 200 : 'auto',
                                    }}>
                                    {/* User info */}
                                    <div style={{
                                        padding: 'var(--space-2) var(--space-3)',
                                        marginBottom: 'var(--space-2)',
                                    }}>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                                            {profile.first_name} {profile.last_name}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                            {profile.email || 'No email set'}
                                        </div>
                                        <div style={{
                                            display: 'inline-block',
                                            marginTop: 'var(--space-2)',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            background: `${roleBadgeColors[profile.role]}20`,
                                            color: roleBadgeColors[profile.role],
                                            border: `1px solid ${roleBadgeColors[profile.role]}40`,
                                        }}>
                                            {role?.replace('_', ' ')}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-2) 0' }} />

                                    {/* Role Switcher if applicable */}
                                    {availableRoles.length > 1 && (
                                        <div style={{ padding: '0 0 var(--space-2) 0' }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                                Switch Role
                                            </div>
                                            {availableRoles.map(r => (
                                                <button
                                                    key={r}
                                                    onClick={async () => {
                                                        await switchRole(r);
                                                        setShowUserMenu(false);
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        width: '100%',
                                                        padding: 'var(--space-2) var(--space-3)',
                                                        background: role === r ? 'var(--color-surface-hover)' : 'transparent',
                                                        border: 'none',
                                                        color: role === r ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                                        fontSize: 13,
                                                        fontWeight: role === r ? 600 : 400,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (role !== r) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                                                    onMouseLeave={e => { if (role !== r) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                        <div style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: roleBadgeColors[r],
                                                        }} />
                                                        {r.replace('_', ' ')}
                                                    </div>
                                                    {role === r && (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                            <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-2) 0 0 0' }} />
                                        </div>
                                    )}

                                    {/* Sign Out button */}
                                    <button
                                        onClick={handleSignOut}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-3)',
                                            width: '100%',
                                            padding: 'var(--space-2) var(--space-3)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#EF4444',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        Sign Out
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Clickable profile button */}
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                width: '100%',
                                padding: 'var(--space-3) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                background: showUserMenu ? 'var(--color-surface-raised)' : 'transparent',
                                border: '1px solid transparent',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                            onMouseEnter={e => {
                                if (!showUserMenu) e.currentTarget.style.background = 'var(--color-surface-raised)';
                            }}
                            onMouseLeave={e => {
                                if (!showUserMenu) e.currentTarget.style.background = 'transparent';
                            }}
                            title={collapsed ? `${profile.first_name} ${profile.last_name} — ${role?.replace('_', ' ')}` : undefined}
                        >
                            <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: roleBadgeColors[profile.role] || 'var(--color-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#fff',
                                flexShrink: 0,
                            }}>
                                {profile.first_name[0]}{profile.last_name[0]}
                            </div>
                            {!collapsed && (
                                <>
                                    <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {profile.first_name} {profile.last_name}
                                        </div>
                                        <div style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: roleBadgeColors[profile.role],
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}>
                                            {role?.replace('_', ' ')}
                                        </div>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Theme Toggle */}
                <ThemeToggleButton collapsed={collapsed} />

                {/* Collapse Toggle */}
                <button
                    className="hidden md:flex items-center justify-center cursor-pointer transition-colors"
                    style={{
                        padding: 'var(--space-3) var(--space-4)',
                        marginBottom: 'var(--space-4)',
                        marginLeft: 'var(--space-4)',
                        marginRight: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 14,
                        fontWeight: 500,
                    }}
                    onClick={() => setCollapsed?.(!collapsed)}
                >
                    {collapsed ? '→' : '← Collapse'}
                </button>
            </aside>
        </>
    );
}
