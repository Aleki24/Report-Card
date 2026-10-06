/**
 * How a timetable is laid out on a page, shared by the web grid, the app's
 * grid and the PDFs. A class follows its section's bell, so its rows are
 * that bell's periods and breaks. A teacher or room can span sections with
 * different bells; their rows are then the distinct lesson times of the
 * week, in clock order.
 */
import { bandForGrade } from '../curriculum-bands';
import { minutesOf, sectionFor, type TimetableConfig, type TimetableLesson, type TimetablePeriod } from './config';

export interface GridRow {
    key: string;
    label: string;
    /** "08:00–08:40" */
    time: string;
    isBreak: boolean;
    start: number;
    end: number;
}

/** The periods of the bell a lesson's class follows. */
export function periodsOfLesson(config: TimetableConfig, lesson: Pick<TimetableLesson, 'stream'>): TimetablePeriod[] {
    return sectionFor(config, bandForGrade(lesson.stream?.grade ?? null)).periods;
}

/** A lesson's clock time, or null if its period no longer exists. */
export function lessonTime(config: TimetableConfig, lesson: TimetableLesson): { start: number; end: number; label: string } | null {
    const p = periodsOfLesson(config, lesson)[lesson.period];
    return p ? { start: minutesOf(p.start), end: minutesOf(p.end), label: p.label } : null;
}

const rowOf = (p: TimetablePeriod, key: string): GridRow => ({
    key, label: p.label, time: `${p.start}–${p.end}`, isBreak: p.is_break, start: minutesOf(p.start), end: minutesOf(p.end),
});

/**
 * The rows for these lessons: one bell's periods (breaks included) when
 * they all share it, otherwise each distinct lesson time.
 */
export function gridRows(config: TimetableConfig, lessons: readonly TimetableLesson[]): GridRow[] {
    const bells = new Set(lessons.map(l => periodsOfLesson(config, l)));
    if (bells.size <= 1) {
        const periods = bells.size === 1 ? [...bells][0] : config.periods;
        return periods.map((p, i) => rowOf(p, `p${i}`));
    }
    const seen = new Map<string, GridRow>();
    for (const l of lessons) {
        const p = periodsOfLesson(config, l)[l.period];
        if (!p) continue;
        const key = `${p.start}-${p.end}`;
        if (!seen.has(key)) seen.set(key, { ...rowOf(p, key), label: p.start });
    }
    return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The lesson in a row on a day: matched by clock time, so it works across bells. */
export function lessonAt(config: TimetableConfig, lessons: readonly TimetableLesson[], day: number, row: GridRow): TimetableLesson | null {
    return lessons.find(l => {
        if (l.day !== day) return false;
        const t = lessonTime(config, l);
        return !!t && t.start === row.start && t.end === row.end;
    }) ?? null;
}

/** The period index of a row for a class's bell, for moving a lesson into it. */
export function periodIndexOf(config: TimetableConfig, lesson: Pick<TimetableLesson, 'stream'>, row: GridRow): number {
    return periodsOfLesson(config, lesson).findIndex(p => minutesOf(p.start) === row.start && minutesOf(p.end) === row.end);
}
