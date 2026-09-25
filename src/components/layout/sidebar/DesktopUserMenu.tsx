"use client";

import React, { useEffect, useId, useRef } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { type UserRole } from '@/components/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { roleBadgeColors } from './navItems';
import { RoleDot, RoleSwitcher, SignOutButton, ThemeSwitch, canSwitchRole } from './AccountControls';

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

/** The profile card at the foot of the sidebar and the account menu it opens. */
export function DesktopUserMenu({
    profile, role, baseRole, availableRoles, collapsed,
    showUserMenu, setShowUserMenu, switchRole, onSignOut,
}: DesktopUserMenuProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();
    const fullName = `${profile.first_name} ${profile.last_name}`.trim();
    const roleLabel = role ? ROLE_LABELS[role] : '';

    // Close on a click outside or Escape, handing focus back to the card.
    useEffect(() => {
        if (!showUserMenu) return;
        const onPointerDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setShowUserMenu(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setShowUserMenu(false); buttonRef.current?.focus(); }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [showUserMenu, setShowUserMenu]);

    return (
        <div ref={rootRef} className="relative px-3 pb-3">
            {showUserMenu && (
                <div
                    id={menuId}
                    role="dialog"
                    aria-label="Account"
                    className={cn(
                        'animate-pop-in absolute bottom-full z-[61] mb-2 w-72 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl',
                        collapsed ? 'left-3' : 'inset-x-3 w-auto',
                    )}
                >
                    <div className="flex items-center gap-3 px-2 py-2">
                        <Avatar imageUrl={profile.imageUrl} firstName={profile.first_name} lastName={profile.last_name} size={40} fontSize={15} background={roleBadgeColors[profile.role]} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">{profile.email || 'No email on file'}</p>
                        </div>
                    </div>

                    <div className="my-1.5 h-px bg-border" />
                    <div className="px-1 py-1">
                        <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Appearance</p>
                        <ThemeSwitch />
                    </div>

                    {canSwitchRole(availableRoles, baseRole) && (
                        <>
                            <div className="my-1.5 h-px bg-border" />
                            <div className="px-1 py-1">
                                <RoleSwitcher role={role} availableRoles={availableRoles} switchRole={switchRole} onSwitched={() => setShowUserMenu(false)} />
                            </div>
                        </>
                    )}

                    <div className="my-1.5 h-px bg-border" />
                    <div className="px-1">
                        <SignOutButton onSignOut={onSignOut} />
                    </div>
                </div>
            )}

            <button
                ref={buttonRef}
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-controls={showUserMenu ? menuId : undefined}
                aria-label={collapsed ? `${fullName}, ${roleLabel}. Account menu` : 'Account menu'}
                title={collapsed ? `${fullName} · ${roleLabel}` : undefined}
                className={cn(
                    'flex w-full items-center gap-3 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    collapsed ? 'justify-center border-transparent p-1.5' : 'border-sidebar-border bg-white/[0.04] p-2.5',
                    showUserMenu ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent',
                )}
            >
                <Avatar imageUrl={profile.imageUrl} firstName={profile.first_name} lastName={profile.last_name} size={34} fontSize={13} background={roleBadgeColors[profile.role]} />
                {!collapsed && (
                    <>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-sidebar-foreground">{fullName}</span>
                            <span className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60">
                                {role && <RoleDot role={role} />}{roleLabel}
                            </span>
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" aria-hidden />
                    </>
                )}
            </button>
        </div>
    );
}
