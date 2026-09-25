"use client";

import React, { useState } from 'react';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { ROLE_META } from './userMeta';

const AVATAR_SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-14 text-lg',
  lg: 'size-24 text-3xl sm:size-28',
} as const;

interface UserAvatarProps {
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  imageUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}

/** The user's photo, or their initials on a role-coloured gradient when there is none (or it fails to load). */
export function UserAvatar({ firstName, lastName, role, imageUrl, size = 'sm', className }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  const base = cn('relative shrink-0 overflow-hidden rounded-full', AVATAR_SIZES[size], className);

  if (imageUrl && failedUrl !== imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photos live in Supabase storage / OAuth hosts, not local assets
      <img
        src={imageUrl}
        alt={name ? `Photo of ${name}` : 'Profile photo'}
        loading="lazy"
        onError={() => setFailedUrl(imageUrl)}
        className={cn(base, 'bg-muted object-cover')}
      />
    );
  }

  return (
    <div aria-hidden="true" className={cn(base, 'flex items-center justify-center bg-gradient-to-br font-semibold text-white', ROLE_META[role].gradient)}>
      {initials}
    </div>
  );
}

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const { label, icon: Icon, badge } = ROLE_META[role];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', badge, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusBadge({ active, label, className }: { active: boolean; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden="true" />
      {label ?? (active ? 'Active' : 'Inactive')}
    </span>
  );
}
