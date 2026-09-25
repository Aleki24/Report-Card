"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/attendance';
import { STATUS_STYLES } from './statusStyles';

interface StatusPickerProps {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
  /** Whose status this is, for screen readers. */
  studentName: string;
}

/** Present / Absent / Late / Excused as one segmented control. */
export function StatusPicker({ value, onChange, studentName }: StatusPickerProps) {
  return (
    <div role="group" aria-label={`Attendance for ${studentName}`} className="grid w-full grid-cols-4 overflow-hidden rounded-xl border border-border bg-background sm:inline-grid sm:w-auto">
      {ATTENDANCE_STATUSES.map((status, i) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            aria-label={ATTENDANCE_LABELS[status]}
            title={ATTENDANCE_LABELS[status]}
            onClick={() => onChange(status)}
            className={cn(
              'h-10 min-w-11 px-2 text-xs font-bold tracking-wide transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9',
              i > 0 && 'border-l border-border',
              active ? STATUS_STYLES[status].active : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {/* Full words where there is room, letters on narrow rows. */}
            <span className="lg:hidden">{STATUS_STYLES[status].short}</span>
            <span className="hidden lg:inline">{ATTENDANCE_LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
