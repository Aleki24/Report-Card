/**
 * Daily attendance vocabulary shared by the register, the student view and
 * the API. Client-safe.
 */

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;

/** Mirrors the `attendance_status` Postgres enum. */
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export const ATTENDANCE_LABELS: Readonly<Record<AttendanceStatus, string>> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

/** One student on a class register for a day, as the register API returns it. */
export interface AttendanceRosterEntry {
  id: string;
  name: string;
  admission_number: string;
  /** Null until someone marks the student for that day. */
  status: AttendanceStatus | null;
  notes: string | null;
}

/** A class whose register the caller may keep. */
export interface AttendanceStream {
  id: string;
  full_name: string;
}

/** What a "notify guardians" request did, per absent student. */
export interface NotifyResult {
  sent: number;
  failed: number;
  /** No guardian phone on record. */
  skipped: number;
  /** Already texted for that day, so not texted again. */
  alreadyNotified: number;
}

/** Longest note a register entry keeps. */
export const ATTENDANCE_NOTE_MAX = 500;

export type AttendanceCounts = Record<AttendanceStatus, number> & { unmarked: number; total: number };

export function countAttendance(statuses: readonly (AttendanceStatus | null)[]): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0, total: statuses.length };
  for (const status of statuses) {
    if (status) counts[status]++;
    else counts.unmarked++;
  }
  return counts;
}

/**
 * Share of marked entries where the student was in school, as a whole
 * percentage — late arrivals attended, so they count. Null when nothing is
 * marked yet, which is different from 0%.
 */
export function attendanceRate(counts: AttendanceCounts): number | null {
  const marked = counts.total - counts.unmarked;
  if (marked === 0) return null;
  return Math.round(((counts.present + counts.late) / marked) * 100);
}
