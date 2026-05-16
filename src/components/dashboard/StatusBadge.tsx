import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusMap: Record<string, { className: string; label: string }> = {
  // Student statuses
  Active: { className: 'bg-primary/12 text-primary', label: 'Active' },
  ACTIVE: { className: 'bg-primary/12 text-primary', label: 'Active' },
  Pending: { className: 'bg-amber-500/12 text-amber-500', label: 'Pending' },
  PENDING: { className: 'bg-amber-500/12 text-amber-500', label: 'Pending' },
  Transferred: { className: 'bg-muted-foreground/12 text-muted-foreground', label: 'Transferred' },
  TRANSFERRED: { className: 'bg-muted-foreground/12 text-muted-foreground', label: 'Transferred' },
  Alumni: { className: 'bg-blue-500/12 text-blue-500', label: 'Alumni' },
  ALUMNI: { className: 'bg-blue-500/12 text-blue-500', label: 'Alumni' },
  Suspended: { className: 'bg-destructive/12 text-destructive', label: 'Suspended' },
  SUSPENDED: { className: 'bg-destructive/12 text-destructive', label: 'Suspended' },
  GRADUATED: { className: 'bg-violet-500/12 text-violet-500', label: 'Graduated' },
  DEACTIVATED: { className: 'bg-destructive/12 text-destructive', label: 'Deactivated' },

  // Teacher statuses
  'On Leave': { className: 'bg-amber-500/12 text-amber-500', label: 'On Leave' },
  ON_LEAVE: { className: 'bg-amber-500/12 text-amber-500', label: 'On Leave' },
  Inactive: { className: 'bg-muted-foreground/12 text-muted-foreground', label: 'Inactive' },
  INACTIVE: { className: 'bg-muted-foreground/12 text-muted-foreground', label: 'Inactive' },

  // Role badges
  'Class Teacher': { className: 'bg-blue-500/12 text-blue-500', label: 'Class Teacher' },
  CLASS_TEACHER: { className: 'bg-blue-500/12 text-blue-500', label: 'Class Teacher' },
  'Subject Teacher': { className: 'bg-violet-500/12 text-violet-500', label: 'Subject Teacher' },
  SUBJECT_TEACHER: { className: 'bg-violet-500/12 text-violet-500', label: 'Subject Teacher' },
  'Head of Department': { className: 'bg-orange-500/12 text-orange-500', label: 'HOD' },
  Admin: { className: 'bg-primary/12 text-primary', label: 'Admin' },

  // Gender badges
  Boy: { className: 'bg-blue-500/12 text-blue-500', label: 'Boy' },
  Girl: { className: 'bg-pink-500/12 text-pink-500', label: 'Girl' },
  Male: { className: 'bg-blue-500/12 text-blue-500', label: 'Male' },
  Female: { className: 'bg-pink-500/12 text-pink-500', label: 'Female' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusMap[status] || { className: 'bg-muted text-muted-foreground', label: status };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wide whitespace-nowrap leading-snug ${sizeClass} ${config.className}`}
    >
      {config.label}
    </span>
  );
}
