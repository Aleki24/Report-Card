"use client";

import React from 'react';
import { type UserRole } from '@/components/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { roleBadgeColors } from './navItems';

interface DesktopUserMenuProps {
    profile: { id: string; first_name: string; last_name: string; email?: string | null; role: UserRole; imageUrl?: string | null };
    role: UserRole | null;
    baseRole: UserRole | null;
    availableRoles: UserRole[];
    collapsed: boolean;
    showUserMenu: boolean;
    setShowUserMenu: (val: boolean) => void;
    switchRole: (role: UserRole) => Promise<void>;
    onSignOut: () => void;
}

export function DesktopUserMenu({
    profile, role, baseRole, availableRoles, collapsed,
    showUserMenu, setShowUserMenu, switchRole, onSignOut
}: DesktopUserMenuProps) {
    // Only show role switcher for CLASS_TEACHER / SUBJECT_TEACHER base roles
    // who have more than one available role
    const showRoleSwitcher = availableRoles.length > 1 && 
        (baseRole === 'CLASS_TEACHER' || baseRole === 'SUBJECT_TEACHER');

    return (
        <div style={{ position: 'relative', padding: '0 var(--space-4)', marginBottom: 'var(--space-2)' }}>
            {/* Dropdown menu */}
            {showUserMenu && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                        onClick={(e) => { e.stopPropagation(); setShowUserMenu(false); }}
                    />
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'absolute', bottom: '100%', left: 'var(--space-4)', right: 'var(--space-4)',
                            marginBottom: 'var(--space-2)', background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-3)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            zIndex: 61, minWidth: collapsed ? 200 : 'auto',
                        }}>
                        {/* User info */}
                        <div style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{profile.first_name} {profile.last_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{profile.email || 'No email set'}</div>
                            <div style={{
                                display: 'inline-block', marginTop: 'var(--space-2)', fontSize: 10, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px',
                                borderRadius: 'var(--radius-full)', background: `${roleBadgeColors[profile.role]}20`,
                                color: roleBadgeColors[profile.role], border: `1px solid ${roleBadgeColors[profile.role]}40`,
                            }}>
                                {role?.replace('_', ' ')}
                            </div>
                        </div>

                        <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-2) 0' }} />

                        {/* Role Switcher — only for teachers with dual roles */}
                        {showRoleSwitcher && (
                            <div style={{ padding: '0 0 var(--space-2) 0' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 var(--space-3)', marginBottom: 'var(--space-2)' }}>
                                    Switch Role
                                </div>
                                {availableRoles.map(r => (
                                    <button
                                        key={r}
                                        onClick={async () => { await switchRole(r); setShowUserMenu(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            width: '100%', padding: 'var(--space-2) var(--space-3)',
                                            background: role === r ? 'var(--color-surface-hover)' : 'transparent',
                                            border: 'none', color: role === r ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                            fontSize: 13, fontWeight: role === r ? 600 : 400, cursor: 'pointer', transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => { if (role !== r) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                                        onMouseLeave={e => { if (role !== r) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                                <div style={{ height: 1, background: 'var(--color-border)', margin: 'var(--space-2) 0 0 0' }} />
                            </div>
                        )}

                        {/* Sign Out */}
                        <button
                            onClick={onSignOut}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%',
                                padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                                background: 'transparent', border: 'none', color: '#EF4444',
                                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s',
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

            {/* Profile button */}
            <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%',
                    padding: 'var(--space-3) var(--space-3)', borderRadius: 'var(--radius-md)',
                    background: showUserMenu ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: '1px solid transparent', color: 'var(--sidebar-foreground)', cursor: 'pointer',
                    transition: 'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
                }}
                onMouseEnter={e => { if (!showUserMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent'; }}
                title={collapsed ? `${profile.first_name} ${profile.last_name} — ${role?.replace('_', ' ')}` : undefined}
            >
                <Avatar
                    imageUrl={profile.imageUrl}
                    firstName={profile.first_name}
                    lastName={profile.last_name}
                    size={32}
                    fontSize={13}
                    background={roleBadgeColors[profile.role] || 'var(--color-accent)'}
                />
                {!collapsed && (
                    <>
                        <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {profile.first_name} {profile.last_name}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: roleBadgeColors[profile.role], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {role?.replace('_', ' ')}
                            </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </>
                )}
            </button>
        </div>
    );
}
