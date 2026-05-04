"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth, type UserRole } from '@/components/AuthProvider';
import { LayoutDashboard, PenTool, GraduationCap, LineChart, FileText, Users, Trophy, School, UserCircle, Settings, BookOpen, Home } from 'lucide-react';

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
            suppressHydrationWarning
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
        label: 'Homepage',
        href: '/',
        roles: allRoles,
        icon: <Home size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Dashboard',
        href: '/dashboard',
        roles: allRoles,
        icon: <LayoutDashboard size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Mark Entry',
        href: '/dashboard/marks',
        roles: ['ADMIN', 'SUBJECT_TEACHER'],
        icon: <PenTool size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Exam Results',
        href: '/dashboard/exam-results',
        roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'],
        icon: <GraduationCap size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Analytics',
        href: '/dashboard/analytics',
        roles: ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'],
        icon: <LineChart size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Reports',
        href: '/dashboard/reports',
        roles: ['ADMIN', 'CLASS_TEACHER'],
        icon: <FileText size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Students',
        href: '/dashboard/students',
        roles: ['ADMIN', 'CLASS_TEACHER'],
        icon: <Users size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'My Results',
        href: '/dashboard/my-results',
        roles: ['STUDENT'],
        icon: <Trophy size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Classes',
        href: '/dashboard/classes',
        roles: ['ADMIN'],
        icon: <School size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Users',
        href: '/dashboard/users',
        roles: ['ADMIN', 'CLASS_TEACHER'],
        icon: <UserCircle size={24} style={{ flexShrink: 0 }} />
    },
    {
        label: 'Settings',
        href: '/dashboard/settings',
        roles: ['ADMIN'],
        icon: <Settings size={24} style={{ flexShrink: 0 }} />
    },
];

const roleBadgeColors: Record<UserRole, string> = {
    ADMIN: '#EF4444',
    CLASS_TEACHER: '#3B82F6',
    SUBJECT_TEACHER: '#8B5CF6',
    STUDENT: '#10B981',
};

interface SidebarProps {
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

export function Sidebar({ collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const { profile, role, availableRoles, switchRole, schoolName, loading, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Filter nav items based on user role (show all if still loading or no role)
    const visibleNavItems = role
        ? navItems.filter(item => item.roles.includes(role))
        : navItems.filter(item => item.roles.includes('ADMIN')); // Fallback to admin view

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/login';
    };

    const maxBottomItems = 4;
    // Always show the More button on mobile so sign-out is always accessible
    const mainBottomItems = visibleNavItems.slice(0, maxBottomItems);
    const overflowItems = visibleNavItems.slice(maxBottomItems);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className="hidden md:flex fixed top-0 left-0 z-50 flex-col h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out"
                style={{
                    width: collapsed ? '72px' : '260px',
                }}
            >
                {/* Logo */}
                <Link href="/" style={{
                    padding: 'var(--space-6)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'opacity 0.15s ease',
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
                                {schoolName || 'Matokeo'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {schoolName ? 'Student Analytics' : 'Analytics Platform'}
                            </div>
                        </div>
                    )}
                </Link>

                {/* Navigation */}
                <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {visibleNavItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
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
                    suppressHydrationWarning
                >
                    {collapsed ? '→' : '← Collapse'}
                </button>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center overflow-x-auto shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    height: 'calc(64px + env(safe-area-inset-bottom))',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE and Edge
                }}
            >
                <style>{`
                    nav::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {mainBottomItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setShowMoreMenu(false)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flex: 1,
                                minWidth: '0',
                                height: '100%',
                                position: 'relative',
                                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                textDecoration: 'none',
                            }}
                        >
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '40%',
                                    height: 3,
                                    background: 'linear-gradient(90deg, var(--color-accent), #8B5CF6)',
                                    borderBottomLeftRadius: 3,
                                    borderBottomRightRadius: 3,
                                }} />
                            )}
                            <div style={{ 
                                transform: isActive ? 'translateY(-2px)' : 'none', 
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: isActive ? 1 : 0.7
                            }}>
                                {item.icon}
                            </div>
                            <span style={{
                                fontSize: 10,
                                fontWeight: isActive ? 600 : 500,
                                marginTop: 4,
                                opacity: isActive ? 1 : 0.7,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%'
                            }}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* The "More" Button - always visible so sign-out is accessible */}
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            minWidth: '0',
                            height: '100%',
                            position: 'relative',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: showMoreMenu ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        }}
                    >
                        {showMoreMenu && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '40%',
                                height: 3,
                                background: 'linear-gradient(90deg, var(--color-accent), #8B5CF6)',
                                borderBottomLeftRadius: 3,
                                borderBottomRightRadius: 3,
                            }} />
                        )}
                        <div style={{ 
                            transform: showMoreMenu ? 'translateY(-2px)' : 'none', 
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: showMoreMenu ? 1 : 0.7,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {/* SVG Arrow representing More */}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 16 16 12 12 8" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                        </div>
                        <span style={{
                            fontSize: 10,
                            fontWeight: showMoreMenu ? 600 : 500,
                            marginTop: 4,
                            opacity: showMoreMenu ? 1 : 0.7,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            More
                        </span>
                    </button>
            </nav>

            {/* Mobile More Pop-up Menu */}
            {showMoreMenu && (
                <div 
                    className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    onClick={() => setShowMoreMenu(false)}
                >
                    <div 
                        className="absolute shadow-2xl overflow-hidden"
                        style={{ 
                            bottom: 'calc(80px + env(safe-area-inset-bottom))', 
                            right: '16px', 
                            width: '220px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '16px',
                            padding: '8px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border)',
                            marginBottom: '8px',
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <BookOpen size={20} />
                            All Pages
                        </div>
                        {overflowItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setShowMoreMenu(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                                        background: isActive ? 'var(--color-accent-transparent)' : 'transparent',
                                        textDecoration: 'none',
                                        fontWeight: isActive ? 600 : 500,
                                        fontSize: '14px',
                                    }}
                                >
                                    <div style={{
                                        opacity: isActive ? 1 : 0.7,
                                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                    }}>
                                        {item.icon}
                                    </div>
                                    {item.label}
                                </Link>
                            );
                        })}
                        
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0 8px 0' }} />
                            
                            {/* Mobile Theme Toggle */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTheme();
                                    setShowMoreMenu(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    width: '100%',
                                    borderRadius: '8px',
                                    color: 'var(--color-text)',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                <span style={{ opacity: 0.7, fontSize: '18px' }}>
                                    {theme === 'dark' ? '☀️' : '🌙'}
                                </span>
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </button>

                            {/* Mobile Sign Out */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSignOut();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    width: '100%',
                                    borderRadius: '8px',
                                    color: '#EF4444',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    marginTop: '4px'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
