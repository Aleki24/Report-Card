/**
 * A school's day structure for the timetable: which weekdays run and the
 * periods (breaks included), plus solver preferences. Client-safe.
 */
import { z } from 'zod';
import { BAND_LABELS, type CurriculumBand } from '../curriculum-bands';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

export const periodSchema = z.object({
    label: z.string().trim().min(1).max(40),
    start: hhmm,
    end: hhmm,
    is_break: z.boolean(),
}).refine(p => p.end > p.start, { message: 'A period must end after it starts', path: ['end'] });

const periodsSchema = z.array(periodSchema).min(1).max(20)
    .refine(ps => ps.some(p => !p.is_break), 'At least one teaching period')
    .refine(ps => ps.every((p, i) => i === 0 || p.start >= ps[i - 1].end), 'Periods must be in order without overlapping');

export const CURRICULUM_BANDS = Object.keys(BAND_LABELS) as CurriculumBand[];

/**
 * A part of the school with its own bell: pre-primary lessons run 30
 * minutes, junior school 40. Classes in its bands follow its periods; every
 * other class follows the school's main day.
 */
export const sectionSchema = z.object({
    id: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(60),
    bands: z.array(z.enum(CURRICULUM_BANDS as [CurriculumBand, ...CurriculumBand[]])).min(1, 'Pick the levels that follow this day'),
    periods: periodsSchema,
});

export type TimetableSection = z.infer<typeof sectionSchema>;

export const timetableConfigSchema = z.object({
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7)
        .refine(d => new Set(d).size === d.length, 'Each day once'),
    periods: periodsSchema,
    sections: z.array(sectionSchema).max(8).default([])
        .refine(ss => new Set(ss.flatMap(s => s.bands)).size === ss.flatMap(s => s.bands).length, 'Each level can follow only one section'),
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
    sections: [],
    rules: { max_consecutive: 4 },
};

// ── Sections and clock times ─────────────────────────────────────────

/** "08:40" → 520. */
export const minutesOf = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const hhmmOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** The school's main day, for classes outside every section. */
export const MAIN_SECTION_ID = 'main';

/** The section a class of this band follows, or the main day. */
export function sectionFor(config: TimetableConfig, band: CurriculumBand | null | undefined): { id: string; name: string; periods: TimetablePeriod[] } {
    const section = band ? config.sections.find(s => s.bands.includes(band)) : undefined;
    return section ? { id: section.id, name: section.name, periods: section.periods } : { id: MAIN_SECTION_ID, name: 'Main school day', periods: config.periods };
}

export const periodsFor = (config: TimetableConfig, band: CurriculumBand | null | undefined): TimetablePeriod[] => sectionFor(config, band).periods;

/**
 * A day built from a start time, a lesson length and where the breaks fall:
 * the quickest way to set up a section's bell.
 */
export function buildDay(opts: { start: string; lessonMinutes: number; lessons: number; breaks: readonly { after: number; minutes: number; label: string }[] }): TimetablePeriod[] {
    const periods: TimetablePeriod[] = [];
    let t = minutesOf(opts.start);
    for (let i = 1; i <= opts.lessons; i++) {
        periods.push({ label: `P${i}`, start: hhmmOf(t), end: hhmmOf(t + opts.lessonMinutes), is_break: false });
        t += opts.lessonMinutes;
        const br = opts.breaks.find(b => b.after === i);
        if (br && i < opts.lessons) {
            periods.push({ label: br.label, start: hhmmOf(t), end: hhmmOf(t + br.minutes), is_break: true });
            t += br.minutes;
        }
    }
    return periods;
}

