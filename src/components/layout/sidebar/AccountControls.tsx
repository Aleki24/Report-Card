"use client";

import React from 'react';
import { Check, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { UserRole } from '@/components/AuthProvider';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { roleBadgeColors } from './navItems';

/**
 * Account actions shared by the desktop profile menu and the mobile "More"
 * sheet, so both offer the same theme switch, role switch and sign out.
 */

/** Teachers who are also a class teacher can switch between their two views. */
export function canSwitchRole(availableRoles: UserRole[], baseRole: UserRole | null): boolean {
  return availableRoles.length > 1 && (baseRole === 'CLASS_TEACHER' || baseRole === 'SUBJECT_TEACHER');
}

export function RoleDot({ role, className }: { role: UserRole; className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full', className)} style={{ background: roleBadgeColors[role] }} />;
}

export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ] as const;

  return (
    <div role="radiogroup" aria-label="Theme" className={cn('grid grid-cols-2 gap-1 rounded-xl bg-muted p-1', className)} suppressHydrationWarning>
      {options.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => { if (!active) toggleTheme(); }}
            suppressHydrationWarning
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />{label}
          </button>
        );
      })}
    </div>
  );
}

interface RoleSwitcherProps {
  role: UserRole | null;
  availableRoles: UserRole[];
  switchRole: (role: UserRole) => Promise<void>;
  onSwitched?: () => void;
}

export function RoleSwitcher({ role, availableRoles, switchRole, onSwitched }: RoleSwitcherProps) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">View as</p>
      <div className="flex flex-col gap-0.5">
        {availableRoles.map(r => {
          const active = role === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={active}
              onClick={async () => { if (!active) await switchRole(r); onSwitched?.(); }}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <RoleDot role={r} />
              <span className="flex-1">{ROLE_LABELS[r]}</span>
              {active && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SignOutButton({ onSignOut, className }: { onSignOut: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <LogOut className="size-4" aria-hidden />Sign out
    </button>
  );
}
