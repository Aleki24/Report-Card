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
export type { ManagedStream as AttendanceStream } from './managed-streams';

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

/** Two sets of counts added together (a school's classes into one total). */
export function addCounts(a: AttendanceCounts, b: AttendanceCounts): AttendanceCounts {
  return {
    present: a.present + b.present, absent: a.absent + b.absent, late: a.late + b.late, excused: a.excused + b.excused,
    unmarked: a.unmarked + b.unmarked, total: a.total + b.total,
  };
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

/** Below this share of school days attended, a learner is flagged as often absent. */
export const LOW_ATTENDANCE_RATE = 85;

/** One class on one day: whether its register was taken and how it went. */
export interface AttendanceClassDay {
  streamId: string;
  name: string;
  counts: AttendanceCounts;
  /** Null when nothing is marked. */
  rate: number | null;
}

/** GET /api/school/attendance/overview?date= */
export interface AttendanceOverviewResponse {
  date: string;
  classes: AttendanceClassDay[];
  totals: AttendanceCounts;
}

/** One learner over a period: their mark on each day, and how often they came. */
export interface AttendanceLearnerSummary {
  id: string;
  name: string;
  admission_number: string;
  /** Marks by `YYYY-MM-DD`; days with no mark are absent from the map. */
  days: Record<string, AttendanceStatus>;
  counts: AttendanceCounts;
  rate: number | null;
}

/** GET /api/school/attendance/summary?stream_id=&from=&to= */
export interface AttendanceSummaryResponse {
  from: string;
  to: string;
  /** Days the class register was taken, oldest first. */
  days: string[];
  learners: AttendanceLearnerSummary[];
  /** The class over the whole period. */
  rate: number | null;
}

/** Longest period one summary covers. */
export const ATTENDANCE_SUMMARY_MAX_DAYS = 120;
