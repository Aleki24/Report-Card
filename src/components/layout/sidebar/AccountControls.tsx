"use client";

import React from 'react';
import Link from 'next/link';
import { Check, ChevronRight, LifeBuoy, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import type { UserRole } from '@/components/AuthProvider';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { roleBadgeColors } from './navItems';

/**
 * Account actions shared by the desktop profile menu and the mobile "More"
 * sheet, so both offer the same help link, theme switch, role switch and sign out.
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

interface HelpLinkProps {
  href: string;
  onNavigate?: () => void;
  className?: string;
}

/** Opens the viewer's illustrated user guides, which can be read in the app or downloaded as PDFs. */
export function HelpLink({ href, onNavigate, className }: HelpLinkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <LifeBuoy className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">User guide &amp; help</span>
        <span className="block text-xs leading-snug text-muted-foreground">Read or download as PDF</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
