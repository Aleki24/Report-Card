/**
 * How a timetable is laid out on a page, shared by the web grid, the app's
 * grid and the PDFs. A class follows its section's bell, so its rows are
 * that bell's periods and breaks. A teacher or room can span sections with
 * different bells; their rows are then the distinct lesson times of the
 * week, in clock order.
 */
import { bandForGrade } from '../curriculum-bands';
import { activitiesOf, bellFor, minutesOf, runsOn, sectionFor, timesOverlap, type ActivityKind, type TimetableActivity, type TimetableConfig, type TimetableLesson, type TimetablePeriod } from './config';

export interface GridRow {
    key: string;
    label: string;
    /** "08:00–08:40" */
    time: string;
    isBreak: boolean;
    start: number;
    end: number;
    /** The weekdays the row's period runs, when not every day. */
    days?: readonly number[];
    /** An activity's own row (assembly before the first lesson): shown like a break, on its days. */
    activity?: ActivityKind;
    /** The activity that has this lesson period on a day (Games on Wednesday afternoon), by weekday. */
    taken?: Readonly<Record<number, string>>;
}

/** Whether a row's period runs on a weekday (a Friday-only lesson does not on Monday). */
export const rowRunsOn = (row: Pick<GridRow, 'days'>, day: number) => runsOn(row, day);

/** The periods of the bell a lesson's class follows. */
export function periodsOfLesson(config: TimetableConfig, lesson: Pick<TimetableLesson, 'stream'>): TimetablePeriod[] {
    return bellFor(config, bandForGrade(lesson.stream?.grade ?? null)).periods;
}

/** A lesson's clock time, or null if its period no longer exists. */
export function lessonTime(config: TimetableConfig, lesson: TimetableLesson): { start: number; end: number; label: string } | null {
    const p = periodsOfLesson(config, lesson)[lesson.period];
    return p ? { start: minutesOf(p.start), end: minutesOf(p.end), label: p.label } : null;
}

const rowOf = (p: TimetablePeriod, key: string): GridRow => ({
    key, label: p.label, time: `${p.start}–${p.end}`, isBreak: p.is_break, start: minutesOf(p.start), end: minutesOf(p.end), ...(p.days ? { days: p.days } : {}),
});

/**
 * The rows for these lessons: one bell's periods (breaks included) when
 * they all share it, otherwise each distinct lesson time.
 */
export function gridRows(config: TimetableConfig, lessons: readonly TimetableLesson[]): GridRow[] {
    const bells = new Set(lessons.map(l => periodsOfLesson(config, l)));
    if (bells.size <= 1) {
        const section = sectionFor(config, lessons[0] ? bandForGrade(lessons[0].stream?.grade ?? null) : null);
        const periods = bells.size === 1 ? [...bells][0] : bellFor(config, null).periods;
        return withActivityRows(section.periods, periods, activitiesOf(config, section.id));
    }
    const seen = new Map<string, GridRow>();
    for (const l of lessons) {
        const p = periodsOfLesson(config, l)[l.period];
        if (!p) continue;
        const key = `${p.start}-${p.end}`;
        const row = { ...rowOf(p, key), label: p.start };
        const prev = seen.get(key);
        // The same time in two bells runs on the days of either.
        const days = prev && (prev.days && row.days ? [...new Set([...prev.days, ...row.days])].sort((a, b) => a - b) : undefined);
        seen.set(key, prev ? { key, label: row.label, time: row.time, isBreak: row.isBreak, start: row.start, end: row.end, ...(days ? { days } : {}) } : row);
    }
    return [...seen.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * The lessons in a row on a day, matched by clock time so it works across
 * bells. A class's option block holds several, one per elective.
 */
export function lessonsAt(config: TimetableConfig, lessons: readonly TimetableLesson[], day: number, row: GridRow): TimetableLesson[] {
    return lessons.filter(l => {
        if (l.day !== day) return false;
        const t = lessonTime(config, l);
        return !!t && t.start === row.start && t.end === row.end;
    });
}

/** The first lesson in a row on a day (the one a click picks up). */
export const lessonAt = (config: TimetableConfig, lessons: readonly TimetableLesson[], day: number, row: GridRow): TimetableLesson | null =>
    lessonsAt(config, lessons, day, row)[0] ?? null;

/** The period index of a row for a class's bell, for moving a lesson into it. */
export function periodIndexOf(config: TimetableConfig, lesson: Pick<TimetableLesson, 'stream'>, row: GridRow): number {
    return periodsOfLesson(config, lesson).findIndex(p => minutesOf(p.start) === row.start && minutesOf(p.end) === row.end);
}

/** One cell of a day: a lesson's period, or a double's two back-to-back periods merged. */
export interface DayCell {
    rows: GridRow[];
    lessons: TimetableLesson[];
}

/** What makes two periods one lesson: the same subjects with the same teachers. */
const lessonSignature = (here: readonly TimetableLesson[]) => here.map(l => `${l.subject_id}:${l.teacher_id ?? ''}`).sort().join('|');

/**
 * A day's rows as cells, a double's two periods merged into one: back to back
 * with no break between, the same subjects and teachers. A break or a period
 * not running that day stays its own cell.
 */
export function dayCells(config: TimetableConfig, lessons: readonly TimetableLesson[], day: number, rows: readonly GridRow[]): DayCell[] {
    const out: DayCell[] = [];
    for (const row of rows) {
        const here = row.isBreak || !runsOn(row, day) ? [] : lessonsAt(config, lessons, day, row);
        const last = out[out.length - 1];
        const lastRow = last?.rows[last.rows.length - 1];
        const joins = !!last && last.rows.length === 1 && here.length > 0 && last.lessons.length > 0 && !lastRow!.isBreak
            && row.start - lastRow!.end <= 5 && lessonSignature(last.lessons) === lessonSignature(here);
        if (joins) { last.rows.push(row); last.lessons.push(...here); continue; }
        out.push({ rows: [row], lessons: here });
    }
    return out;
}

/** Each subject on a timetable gets its own colour, by its code A to Z; `palette` is how many colours there are. */
export function subjectColours(codes: readonly string[], palette: number): Map<string, number> {
    return new Map([...new Set(codes)].sort((a, b) => a.localeCompare(b)).map((code, i) => [code, i % palette]));
}

/**
 * A bell's rows with its activities: a lesson period an activity takes on
 * some days says so on those days; an activity clear of every lesson period
 * (assembly before the first, games after the last) gets a row of its own.
 */
function withActivityRows(raw: readonly TimetablePeriod[], periods: readonly TimetablePeriod[], activities: readonly TimetableActivity[]): GridRow[] {
    const rows = periods.map((p, i) => {
        const row = rowOf(p, `p${i}`);
        const original = raw[i];
        if (p.is_break || !original) return row;
        const taken: Record<number, string> = {};
        activities.filter(a => timesOverlap(original, a)).forEach(a => a.days.forEach(d => { taken[d] ??= a.label; }));
        return Object.keys(taken).length > 0 ? { ...row, taken } : row;
    });
    const own = activities
        .filter(a => !raw.some(p => !p.is_break && timesOverlap(p, a)))
        .map((a): GridRow => ({
            key: `a${a.id}`, label: a.label, time: `${a.start}–${a.end}`, isBreak: true,
            start: minutesOf(a.start), end: minutesOf(a.end), days: [...a.days].sort((x, y) => x - y), activity: a.kind,
        }));
    return [...rows, ...own].sort((a, b) => a.start - b.start || a.end - b.end);
}
