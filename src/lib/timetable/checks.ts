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
    placed: number;
}

/**
 * Each load's lessons in a draft against its lessons a week: what a school
 * checks before publishing, that the Ministry's hours were kept.
 */
export function hoursCheck(
    loads: readonly { id: string; className: string; subject: string; lessons: number }[],
    lessons: readonly { requirement_id?: string | null }[],
): { lines: HoursLine[]; short: HoursLine[]; required: number; placed: number } {
    const placedBy = new Map<string, number>();
    for (const l of lessons) if (l.requirement_id) placedBy.set(l.requirement_id, (placedBy.get(l.requirement_id) ?? 0) + 1);
    const lines = loads.map(l => ({ loadId: l.id, className: l.className, subject: l.subject, required: l.lessons, placed: Math.min(l.lessons, placedBy.get(l.id) ?? 0) }));
    const short = lines.filter(l => l.placed < l.required);
    return { lines, short, required: lines.reduce((n, l) => n + l.required, 0), placed: lines.reduce((n, l) => n + l.placed, 0) };
}
