"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
        )
    },
    {
        label: 'Mark Entry',
        href: '/dashboard/marks',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
        )
    },
    {
        label: 'Analytics',
        href: '/dashboard/analytics',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        )
    },
    {
        label: 'Reports',
        href: '/dashboard/reports',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        )
    },
    {
        label: 'Students',
        href: '/dashboard/students',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        )
    },
];

interface SidebarProps {
    mobileMenuOpen?: boolean;
    setMobileMenuOpen?: (val: boolean) => void;
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen, collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-45 ${mobileMenuOpen ? 'block' : 'hidden'}`}
                onClick={() => setMobileMenuOpen?.(false)}
            />

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 flex flex-col min-h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-transform duration-300 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
                                ResultsApp
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                Analytics Platform
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {navItems.map((item) => {
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

                {/* Collapse Toggle */}
                <button
                    className="hidden md:flex items-center justify-center mt-auto cursor-pointer transition-colors"
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
