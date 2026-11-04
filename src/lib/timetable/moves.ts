/**
 * Whether a lesson can move to another slot, and who is free at a time:
 * the rules the lesson-move API enforces, shared with the studio so it can
 * show where a lesson may go before anyone clicks. Client-safe.
 *
 * Sections can keep different bells, so "at the same time" always means
 * overlapping clock times, never the same period number.
 */
import { minutesOf, runsOn, type TimetableConfig, type TimetableLesson, type TimetablePeriod } from './config';
import { lessonTime, periodsOfLesson } from './layout';

/** The lesson fields a move check reads. */
export type MoveLesson = Pick<TimetableLesson, 'id' | 'day' | 'period' | 'grade_stream_id' | 'teacher_id' | 'room_id' | 'stream'> & Partial<Pick<TimetableLesson, 'subject' | 'teacher' | 'room' | 'locked'>>;

/** Two clock ranges, in minutes, overlap. */
const overlaps = (a: readonly [number, number], b: readonly [number, number]) => a[0] < b[1] && b[0] < a[1];

/** The school's recorded times a teacher cannot teach on a weekday, as clock ranges. */
export function teacherOffTimes(config: TimetableConfig, teacherId: string, day: number): [number, number][] {
    return config.rules.teacher_off
        .filter(o => o.teacher_id === teacherId && o.day === day)
        .map(o => [minutesOf(o.start), minutesOf(o.end)]);
}

/** Whether a teacher is away at any part of a clock range on a weekday. */
export const teacherAway = (config: TimetableConfig, teacherId: string, day: number, at: readonly [number, number]) =>
    teacherOffTimes(config, teacherId, day).some(off => overlaps(off, at));

/** A lesson's clock range at a period of its class's bell, or null when that period is no lesson. */
function clockAt(config: TimetableConfig, lesson: Pick<TimetableLesson, 'stream'>, period: number): [number, number] | null {
    const p = periodsOfLesson(config, lesson)[period];
    return p && !p.is_break ? [minutesOf(p.start), minutesOf(p.end)] : null;
}

export type MoveCheck =
    | { ok: true; swap: MoveLesson[] }
    | { ok: false; reason: string };

/**
 * Whether `lesson` (with any option-block lessons sharing its slot) can move
 * to `day`, `period`: the period runs that day for the class, and neither the
 * moving lessons nor any they swap with would put a teacher or room in two
 * places, or a teacher in a time they cannot teach. `pool` is the draft's
 * lessons on the days involved.
 */
export function checkMove(config: TimetableConfig, pool: readonly MoveLesson[], lesson: MoveLesson, day: number, period: number): MoveCheck {
    if (day === lesson.day && period === lesson.period) return { ok: false, reason: 'It is already there.' };
    const target = periodsOfLesson(config, lesson)[period];
    if (!target || target.is_break) return { ok: false, reason: 'That is not a lesson period for this class.' };
    if (!runsOn(target, day)) return { ok: false, reason: `${target.label} does not run on that day.` };
    if (!config.days.includes(day)) return { ok: false, reason: 'That is not a school day.' };

    const inSlot = (d: number, p: number) => pool.filter(o => o.grade_stream_id === lesson.grade_stream_id && o.day === d && o.period === p);
    // An option block is several lessons in one class slot: they move together.
    // The lesson as given (its room may be changing with the move), then its block partners.
    const group = [lesson, ...inSlot(lesson.day, lesson.period).filter(o => o.id !== lesson.id)];
    const swap = inSlot(day, period);
    const moving = new Set([...group, ...swap].map(o => o.id));

    const clash = (who: MoveLesson, d: number, p: number): string | null => {
        const at = clockAt(config, who, p);
        if (!at) return 'That is not a lesson period for this class.';
        if (who.teacher_id && teacherAway(config, who.teacher_id, d, at)) return `${teacherLabel(who)} is not available then.`;
        const other = pool.find(o => {
            if (moving.has(o.id) || o.day !== d) return false;
            if (!((who.teacher_id && o.teacher_id === who.teacher_id) || (who.room_id && o.room_id === who.room_id))) return false;
            const theirs = lessonTime(config, o as TimetableLesson);
            return !!theirs && overlaps(at, [theirs.start, theirs.end]);
        });
        if (!other) return null;
        return who.teacher_id && other.teacher_id === who.teacher_id
            ? `${teacherLabel(who)} is teaching ${other.stream?.full_name ?? 'another class'} then.`
            : `${other.room?.name ?? 'The room'} is in use then.`;
    };
    for (const o of group) {
        const why = clash(o, day, period);
        if (why) return { ok: false, reason: why };
    }
    for (const o of swap) {
        const why = clash(o, lesson.day, lesson.period);
        if (why) return { ok: false, reason: `Swapping would clash: ${why.charAt(0).toLowerCase()}${why.slice(1)}` };
    }
    return { ok: true, swap };
}

const teacherLabel = (l: MoveLesson) => (l.teacher ? `${l.teacher.first_name} ${l.teacher.last_name}`.trim() : 'The teacher');

/**
 * Teachers busy at a clock range on a weekday: teaching (any class, any
 * bell), covering, or recorded as unavailable. Lessons in `except` do not count.
 */
export function busyTeachers(
    config: TimetableConfig,
    lessons: readonly MoveLesson[],
    day: number,
    at: readonly [number, number],
    covering: readonly { teacherId: string; lesson: MoveLesson }[] = [],
): Set<string> {
    const busy = new Set<string>();
    for (const l of lessons) {
        if (!l.teacher_id || l.day !== day) continue;
        const t = lessonTime(config, l as TimetableLesson);
        if (t && overlaps(at, [t.start, t.end])) busy.add(l.teacher_id);
    }
    for (const c of covering) {
        const t = lessonTime(config, c.lesson as TimetableLesson);
        if (c.lesson.day === day && t && overlaps(at, [t.start, t.end])) busy.add(c.teacherId);
    }
    for (const o of config.rules.teacher_off) {
        if (o.day === day && overlaps(at, [minutesOf(o.start), minutesOf(o.end)])) busy.add(o.teacher_id);
    }
    return busy;
}

/** Lesson periods a teacher can teach in a week of a bell: every period on each day it runs, less the times they are away. */
export function availableLessons(config: TimetableConfig, periods: readonly TimetablePeriod[], teacherId: string): number {
    let n = 0;
    for (const day of config.days) {
        for (const p of periods) {
            if (p.is_break || !runsOn(p, day)) continue;
            if (!teacherAway(config, teacherId, day, [minutesOf(p.start), minutesOf(p.end)])) n++;
        }
    }
    return n;
}
