/**
 * Calendar-date helpers for `YYYY-MM-DD` strings (Postgres `date` columns).
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, which in Kenya
 * (UTC+3) is still yesterday until 3am. And `new Date('2026-09-25')` parses as
 * UTC midnight, which shows as the 24th anywhere west of Greenwich. Everything
 * that turns a "today" or a stored date into a calendar day goes through here.
 *
 * Client-safe: no server-only imports.
 */

/** Where the schools this app serves keep their calendar. */
export const SCHOOL_TIME_ZONE = 'Africa/Nairobi';
/** Its offset from UTC: Kenya keeps East Africa Time all year, with no daylight saving. */
const SCHOOL_UTC_OFFSET = '+03:00';
const SCHOOL_UTC_OFFSET_MS = 3 * 3_600_000;

/** An instant as the school's wall clock reads it, `YYYY-MM-DDTHH:MM:SS` (plain arithmetic: no locale formats, same on every engine). */
const schoolClock = (instant: string | Date): string => new Date(new Date(instant).getTime() + SCHOOL_UTC_OFFSET_MS).toISOString().slice(0, 19);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A Date's calendar day, `YYYY-MM-DD`, in the given IANA time zone. */
export function isoDateInZone(date: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Today in the school's time zone — for server code, which runs in UTC. */
export function schoolToday(): string {
  return isoDateInZone(new Date(), SCHOOL_TIME_ZONE);
}

/** The school's calendar day, `YYYY-MM-DD`, of an instant (a database timestamp). */
export function schoolDayOf(instant: string | Date): string {
  return schoolClock(instant).slice(0, 10);
}

/** The school's weekday (1 = Monday … 7 = Sunday) and minutes past midnight at an instant: where "now" falls on a timetable. */
export function schoolWeekMinute(instant: string | Date = new Date()): { day: number; minutes: number } {
  const clock = schoolClock(instant);
  const day = new Date(`${clock.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return { day: day === 0 ? 7 : day, minutes: Number(clock.slice(11, 13)) * 60 + Number(clock.slice(14, 16)) };
}

/** The school's wall-clock time, `HH:MM:SS`, of an instant. */
export function schoolTimeOf(instant: string | Date): string {
  return schoolClock(instant).slice(11, 19);
}

/**
 * The instants a run of school days covers, to filter timestamps with:
 * from the midnight that starts `from` up to, not including, the midnight
 * after `to`. A UTC day would put a payment made at 1am in Nairobi on the
 * day before.
 */
export function schoolDayRange(from: string, to: string = from): { start: string; end: string } {
  return {
    start: new Date(`${from}T00:00:00${SCHOOL_UTC_OFFSET}`).toISOString(),
    end: new Date(`${addDays(to, 1)}T00:00:00${SCHOOL_UTC_OFFSET}`).toISOString(),
  };
}

/** A Date's calendar day in the browser's own time zone. */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses `YYYY-MM-DD` as local midnight of that day, or null if it is not a real date. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects overflow such as 2026-02-31, which Date rolls into March.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Whether a value is a real `YYYY-MM-DD` calendar date. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && parseIsoDate(value) !== null;
}

/** The `YYYY-MM-DD` date `days` after (or before, if negative) the given one. */
export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

/** Formats a `YYYY-MM-DD` date for display without shifting it a day. */
export function formatIsoDate(value: string, options: Intl.DateTimeFormatOptions, locale = 'en-GB'): string {
  const date = parseIsoDate(value);
  return date ? date.toLocaleDateString(locale, options) : value;
}

/**
 * The newest calendar date anywhere on Earth (UTC+14). A date after this one
 * has not happened for anybody, whatever time zone their browser uses.
 */
export function latestDateAnywhere(): string {
  return isoDateInZone(new Date(), 'Pacific/Kiritimati');
}

/** Whether a `YYYY-MM-DD` date falls Monday to Friday. */
export function isWeekday(value: string): boolean {
  const day = parseIsoDate(value)?.getDay();
  return day !== undefined && day !== 0 && day !== 6;
}

/** The nearest weekday `step` days on (1) or back (-1), skipping Saturday and Sunday. */
export function addWeekdays(value: string, step: 1 | -1): string {
  let next = addDays(value, step);
  for (let i = 0; i < 6 && !isWeekday(next); i++) next = addDays(next, step);
  return next;
}
