/**
 * term-calendar.ts
 * Determines the active term based on the Kenyan school calendar.
 *
 * Kenyan school terms:
 *   Term 1: January → end of April
 *   Term 2: May → end of July
 *   Term 3: August → end of November
 *   Holiday: December (no active term)
 */

export interface TermPeriod {
  term: number;    // 1, 2, or 3
  name: string;
  startMonth: number;  // 0-indexed (Jan=0)
  endMonth: number;    // 0-indexed inclusive
}

export const KENYAN_TERM_CALENDAR: TermPeriod[] = [
  { term: 1, name: 'Term 1', startMonth: 0, endMonth: 3 },   // Jan-Apr
  { term: 2, name: 'Term 2', startMonth: 4, endMonth: 6 },   // May-Jul
  { term: 3, name: 'Term 3', startMonth: 7, endMonth: 10 },  // Aug-Nov
  // December (month 11) = holiday break, defaults to Term 3
];

/**
 * Get the current term number based on today's date.
 * Returns 1, 2, or 3.
 */
export function getCurrentTermNumber(date?: Date): number {
  const d = date || new Date();
  const month = d.getMonth(); // 0-indexed

  for (const period of KENYAN_TERM_CALENDAR) {
    if (month >= period.startMonth && month <= period.endMonth) {
      return period.term;
    }
  }
  // December → default to Term 3 (just ended)
  return 3;
}

/**
 * Get the term name for display.
 */
export function getCurrentTermName(date?: Date): string {
  const num = getCurrentTermNumber(date);
  return `Term ${num}`;
}

/**
 * Given a list of terms from the database, find the one that should be active
 * based on the current date and Kenyan calendar.
 *
 * Matching strategy:
 * 1. Try to match by term name containing "Term X" or "X"
 * 2. Try to match by date range (start_date/end_date)
 * 3. Fall back to the one marked is_current
 * 4. Fall back to the first term
 */
export function findActiveTermId(
  terms: Array<{ id: string; name: string; start_date?: string; end_date?: string; is_current?: boolean }>,
  date?: Date
): string | null {
  if (terms.length === 0) return null;

  const d = date || new Date();
  const currentTermNum = getCurrentTermNumber(d);

  // 1. Match by name (e.g. "Term 1", "Term 2", "Term 3")
  const byName = terms.find(t => {
    const lower = t.name.toLowerCase().trim();
    return (
      lower === `term ${currentTermNum}` ||
      lower === `term${currentTermNum}` ||
      lower.includes(`term ${currentTermNum}`) ||
      lower === `${currentTermNum}`
    );
  });
  if (byName) return byName.id;

  // 2. Match by date range
  const now = d.getTime();
  const byDate = terms.find(t => {
    if (!t.start_date || !t.end_date) return false;
    const start = new Date(t.start_date).getTime();
    const end = new Date(t.end_date).getTime();
    return now >= start && now <= end;
  });
  if (byDate) return byDate.id;

  // 3. Fallback to is_current flag
  const byCurrent = terms.find(t => t.is_current);
  if (byCurrent) return byCurrent.id;

  // 4. Fallback to first term
  return terms[0].id;
}
