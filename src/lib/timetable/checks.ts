/**
 * Checks a school can trust: when a subject is best taught, and a draft read
 * back lesson by lesson to confirm nobody is in two places at once and every
 * subject got its lessons a week. Client-safe: the generator stores the
 * clash audit with the draft, the studio shows the hours check.
 */
import { AFTERNOON_CATEGORIES, MORNING_CATEGORIES, minutesOf, type SubjectTime, type TimetableConfig, type TimetablePeriod } from './config';

/** A subject's best time of day: the school's choice, else its category's usual (maths and sciences morning, PE and the arts afternoon). */
export function timeOfDay(config: TimetableConfig, subjectId: string, category: string | null | undefined): SubjectTime {
    const chosen = config.rules.subject_times[subjectId];
    if (chosen) return chosen;
    if (MORNING_CATEGORIES.has(category ?? '')) return 'morning';
    if (AFTERNOON_CATEGORIES.has(category ?? '')) return 'afternoon';
    return 'any';
}

/** The usual time for a category, to show beside a subject the school has not chosen for. */
export const usualTimeOf = (category: string | null | undefined): SubjectTime =>
    MORNING_CATEGORIES.has(category ?? '') ? 'morning' : AFTERNOON_CATEGORIES.has(category ?? '') ? 'afternoon' : 'any';

export const SUBJECT_TIME_LABELS: Record<SubjectTime, string> = { morning: 'Morning', afternoon: 'Afternoon', any: 'Any time' };

/** One lesson as the audit reads it: its slot, its class's bell, its teacher and room. */
export interface AuditLesson {
    day: number;
    period: number;
    streamPeriods: readonly TimetablePeriod[];
    teacherId: string | null;
    roomId: string | null;
}

export interface LessonAudit {
    /** Times a teacher is booked in two lessons at once. */
    teacherClashes: number;
    /** Times a room holds two lessons at once. */
    roomClashes: number;
}

/**
 * Teachers and rooms booked twice at overlapping clock times, counted from
 * the lessons themselves (a teacher in two sections' bells included). An
 * option block's lessons share a class slot but each has its own teacher.
 */
export function auditLessons(lessons: readonly AuditLesson[]): LessonAudit {
    const slots = new Map<string, [number, number][]>();
    let teacherClashes = 0;
    let roomClashes = 0;
    for (const l of lessons) {
        const p = l.streamPeriods[l.period];
        if (!p) continue;
        const at: [number, number] = [minutesOf(p.start), minutesOf(p.end)];
        for (const [kind, id] of [['t', l.teacherId], ['r', l.roomId]] as const) {
            if (!id) continue;
            const key = `${kind}|${id}|${l.day}`;
            const taken = slots.get(key) ?? [];
            if (taken.some(t => at[0] < t[1] && t[0] < at[1])) {
                if (kind === 't') teacherClashes++;
                else roomClashes++;
            }
            taken.push(at);
            slots.set(key, taken);
        }
    }
    return { teacherClashes, roomClashes };
}

/** One teaching load's lessons a week against what a draft gives it. */
export interface HoursLine {
    loadId: string;
    className: string;
    subject: string;
    required: number;
    /** Of its lessons a week, those the draft has (never more than `required`). */
    placed: number;
    /** Lessons beyond them: extras in periods that would have been free. */
    extra: number;
}

/**
 * Each load's lessons in a draft against its lessons a week: what a school
 * checks before publishing, that the Ministry's hours were kept. Lessons
 * beyond a load's count as extra, never as making up for another's.
 */
export function hoursCheck(
    loads: readonly { id: string; className: string; subject: string; lessons: number }[],
    lessons: readonly { requirement_id?: string | null }[],
): { lines: HoursLine[]; short: HoursLine[]; required: number; placed: number; extra: number } {
    const placedBy = new Map<string, number>();
    for (const l of lessons) if (l.requirement_id) placedBy.set(l.requirement_id, (placedBy.get(l.requirement_id) ?? 0) + 1);
    const lines = loads.map(l => {
        const got = placedBy.get(l.id) ?? 0;
        return { loadId: l.id, className: l.className, subject: l.subject, required: l.lessons, placed: Math.min(l.lessons, got), extra: Math.max(0, got - l.lessons) };
    });
    const short = lines.filter(l => l.placed < l.required);
    const total = (key: 'required' | 'placed' | 'extra') => lines.reduce((n, l) => n + l[key], 0);
    return { lines, short, required: total('required'), placed: total('placed'), extra: total('extra') };
}

/** A class's teaching periods a week, for counting those a draft leaves free. */
export interface ClassWeek { streamId: string; name: string; capacity: number }

/** Each class's teaching periods a week still without a lesson, most first. */
export function freePeriods(
    classes: readonly ClassWeek[],
    lessons: readonly { grade_stream_id: string; day: number; period: number }[],
): { total: number; byClass: { name: string; free: number }[] } {
    const taken = new Map<string, Set<string>>();
    for (const l of lessons) taken.set(l.grade_stream_id, (taken.get(l.grade_stream_id) ?? new Set<string>()).add(`${l.day}|${l.period}`));
    const byClass = classes
        .map(c => ({ name: c.name, free: Math.max(0, c.capacity - (taken.get(c.streamId)?.size ?? 0)) }))
        .filter(c => c.free > 0)
        .sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
    return { total: byClass.reduce((n, c) => n + c.free, 0), byClass };
}

/**
 * The free-periods check in words, the same on the web and in the app.
 * `filled`: the draft was generated with free periods filled.
 */
export function freePeriodsCheck(free: ReturnType<typeof freePeriods>, filled: boolean, extra: number): { ok: boolean; title: string; detail: string } {
    const lessons = (n: number) => `${n} extra lesson${n === 1 ? '' : 's'}`;
    if (free.total === 0) {
        return {
            ok: true,
            title: 'Every class period has a lesson',
            detail: extra > 0 ? `${lessons(extra)} fill what would have been free periods, with nobody booked twice.` : 'No class has a free period.',
        };
    }
    const where = `${free.byClass.slice(0, 4).map(c => `${c.name}: ${c.free}`).join(', ')}${free.byClass.length > 4 ? ', …' : ''}.`;
    return {
        ok: false,
        title: `${free.total} free period${free.total === 1 ? '' : 's'} left`,
        detail: filled
            ? `${where} ${extra > 0 ? `${lessons(extra)} were added where teachers were free; ` : ''}no teacher of the class was free then, or they already have their extras. Reshuffle to try again, or use them for private study.`
            : `${where} Filling free periods is off for this draft. Turn it on above and generate again to give them extra lessons.`,
    };
}