/** Typical Kenyan bells: lesson lengths follow KICD guidance for each level. */
export const SECTION_PRESETS: readonly { key: string; name: string; bands: CurriculumBand[]; periods: TimetablePeriod[] }[] = [
    {
        key: 'early-years',
        name: 'Pre-primary & Lower Primary',
        bands: ['CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY'],
        periods: buildDay({ start: '08:00', lessonMinutes: 30, lessons: 7, breaks: [{ after: 2, minutes: 10, label: 'Short break' }, { after: 4, minutes: 30, label: 'Tea break' }, { after: 6, minutes: 60, label: 'Lunch' }] }),
    },
    {
        key: 'upper-primary',
        name: 'Upper Primary',
        bands: ['CBC_UPPER_PRIMARY', '844_PRIMARY'],
        periods: buildDay({ start: '08:00', lessonMinutes: 35, lessons: 8, breaks: [{ after: 2, minutes: 10, label: 'Short break' }, { after: 4, minutes: 30, label: 'Tea break' }, { after: 6, minutes: 60, label: 'Lunch' }] }),
    },
    {
        key: 'secondary',
        name: 'Junior & Senior School',
        bands: ['CBC_JUNIOR_SCHOOL', 'CBC_SENIOR_SCHOOL', '844_SECONDARY'],
        periods: buildDay({ start: '08:00', lessonMinutes: 40, lessons: 8, breaks: [{ after: 2, minutes: 10, label: 'Short break' }, { after: 4, minutes: 30, label: 'Tea break' }, { after: 6, minutes: 80, label: 'Lunch' }] }),
    },
];

/** Subject categories that prefer morning periods. */
export const MORNING_CATEGORIES: ReadonlySet<string> = new Set(['MATHEMATICS', 'SCIENCE']);

/** Subject categories that suit the afternoon: PE, art, music and the like. */
export const AFTERNOON_CATEGORIES: ReadonlySet<string> = new Set(['CREATIVE']);

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
    stream: { full_name: string; grade?: { code: string | null; name_display: string | null } | null } | null;
    subject: { name: string; code: string } | null;
    teacher: { first_name: string; last_name: string } | null;
    room: { name: string } | null;
}

export interface TimetableVersion {
    id: string;
    name: string;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    stats: { placed?: number; required?: number; cost?: number; unplaced?: { label: string; lessons: number }[]; quality?: TimetableQuality };
    created_at: string;
    published_at: string | null;
}

/** How good a draft is, in terms a school can act on. */
export interface TimetableQuality {
    /** 0–100: 100 means no preference was broken. */
    score: number;
    /** A subject twice in one class's day. */
    repeatsInDay: number;
    /** Maths or a science after lunch. */
    lateCoreLessons: number;
    /** PE, art or music in the first lessons of the day. */
    earlyCreativeLessons: number;
    /** A subject in the same period on most days. */
    samePeriodHabits: number;
    /** A subject's few lessons bunched on neighbouring days. */
    bunchedWeeks: number;
    /** Teachers teaching more lessons in a row than the school allows. */
    longTeacherRuns: number;
}

export const LESSON_SELECT = 'id, day, period, grade_stream_id, subject_id, teacher_id, room_id, locked, stream:grade_streams(full_name, grade:grades(code, name_display)), subject:subjects(name, code), teacher:users!timetable_lessons_teacher_id_fkey(first_name, last_name), room:rooms(name)';

const QUALITY_NOTES: readonly { key: Exclude<keyof TimetableQuality, 'score'>; text: (n: number) => string }[] = [
    { key: 'repeatsInDay', text: n => `${n} subject${n === 1 ? '' : 's'} taught twice in a day` },
    { key: 'lateCoreLessons', text: n => `${n} core lesson${n === 1 ? '' : 's'} after lunch` },
    { key: 'earlyCreativeLessons', text: n => `${n} creative lesson${n === 1 ? '' : 's'} first thing` },
    { key: 'samePeriodHabits', text: n => `${n} subject${n === 1 ? '' : 's'} stuck in the same period` },
    { key: 'bunchedWeeks', text: n => `${n} subject${n === 1 ? '' : 's'} bunched on neighbouring days` },
    { key: 'longTeacherRuns', text: n => `${n} long teaching run${n === 1 ? '' : 's'} without a break` },
];

/** A draft's quality in words, for the builder on web and in the app. */
export function describeQuality(q: TimetableQuality): { score: number; verdict: string; tone: 'good' | 'fair' | 'poor'; notes: string[] } {
    const tone = q.score >= 85 ? 'good' : q.score >= 65 ? 'fair' : 'poor';
    const verdict = tone === 'good' ? 'Well balanced' : tone === 'fair' ? 'Workable — reshuffle to improve' : 'Needs work — check loads, then reshuffle';
    return { score: q.score, verdict, tone, notes: QUALITY_NOTES.filter(n => q[n.key] > 0).map(n => n.text(q[n.key])) };
}
