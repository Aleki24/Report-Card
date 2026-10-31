import React from 'react';
import { cn } from '@/lib/utils';
import type { AttendanceCounts } from '@/lib/attendance';
import { STATUS_STYLES } from './statusStyles';

/**
 * Present, late, excused and absent as one bar, in that order: keeps green
 * and red apart for colour-blind readers. Unmarked shows as the track.
 */
export function AttendanceBar({ counts, className }: { counts: AttendanceCounts; className?: string }) {
  return (
    <div
      className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted', className)}
      role="img"
      aria-label={`${counts.present} present, ${counts.late} late, ${counts.excused} excused, ${counts.absent} absent, ${counts.unmarked} unmarked`}
    >
      {(['present', 'late', 'excused', 'absent'] as const).map(s => counts[s] > 0 && (
        <div key={s} className={STATUS_STYLES[s].bar} style={{ width: `${(counts[s] / Math.max(1, counts.total)) * 100}%` }} />
      ))}
    </div>
  );
}
