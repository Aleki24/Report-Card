/**
 * A school's day structure for the timetable: which weekdays run and the
 * periods (breaks included), plus solver preferences. Client-safe.
 */
import { z } from 'zod';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

export const periodSchema = z.object({
    label: z.string().trim().min(1).max(40),
    start: hhmm,
    end: hhmm,
    is_break: z.boolean(),
}).refine(p => p.end > p.start, { message: 'A period must end after it starts', path: ['end'] });

export const timetableConfigSchema = z.object({
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7)
        .refine(d => new Set(d).size === d.length, 'Each day once'),
    periods: z.array(periodSchema).min(1).max(20)
        .refine(ps => ps.some(p => !p.is_break), 'At least one teaching period')
        .refine(ps => ps.every((p, i) => i === 0 || p.start >= ps[i - 1].end), 'Periods must be in order without overlapping'),
    rules: z.object({
        max_consecutive: z.number().int().min(1).max(12).default(4),
    }).default({ max_consecutive: 4 }),
});

export type TimetableConfig = z.infer<typeof timetableConfigSchema>;
export type TimetablePeriod = z.infer<typeof periodSchema>;

/** A typical Kenyan 8-lesson day: two short breaks and lunch. */
export const DEFAULT_TIMETABLE_CONFIG: TimetableConfig = {
    days: [1, 2, 3, 4, 5],
    periods: [
        { label: 'P1', start: '08:00', end: '08:40', is_break: false },
        { label: 'P2', start: '08:40', end: '09:20', is_break: false },
        { label: 'Short break', start: '09:20', end: '09:30', is_break: true },
        { label: 'P3', start: '09:30', end: '10:10', is_break: false },
        { label: 'P4', start: '10:10', end: '10:50', is_break: false },
        { label: 'Tea break', start: '10:50', end: '11:20', is_break: true },
        { label: 'P5', start: '11:20', end: '12:00', is_break: false },
        { label: 'P6', start: '12:00', end: '12:40', is_break: false },
        { label: 'Lunch', start: '12:40', end: '14:00', is_break: true },
        { label: 'P7', start: '14:00', end: '14:40', is_break: false },
        { label: 'P8', start: '14:40', end: '15:20', is_break: false },
    ],
    rules: { max_consecutive: 4 },
};

/** Subject categories that prefer morning periods. */
export const MORNING_CATEGORIES: ReadonlySet<string> = new Set(['MATHEMATICS', 'SCIENCE']);

/** A lesson as the timetable pages read it. */
export interface TimetableLesson {
    id: string;
    day: number;
    period: number;
    grade_stream_id: string;
    subject_id: string;
    teacher_id: string | null;
    room_id: string | null;
    locked: boolean;
    stream: { full_name: string } | null;
    subject: { name: string; code: string } | null;
    teacher: { first_name: string; last_name: string } | null;
    room: { name: string } | null;
}

export interface TimetableVersion {
    id: string;
    name: string;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    stats: { placed?: number; required?: number; cost?: number; unplaced?: { label: string; lessons: number }[] };
    created_at: string;
    published_at: string | null;
}

export const LESSON_SELECT = 'id, day, period, grade_stream_id, subject_id, teacher_id, room_id, locked, stream:grade_streams(full_name), subject:subjects(name, code), teacher:users!timetable_lessons_teacher_id_fkey(first_name, last_name), room:rooms(name)';
