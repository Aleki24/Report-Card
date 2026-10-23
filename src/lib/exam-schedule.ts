import { ALL_EXAM_TYPES } from './exam-types';

/**
 * When a term's exams run, read from the papers themselves. Shared by mark
 * entry and the results views, so both open on the same exam. Client-safe.
 */

export interface ScheduledPaper {
    exam_type: string;
    /** YYYY-MM-DD the paper is scheduled for. */
    exam_date?: string | null;
}

/** When each exam type in a term is scheduled: its earliest paper. */
export function examTypeDates(papers: readonly ScheduledPaper[]): Map<string, string> {
    const dates = new Map<string, string>();
    for (const p of papers) {
        const d = dates.get(p.exam_type);
        if (p.exam_date && (!d || p.exam_date < d)) dates.set(p.exam_type, p.exam_date);
    }
    return dates;
}

/** The exam the term is on now: the latest one already scheduled to have been sat. */
export function currentExamType(dates: ReadonlyMap<string, string>, today: string): string | null {
    let current: [string, string] | null = null;
    for (const [type, date] of dates) if (date <= today && (!current || date > current[1])) current = [type, date];
    return current?.[0] ?? null;
}

/** Built-in exams in their running order; a school's own types after them. */
export function examTypeOrder(code: string): number {
    return ALL_EXAM_TYPES.find(t => t.code === code)?.order ?? 999;
}

/** "12 Nov" */
export const examDay = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
