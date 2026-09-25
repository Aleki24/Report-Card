"use client";

import React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { UserRole } from '@/components/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { useDialogBehavior } from '@/hooks/useDialogBehavior';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { type NavItem, roleBadgeColors, routeMatches } from './navItems';
import { RoleDot, RoleSwitcher, SignOutButton, ThemeSwitch, canSwitchRole } from './AccountControls';

interface MobileMoreMenuProps {
    showMoreMenu: boolean;
    setShowMoreMenu: (val: boolean) => void;
    overflowItems: NavItem[];
    pathname: string;
    onSignOut: () => void;
    profile: { first_name: string; last_name: string; email?: string | null; role: UserRole; imageUrl?: string | null } | null;
    role: UserRole | null;
    baseRole: UserRole | null;
    availableRoles: UserRole[];
    switchRole: (role: UserRole) => Promise<void>;
}

/**
 * The phone's "More" sheet: every page that doesn't fit the bottom bar, plus
 * the account (theme, role switch, sign out), which has no other home on a
 * phone. Slides up from the bottom, above the bottom bar's thumb reach.
 */
export function MobileMoreMenu({
    showMoreMenu, setShowMoreMenu, overflowItems, pathname, onSignOut,
    profile, role, baseRole, availableRoles, switchRole,
}: MobileMoreMenuProps) {
    const close = () => setShowMoreMenu(false);
    const { panelRef, backdropProps } = useDialogBehavior(showMoreMenu, close);
    if (!showMoreMenu) return null;

    const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';

    return (
        <div className="animate-backdrop-in fixed inset-0 z-[70] flex items-end bg-black/50 backdrop-blur-[2px] min-[768px]:hidden" {...backdropProps}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="More"
                tabIndex={-1}
                className="animate-sheet-up flex max-h-[88dvh] w-full flex-col rounded-t-3xl border-t border-border bg-card text-card-foreground shadow-2xl outline-none"
            >
                <div className="flex justify-center pt-2.5 pb-1" aria-hidden><span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" /></div>

                <div className="flex items-center gap-3 px-5 pt-1 pb-3">
                    {profile && (
                        <Avatar imageUrl={profile.imageUrl} firstName={profile.first_name} lastName={profile.last_name} size={44} fontSize={16} background={roleBadgeColors[profile.role]} />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{fullName || 'Menu'}</p>
                        {role && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RoleDot role={role} />{ROLE_LABELS[role]}</p>
                        )}
                    </div>
                    <button type="button" onClick={close} aria-label="Close menu" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <X className="size-5" aria-hidden />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    {overflowItems.length > 0 && (
                        <nav aria-label="All pages" className="mb-4">
                            <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Pages</p>
                            <ul className="grid grid-cols-3 gap-2">
                                {overflowItems.map(item => {
                                    const active = routeMatches(pathname, item.href);
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={close}
                                                aria-current={active ? 'page' : undefined}
                                                className={cn(
                                                    'flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-3 text-center text-xs font-medium no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-background text-foreground hover:border-primary/30',
                                                )}
                                            >
                                                <span className={cn('flex size-9 items-center justify-center rounded-xl', active ? 'bg-primary/15' : 'bg-muted text-muted-foreground')}>{item.icon}</span>
                                                <span className="line-clamp-2 leading-tight">{item.label}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                    )}

                    {canSwitchRole(availableRoles, baseRole) && (
                        <div className="mb-4 rounded-2xl border border-border/70 p-2">
                            <RoleSwitcher role={role} availableRoles={availableRoles} switchRole={switchRole} onSwitched={close} />
                        </div>
                    )}

                    <div className="mb-3">
                        <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Appearance</p>
                        <ThemeSwitch />
                    </div>

                    <SignOutButton onSignOut={onSignOut} className="h-11 justify-center rounded-xl border border-destructive/25" />
                </div>
            </div>
        </div>
    );
}
