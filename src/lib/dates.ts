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
