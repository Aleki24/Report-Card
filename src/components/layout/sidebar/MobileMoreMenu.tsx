"use client";

import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { type NavItem, roleBadgeColors } from './navItems';
import type { UserRole } from '@/types';

interface MobileMoreMenuProps {
    showMoreMenu: boolean;
    setShowMoreMenu: (val: boolean) => void;
    overflowItems: NavItem[];
    pathname: string;
    theme: string;
    toggleTheme: () => void;
    onSignOut: () => void;
    role: UserRole | null;
    availableRoles: UserRole[];
    switchRole: (role: UserRole) => Promise<void>;
}

export function MobileMoreMenu({
    showMoreMenu, setShowMoreMenu, overflowItems, pathname,
    theme, toggleTheme, onSignOut, role, availableRoles, switchRole,
}: MobileMoreMenuProps) {
    if (!showMoreMenu) return null;

    return (
        <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMoreMenu(false)}
        >
            <div
                className="absolute shadow-2xl overflow-hidden"
                style={{
                    bottom: 'calc(80px + env(safe-area-inset-bottom))',
                    right: '16px', width: '220px',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: '16px', padding: '8px'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                    marginBottom: '8px', fontWeight: 600, color: 'var(--color-text)',
                    fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
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
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px', borderRadius: '8px',
                                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                                background: isActive ? 'var(--color-accent-transparent)' : 'transparent',
                                textDecoration: 'none', fontWeight: isActive ? 600 : 500, fontSize: '14px',
                            }}
                        >
                            <div style={{ opacity: isActive ? 1 : 0.7, color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                                {item.icon}
                            </div>
                            {item.label}
                        </Link>
                    );
                })}

                {availableRoles.length > 1 && (
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0 8px 0' }} />
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 16px', marginBottom: '8px' }}>
                            Switch Role
                        </div>
                        {availableRoles.map(r => (
                            <button
                                key={r}
                                onClick={async () => { await switchRole(r); setShowMoreMenu(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    width: '100%', padding: '10px 16px',
                                    background: role === r ? 'var(--color-surface-hover)' : 'transparent',
                                    border: 'none', color: role === r ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                    fontSize: 14, fontWeight: role === r ? 600 : 400, cursor: 'pointer',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: roleBadgeColors[r] }} />
                                    {r.replace('_', ' ')}
                                </div>
                                {role === r && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ padding: '8px 0' }}>
                    <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0 8px 0' }} />

                    {/* Theme Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleTheme(); setShowMoreMenu(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', width: '100%', borderRadius: '8px',
                            color: 'var(--color-text)', background: 'transparent', border: 'none',
                            textAlign: 'left', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        <span style={{ opacity: 0.7, fontSize: '18px' }}>
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </span>
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>

                    {/* Sign Out */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onSignOut(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', width: '100%', borderRadius: '8px',
                            color: '#EF4444', background: 'transparent', border: 'none',
                            textAlign: 'left', fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginTop: '4px'
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
    );
}
