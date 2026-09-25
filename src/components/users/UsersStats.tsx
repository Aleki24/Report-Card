"use client";

import React from 'react';
import { GraduationCap, UserRound, Users, UserX } from 'lucide-react';
import { StatFilterTile } from '@/components/ui/StatFilterTile';
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

export function UsersStats({ loading, roleCounts, inactiveCount, roleFilter, statusFilter, onSelectRole, onSelectStatus }: UsersStatsProps) {
  const selectRole = (role: RoleFilter) => () => { onSelectRole(role); onSelectStatus('ALL'); };

  const tiles = [
    { key: 'all', label: 'Total users', value: roleCounts.ALL, hint: `${roleCounts.ADMIN + roleCounts.STAFF} admins & staff`, icon: Users, hue: 'blue' as const, selected: roleFilter === 'ALL' && statusFilter === 'ALL', onClick: selectRole('ALL') },
    { key: 'students', label: 'Students', value: roleCounts.STUDENT, hint: 'Enrolled learners', icon: UserRound, hue: 'emerald' as const, selected: roleFilter === 'STUDENT' && statusFilter === 'ALL', onClick: selectRole('STUDENT') },
    { key: 'teachers', label: 'Teachers', value: roleCounts.TEACHER, hint: 'Class & subject teachers', icon: GraduationCap, hue: 'sky' as const, selected: roleFilter === 'TEACHER' && statusFilter === 'ALL', onClick: selectRole('TEACHER') },
    { key: 'inactive', label: 'Not active', value: inactiveCount, hint: 'Not yet activated, or switched off', icon: UserX, hue: 'amber' as const, selected: statusFilter === 'INACTIVE', onClick: () => { onSelectRole('ALL'); onSelectStatus('INACTIVE'); } },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {tiles.map(({ key, ...tile }) => <StatFilterTile key={key} loading={loading} {...tile} />)}
    </div>
  );
}
