import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusMap: Record<string, { bg: string; color: string; label: string }> = {
  // Student statuses
  Active: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981', label: 'Active' },
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981', label: 'Active' },
  Pending: { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'Pending' },
  PENDING: { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'Pending' },
  Transferred: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6B7280', label: 'Transferred' },
  TRANSFERRED: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6B7280', label: 'Transferred' },
  Alumni: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Alumni' },
  ALUMNI: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Alumni' },
  Suspended: { bg: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', label: 'Suspended' },
  SUSPENDED: { bg: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', label: 'Suspended' },
  GRADUATED: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', label: 'Graduated' },
  DEACTIVATED: { bg: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', label: 'Deactivated' },

  // Teacher statuses
  'On Leave': { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'On Leave' },
  ON_LEAVE: { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'On Leave' },
  Inactive: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6B7280', label: 'Inactive' },
  INACTIVE: { bg: 'rgba(107, 114, 128, 0.12)', color: '#6B7280', label: 'Inactive' },

  // Role badges
  'Class Teacher': { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Class Teacher' },
  CLASS_TEACHER: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Class Teacher' },
  'Subject Teacher': { bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', label: 'Subject Teacher' },
  SUBJECT_TEACHER: { bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', label: 'Subject Teacher' },
  'Head of Department': { bg: 'rgba(249, 115, 22, 0.12)', color: '#F97316', label: 'HOD' },
  Admin: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981', label: 'Admin' },

  // Gender badges
  Boy: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Boy' },
  Girl: { bg: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', label: 'Girl' },
  Male: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6', label: 'Male' },
  Female: { bg: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', label: 'Female' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusMap[status] || { bg: 'rgba(100,100,100,0.12)', color: 'var(--color-text-muted)', label: status };
  const px = size === 'sm' ? '8px' : '10px';
  const fs = size === 'sm' ? '0.625rem' : '0.6875rem';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `2px ${px}`,
        borderRadius: '999px',
        fontSize: fs,
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        letterSpacing: '0.01em',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}
