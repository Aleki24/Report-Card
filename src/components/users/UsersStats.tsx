"use client";

import React from 'react';
import { GraduationCap, UserRound, Users, UserX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoleCounts } from '@/hooks/useUsersPage';
import type { RoleFilter, StatusFilter } from './userMeta';

interface UsersStatsProps {
  loading: boolean;
  roleCounts: RoleCounts;
  inactiveCount: number;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  onSelectRole: (role: RoleFilter) => void;
  onSelectStatus: (status: StatusFilter) => void;
}

interface Tile {
  key: string;
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tint: string;
  selected: boolean;
  onClick: () => void;
}

export function UsersStats({ loading, roleCounts, inactiveCount, roleFilter, statusFilter, onSelectRole, onSelectStatus }: UsersStatsProps) {
  const selectRole = (role: RoleFilter) => () => { onSelectRole(role); onSelectStatus('ALL'); };

  const tiles: Tile[] = [
    { key: 'all', label: 'Total users', value: roleCounts.ALL, hint: `${roleCounts.ADMIN + roleCounts.STAFF} admins & staff`, icon: Users, tint: 'bg-primary/10 text-primary', selected: roleFilter === 'ALL' && statusFilter === 'ALL', onClick: selectRole('ALL') },
    { key: 'students', label: 'Students', value: roleCounts.STUDENT, hint: 'Enrolled learners', icon: UserRound, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', selected: roleFilter === 'STUDENT' && statusFilter === 'ALL', onClick: selectRole('STUDENT') },
    { key: 'teachers', label: 'Teachers', value: roleCounts.TEACHER, hint: 'Class & subject teachers', icon: GraduationCap, tint: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', selected: roleFilter === 'TEACHER' && statusFilter === 'ALL', onClick: selectRole('TEACHER') },
    { key: 'inactive', label: 'Not active', value: inactiveCount, hint: 'Not yet activated, or switched off', icon: UserX, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', selected: statusFilter === 'INACTIVE', onClick: () => { onSelectRole('ALL'); onSelectStatus('INACTIVE'); } },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {tiles.map(({ key, label, value, hint, icon: Icon, tint, selected, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          className={cn(
            'group flex min-w-0 items-start gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all sm:p-4',
            'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/70 hover:border-primary/40',
          )}
        >
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11', tint)}>
            <Icon className="size-4 sm:size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
            {loading
              ? <span className="mt-1 block h-7 w-12 animate-pulse rounded-md bg-muted" />
              : <span className="block text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value.toLocaleString()}</span>}
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
