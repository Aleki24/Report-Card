"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import {
    LayoutDashboard, User, BookOpen, Trophy, FileText,
    CalendarCheck, TrendingUp, Bell, ChevronRight, LogOut, Moon, Sun
} from 'lucide-react';

const studentNavItems = [
    { label: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Profile', href: '/student/profile', icon: User },
    { label: 'Subjects', href: '/student/subjects', icon: BookOpen },
    { label: 'My Results', href: '/student/results', icon: Trophy },
    { label: 'Attendance', href: '/student/attendance', icon: CalendarCheck },
];

const mobileNavItems = studentNavItems.slice(0, 4);

export default function StudentPortalContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [collapsed, setCollapsed] = useState(true);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const displayName = profile ? `${profile.first_name} ${profile.last_name}` : 'Student';
    const initials = profile
        ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
        : 'ST';

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/login';
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Mobile Top Bar */}
            <div className="student-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, color: '#fff',
                    }}>{initials}</div>
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Student Portal</div>
                    </div>
                </div>
                <button
                    onClick={toggleTheme}
                    style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-raised)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--color-text-secondary)',
                    }}
                >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            </div>

            {/* Desktop Sidebar */}
            <aside
                className="student-sidebar"
                onMouseEnter={() => setCollapsed(false)}
                onMouseLeave={() => setCollapsed(true)}
                style={{ width: collapsed ? '80px' : '260px' }}
            >
                {/* Brand */}
                <div style={{
                    padding: collapsed ? 'var(--space-5) var(--space-3)' : 'var(--space-5) var(--space-4)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 'var(--space-3)',
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                    }}>{initials}</div>
                    {!collapsed && (
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{
                                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>Student Portal</div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{
                    flex: 1, overflowY: 'auto',
                    padding: collapsed ? 'var(--space-3)' : 'var(--space-4)',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                    {studentNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 'var(--space-3)',
                                    minHeight: collapsed ? 38 : 42,
                                    padding: collapsed ? 'var(--space-2)' : '10px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                                    background: isActive ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                                    textDecoration: 'none', fontSize: 14, fontWeight: isActive ? 600 : 500,
                                    transition: 'all 0.15s ease',
                                    boxShadow: isActive ? '0 4px 12px rgba(16,185,129,0.25)' : 'none',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'var(--color-surface-hover, var(--color-surface-raised))';
                                        e.currentTarget.style.color = 'var(--color-text)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                                    }
                                }}
                            >
                                <Icon size={18} style={{ flexShrink: 0 }} />
                                {!collapsed && <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div style={{
                    padding: collapsed ? 'var(--space-3)' : 'var(--space-3) var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                    <button
                        onClick={toggleTheme}
                        style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 'var(--space-3)',
                            minHeight: 38, padding: collapsed ? 'var(--space-2)' : '8px 14px',
                            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                            background: 'transparent', color: 'var(--color-text-secondary)',
                            fontSize: 14, fontWeight: 500, width: '100%',
                        }}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
                    </button>
                    <button
                        onClick={handleSignOut}
                        style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 'var(--space-3)',
                            minHeight: 38, padding: collapsed ? 'var(--space-2)' : '8px 14px',
                            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                            background: 'transparent', color: 'var(--color-danger)',
                            fontSize: 14, fontWeight: 500, width: '100%',
                        }}
                    >
                        <LogOut size={18} />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <nav className="student-bottom-nav">
                {mobileNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setShowMoreMenu(false)}
                            style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                flex: 1, minWidth: 0, height: '100%',
                                position: 'relative', textDecoration: 'none',
                                color: isActive ? '#10B981' : 'var(--color-text-secondary)',
                            }}
                        >
                            {isActive && (
                                <div style={{
                                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                    width: '40%', height: 3,
                                    background: 'linear-gradient(90deg, #10B981, #059669)',
                                    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
                                }} />
                            )}
                            <div style={{
                                transform: isActive ? 'translateY(-2px)' : 'none',
                                transition: 'all 0.2s ease', opacity: isActive ? 1 : 0.7,
                            }}>
                                <Icon size={20} />
                            </div>
                            <span style={{
                                fontSize: 10, fontWeight: isActive ? 600 : 500, marginTop: 3,
                                opacity: isActive ? 1 : 0.7, whiteSpace: 'nowrap',
                            }}>{item.label}</span>
                        </Link>
                    );
                })}

                {/* More Button */}
                <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        flex: 1, minWidth: 0, height: '100%',
                        position: 'relative', background: 'none', border: 'none',
                        cursor: 'pointer',
                        color: showMoreMenu ? '#10B981' : 'var(--color-text-secondary)',
                    }}
                >
                    {showMoreMenu && (
                        <div style={{
                            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                            width: '40%', height: 3,
                            background: 'linear-gradient(90deg, #10B981, #059669)',
                            borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
                        }} />
                    )}
                    <div style={{
                        transform: showMoreMenu ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease', opacity: showMoreMenu ? 1 : 0.7,
                    }}>
                        <ChevronRight size={20} />
                    </div>
                    <span style={{
                        fontSize: 10, fontWeight: showMoreMenu ? 600 : 500, marginTop: 3,
                        opacity: showMoreMenu ? 1 : 0.7,
                    }}>More</span>
                </button>
            </nav>

            {/* Mobile More Menu Overlay */}
            {showMoreMenu && (
                <>
                    <div
                        style={{
                            position: 'fixed', inset: 0, zIndex: 60,
                            background: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(4px)',
                        }}
                        onClick={() => setShowMoreMenu(false)}
                    />
                    <div
                        className="student-more-menu"
                    >
                        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>More Options</h3>
                        </div>
                        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {studentNavItems.slice(4).map(item => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowMoreMenu(false)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                            padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                            textDecoration: 'none', fontSize: 14, fontWeight: 500,
                                            color: isActive ? '#fff' : 'var(--color-text-secondary)',
                                            background: isActive ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                                        }}
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                            <button
                                onClick={toggleTheme}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                    width: '100%', border: 'none', cursor: 'pointer',
                                    background: 'transparent', color: 'var(--color-text-secondary)',
                                    fontSize: 14, fontWeight: 500,
                                }}
                            >
                                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                            </button>
                            <button
                                onClick={handleSignOut}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                    width: '100%', border: 'none', cursor: 'pointer',
                                    background: 'transparent', color: 'var(--color-danger)',
                                    fontSize: 14, fontWeight: 500,
                                }}
                            >
                                <LogOut size={18} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Main Content */}
            <main className="student-main">
                {children}
            </main>
        </div>
    );
}
