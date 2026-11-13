/**
 * Calendar, exam papers, timetable, professional records and CBC: the row
 * shapes, status colours and form fields the web pages and the mobile
 * screens share.
 */
import type { FieldDef, FieldName } from '../form';
import type { LookupOption } from '../lookups';
import type { PersonName } from '../resource';
import type { PillTone } from '../tones';
import { today } from '../format';
import { CBC_LEVELS, EVENT_AUDIENCES, EVENT_TYPES, ROOM_TYPES } from '../resources/academics';
import type { PaperAction, PaperStatus, PrintStatus } from '../../academics/exam-papers';
import {
    ACTIVITY_LABELS, CURRICULUM_BANDS, LATEST_ACTIVITY_END, LATEST_LESSON_END, MAIN_SECTION_ID, SECTION_PRESETS, USUAL_LAST_END, WEEKDAY_LABELS,
    daysLabel, hhmmOf, lessonLength, lessonsOn, minutesOf, weeklyLessons, withActivities, type ActivityKind, type TimetableActivity,
    type TimetableConfig, type TimetableLesson, type TimetablePeriod, type TimetableVersion,
} from '../../timetable/config';
import type { CurriculumBand } from '../../curriculum-bands';
import { blockLabel } from '../../timetable/blocks';

// ── Calendar ─────────────────────────────────────────────────

export type EventType = (typeof EVENT_TYPES)[number];

export interface SchoolEvent {
    id: string;
    title: string;
    event_type: EventType;
    audience: (typeof EVENT_AUDIENCES)[number];
    starts_on: string;
    ends_on: string | null;
    description: string | null;
}

export const EVENT_TYPE_TONES: Record<EventType, PillTone> = {
    EXAM: 'violet', CAT: 'violet', MARKS_DEADLINE: 'bad', REPORT_RELEASE: 'good', MEETING: 'info',
    HOLIDAY: 'warn', SPORTS: 'info', OPENING: 'good', CLOSING: 'warn', OTHER: 'neutral',
};

export const EVENT_FIELDS: readonly FieldDef<FieldName<'events'>>[] = [
    { name: 'title', label: 'Title', kind: 'text', required: true, span: 'full' },
    { name: 'event_type', label: 'Type', kind: 'enum', values: EVENT_TYPES, required: true },
    { name: 'audience', label: 'Who sees it', kind: 'enum', values: EVENT_AUDIENCES, required: true },
    { name: 'starts_on', label: 'Starts', kind: 'date', required: true },
    { name: 'ends_on', label: 'Ends', kind: 'date', hint: 'Leave empty for a one-day event.' },
    { name: 'exam_id', label: 'Linked exam', kind: 'lookup', lookup: 'exams', span: 'full' },
    { name: 'description', label: 'Details', kind: 'textarea' },
];
export const eventDefaults = () => ({ event_type: 'OTHER', audience: 'ALL', starts_on: today() });

/** Events still to come (or running today), grouped by the month they start in. */
export function upcomingByMonth(rows: readonly SchoolEvent[]): [month: string, events: SchoolEvent[]][] {
    const from = today();
    const groups = new Map<string, SchoolEvent[]>();
    for (const e of rows.filter(r => (r.ends_on ?? r.starts_on) >= from)) {
        const key = e.starts_on.slice(0, 7);
        groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()];
}

export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
export const isHappeningToday = (e: SchoolEvent) => e.starts_on <= today() && (e.ends_on ?? e.starts_on) >= today();

// ── Exam papers ──────────────────────────────────────────────

export interface ExamPaper {
    id: string;
    title: string;
    status: PaperStatus;
    print_status: PrintStatus;
    paper_label: string | null;
    copies_needed: number;
    release_at: string | null;
    uploaded_by: string | null;
    paper_path: string | null;
    scheme_path: string | null;
    updated_at: string;
    subject: { name: string; code: string } | null;
    grade: { name_display: string } | null;
    term: { name: string } | null;
    exam: { name: string } | null;
    uploader: PersonName | null;
    moderator: PersonName | null;
}

export interface PaperReview {
    id: string;
    action: PaperAction;
    comment: string | null;
    created_at: string;
    reviewer: PersonName | null;
}

export const PAPER_STATUS_TONES: Record<PaperStatus, PillTone> = {
    DRAFT: 'neutral',
    SUBMITTED: 'info',
    RETURNED: 'warn',
    APPROVED: 'good',
    LOCKED: 'violet',
    RELEASED: 'good',
};

export const PRINT_STATUS_TONES: Record<PrintStatus, PillTone> = {
    PENDING: 'warn',
    PRINTED: 'info',
    PACKED: 'good',
};

/** The order a paper's actions are offered in. */
export const PAPER_ACTION_ORDER: readonly PaperAction[] = ['SUBMIT', 'APPROVE', 'RETURN', 'LOCK', 'RELEASE'];

/** The file types a paper or marking scheme may be. */
export const PAPER_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

/** What the upload form collects besides the files. */
export const EMPTY_PAPER_FORM = { title: '', subject_id: '', grade_id: '', term_id: '', exam_id: '', paper_label: '', copies_needed: '', release_at: '' };
export type PaperForm = typeof EMPTY_PAPER_FORM;

/** The upload form as multipart fields: blanks dropped, the release time as ISO. */
export const paperFormFields = (form: PaperForm): Record<string, string> =>
    Object.fromEntries(Object.entries(form).filter(([, v]) => v).map(([k, v]) => [k, k === 'release_at' ? new Date(v).toISOString() : v]));

export const paperSearchText = (p: ExamPaper) => `${p.title} ${p.subject?.name ?? ''} ${p.uploader ? `${p.uploader.first_name} ${p.uploader.last_name}` : ''}`;
export const papersToPrint = (papers: readonly ExamPaper[]) => papers.filter(p => (p.status === 'APPROVED' || p.status === 'LOCKED') && p.print_status !== 'PACKED').length;

// ── Timetable ────────────────────────────────────────────────

export interface Room { id: string; name: string; room_type: string; capacity: number | null }
/** "Automatic", then Option A–L, as the load form offers them. */
export const OPTION_BLOCK_CHOICES: readonly LookupOption[] = [
    { id: '', label: 'Automatic' },
    ...Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: blockLabel(i + 1) })),
];

export interface TeachingLoad {
    id: string;
    option_block: number | null;
    lessons_per_week: number;
    double_lessons: number;
    room_type: string | null;
    stream: { full_name: string } | null;
    subject: { name: string; code: string } | null;
    teacher: PersonName | null;
}
export interface CoverCandidate { id: string; name: string; sameSubject: boolean; weeklyLessons: number }
export interface CoverNeed { lesson: TimetableLesson; candidates: CoverCandidate[]; coveredBy: string | null }
export interface CoverRow {
    id: string;
    cover_date: string;
    reason: string | null;
    lesson: { day: number; period: number; stream: { full_name: string } | null; subject: { name: string } | null } | null;
    cover: PersonName | null;
    absent: PersonName | null;
}
/** Whose timetable to show: your own, or a class's, teacher's or room's. */
export type GridMode = 'class' | 'teacher' | 'room';
export type TimetableView = 'mine' | GridMode;
export interface TimetableViewResult {
    config: TimetableConfig;
    lessons: TimetableLesson[];
    published: boolean;
    /** How to label cells: a learner's own timetable is a class view, a teacher's a teacher view. */
    mode: GridMode;
}

export const TIMETABLE_VIEWS: readonly { id: TimetableView; label: string }[] = [
    { id: 'mine', label: 'My timetable' }, { id: 'class', label: 'A class' }, { id: 'teacher', label: 'A teacher' }, { id: 'room', label: 'A room' },
];

export const VERSION_TONES: Record<TimetableVersion['status'], PillTone> = { DRAFT: 'neutral', PUBLISHED: 'good', ARCHIVED: 'warn' };

export const ROOM_FIELDS: readonly FieldDef<FieldName<'rooms'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true },
    { name: 'room_type', label: 'Type', kind: 'enum', values: ROOM_TYPES, required: true },
    { name: 'capacity', label: 'Seats', kind: 'number' },
];
export const ROOM_DEFAULTS = { room_type: 'CLASSROOM' } as const;

export const LOAD_FIELDS: readonly FieldDef<FieldName<'timetable-requirements'>>[] = [
    { name: 'grade_stream_id', label: 'Class', kind: 'lookup', lookup: 'streams', required: true },
    { name: 'subject_id', label: 'Subject', kind: 'lookup', lookup: 'subjects', required: true },
    { name: 'teacher_id', label: 'Teacher', kind: 'lookup', lookup: 'staff', span: 'full' },
    { name: 'lessons_per_week', label: 'Lessons a week', kind: 'number', required: true },
    { name: 'double_lessons', label: 'Of which doubles', kind: 'number', hint: 'Each double uses two lessons (sciences often have one).' },
    { name: 'room_type', label: 'Needs a room type', kind: 'enum', values: ROOM_TYPES, hint: 'e.g. LAB for practicals.' },
    {
        name: 'option_block', label: 'Option block', kind: 'options', options: OPTION_BLOCK_CHOICES,
        hint: 'Electives in the same block run at the same time, each learner in the one they chose. Leave on Automatic and blocks are worked out when a class has more subjects than periods.',
    },
];
export const LOAD_DEFAULTS = { lessons_per_week: '5', double_lessons: '0' } as const;

export const loadLessonsLabel = (l: TeachingLoad) => `${l.lessons_per_week}${l.double_lessons ? ` (${l.double_lessons}×2)` : ''}${l.option_block ? ` · ${blockLabel(l.option_block)}` : ''}`;

/** "Form 1 East 40 · Form 1 West 38": each class's weekly lessons across its loads. */
export function weeklyLessonsPerClass(rows: readonly TeachingLoad[]): string {
    const perClass = new Map<string, number>();
    rows.forEach(r => perClass.set(r.stream?.full_name ?? '', (perClass.get(r.stream?.full_name ?? '') ?? 0) + r.lessons_per_week));
    return [...perClass.entries()].sort().map(([c, n]) => `${c} ${n}`).join(' · ');
}

export interface ImportLoadsResult {
    created: number;
    updated: number;
    /** Loads whose teacher was changed to match Subjects → Teachers. */
    reassigned?: number;
}

export const importLoadsMessage = ({ created, updated, reassigned = 0 }: ImportLoadsResult) => {
    const parts = [
        created > 0 ? `${created} teaching loads added` : '',
        reassigned > 0 ? `${reassigned} given their new teacher` : '',
        updated > 0 ? `${updated} reset to Ministry figures` : '',
    ].filter(Boolean);
    return parts.length === 0 ? 'Every load already matches Subjects → Teachers.' : `${parts.join(', ')}. Adjust any of them below.`;
};

/** What importing loads does, shown on the web and in the app. */
export const IMPORT_LOADS_NOTE = 'Creates a load for every subject each teacher is assigned to a class this year. When you change who teaches a subject in Subjects → Teachers, its loads follow automatically.';

/** How weekly lessons are set when loads are imported. */
export const MINISTRY_LOADS_NOTE = 'Lessons a week follow the KICD / Ministry allocation for each level (e.g. Grade 7 Mathematics 5, Integrated Science 5 with a double). Subjects it does not cover get the number you set.';

/** Asked before every subject's lessons a week are set back to the Ministry's figures (web and app). */
export const MATCH_MINISTRY_CONFIRM = {
    title: 'Match the Ministry for every class?',
    message: 'Every subject the Ministry sets lessons for gets its figure, doubles included. Subjects it does not cover keep theirs.',
    confirmText: 'Match the Ministry',
} as const;

export const teacherName = (t: TimetableLesson['teacher']) => (t ? `${t.first_name} ${t.last_name}`.trim() : '');

/**
 * The codes Kenyan schools write on a timetable: ENG, MAT, KIS, CHEM. Matched
 * by name, since schools rename subjects and stored codes vary ("101",
 * "MATH_JS"). Order matters: the specific names come before the general.
 */
const SUBJECT_CODES: readonly [RegExp, string][] = [
    [/literature/i, 'LIT'], [/english/i, 'ENG'],
    [/sign language|\bksl\b/i, 'KSL'], [/kiswahili/i, 'KIS'],
    [/essential math/i, 'E.MAT'], [/core math/i, 'C.MAT'], [/math/i, 'MAT'],
    [/biology/i, 'BIO'], [/chemistry/i, 'CHEM'], [/physics/i, 'PHY'],
    [/general science/i, 'G.SCI'], [/integrated science/i, 'INT.SCI'], [/home science/i, 'H.SCI'], [/computer/i, 'COMP'],
    [/science/i, 'SCI'],
    [/geography/i, 'GEO'], [/history/i, 'HIST'], [/social studies/i, 'SST'],
    [/christian/i, 'CRE'], [/islamic/i, 'IRE'], [/hindu/i, 'HRE'], [/religio/i, 'RE'],
    [/business/i, 'BST'], [/agricultur/i, 'AGR'], [/pre[\s-]?tech/i, 'PTS'],
    [/creative/i, 'CAS'], [/sports? (and|&) recreation/i, 'S&R'], [/physical education|^pe$/i, 'PE'],
    [/community service/i, 'CSL'], [/information communication|\bict\b/i, 'ICT'], [/pastoral|\bppi\b/i, 'PPI'],
    [/french/i, 'FRE'], [/german/i, 'GER'], [/arabic/i, 'ARB'], [/mandarin|chinese/i, 'MAN'], [/indigenous|mother tongue/i, 'IND'],
    [/music/i, 'MUS'], [/fine art|^art/i, 'ART'], [/theatre|drama/i, 'THE'], [/life skills/i, 'LSK'], [/environment/i, 'ENV'],
    [/drawing/i, 'D&D'], [/aviation/i, 'AVT'], [/electric/i, 'ELEC'], [/power mechanic/i, 'PWM'], [/wood/i, 'WW'], [/metal/i, 'MW'], [/building/i, 'B&C'],
    [/guidance|counsel/i, 'G&C'], [/library|reading/i, 'LIB'],
];

/**
 * A subject's timetable code: the usual one for its name, else the letters
 * its own code starts with ("FASH_SS" gives FASH), else its initials or
 * first letters.
 */
export function subjectCode(name: string | null | undefined, code?: string | null): string {
    const n = (name ?? '').trim().replace(/\s+/g, ' ');
    if (!n) return 'LESSON';
    const known = SUBJECT_CODES.find(([re]) => re.test(n));
    if (known) return known[1];
    const own = /^[A-Za-z]{2,5}/.exec((code ?? '').trim())?.[0];
    if (own) return own.toUpperCase();
    const words = n.split(' ').filter(w => !/^(and|of|in|the|&)$/i.test(w));
    return (words.length > 1 ? words.map(w => w[0]).join('') : n.slice(0, 4)).toUpperCase();
}

const codeOf = (l: Pick<TimetableLesson, 'subject'>) => subjectCode(l.subject?.name, l.subject?.code);

/** A subject's name in running text, the long religious names shortened. */
export function shortSubject(name: string | null | undefined): string {
    const n = (name ?? '').trim().replace(/\s+/g, ' ');
    if (!n) return 'Lesson';
    return /religious education$/i.test(n) && n.split(' ').length === 3 ? subjectCode(n) : n.replace(/ and /gi, ' & ');
}

/** What a cell shows depends on whose timetable it is: the subject's code, then who and where. */
export function cellLines(l: TimetableLesson, mode: GridMode): [string, string] {
    const subject = codeOf(l);
    if (mode === 'class') return [subject, [teacherName(l.teacher), l.room?.name ?? ''].filter(Boolean).join(' · ')];
    if (mode === 'teacher') return [subject, [l.stream?.full_name ?? '', l.room?.name ?? ''].filter(Boolean).join(' · ')];
    return [subject, [l.stream?.full_name ?? '', teacherName(l.teacher)].filter(Boolean).join(' · ')];
}

/** A grid cell's two lines for one lesson, or for subjects taught at the same time to different learners. */
export function slotLines(lessons: readonly TimetableLesson[], mode: GridMode): [string, string] {
    if (lessons.length <= 1) return lessons[0] ? cellLines(lessons[0], mode) : ['', ''];
    return [lessons.map(codeOf).join(' / '), 'Each learner takes one'];
}

/** The key under a timetable: each code on it and the subject it stands for, A to Z. */
export function subjectKey(lessons: readonly Pick<TimetableLesson, 'subject'>[]): { code: string; name: string }[] {
    const seen = new Map<string, string>();
    lessons.forEach(l => { if (l.subject?.name) seen.set(codeOf(l), l.subject.name.trim()); });
    return [...seen.entries()].map(([code, name]) => ({ code, name })).sort((x, y) => x.code.localeCompare(y.code));
}

/** A timetable's week at a glance: lessons (an option block counts once), subjects and school days. */
export function weekSummary(lessons: readonly TimetableLesson[]): [string, string][] {
    const slots = new Set(lessons.map(l => `${l.day}|${l.period}|${l.grade_stream_id}`)).size;
    const subjects = new Set(lessons.map(l => l.subject_id)).size;
    const days = new Set(lessons.map(l => l.day)).size;
    return [['Lessons a week', String(slots)], ['Subjects', String(subjects)], ['Days', String(days)]];
}

/** The classes a draft covers, by name. */
export function lessonClasses(lessons: readonly TimetableLesson[]): LookupOption[] {
    const seen = new Map<string, string>();
    lessons.forEach(l => seen.set(l.grade_stream_id, l.stream?.full_name ?? ''));
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** A new lesson period (40 minutes) or break (20) after the last one in a bell. */
export function withAddedPeriodTo(periods: readonly TimetablePeriod[], isBreak: boolean): TimetablePeriod[] {
    const last = periods[periods.length - 1];
    const start = last?.end ?? '08:00';
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + (isBreak ? 20 : 40);
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const teaching = periods.filter(p => !p.is_break).length;
    return [...periods, { label: isBreak ? 'Break' : `P${teaching + 1}`, start, end, is_break: isBreak }];
}

export function withAddedPeriod(config: TimetableConfig, isBreak: boolean): TimetableConfig {
    return { ...config, periods: withAddedPeriodTo(config.periods, isBreak) };
}

/** A row is a lesson or a break: shown as a two-way choice, never a bare tick box. */
export const PERIOD_KINDS = [{ value: 'lesson', label: 'Lesson' }, { value: 'break', label: 'Break' }] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number]['value'];
export const periodKind = (p: { is_break: boolean }): PeriodKind => (p.is_break ? 'break' : 'lesson');

/** Named like a break (Short break, Tea break, Lunch, Games…) but set as a lesson, or the reverse. */
const BREAK_NAME = /\b(break|lunch|tea|recess|snack|games|assembly|prep)\b/i;
export const isMisnamedBreak = (p: { label: string; is_break: boolean }) => !p.is_break && BREAK_NAME.test(p.label);
export function periodKindMismatch(p: { label: string; is_break: boolean }): string | null {
    return isMisnamedBreak(p) ? `“${p.label}” is set as a lesson, so lessons will be timetabled in it. Set it to Break.` : null;
}

/** Every period named like a break, in the main bell and each section's, set as a break. */
export function withBreaksFixed(config: TimetableConfig): TimetableConfig {
    const fix = (periods: readonly TimetablePeriod[]) => periods.map(p => (isMisnamedBreak(p) ? { ...p, is_break: true } : p));
    return { ...config, periods: fix(config.periods), sections: config.sections.map(s => ({ ...s, periods: fix(s.periods) })) };
}

/** One period of a bell changed. */
export const withPeriodPatched = (periods: readonly TimetablePeriod[], index: number, patch: Partial<TimetablePeriod>): TimetablePeriod[] =>
    periods.map((p, i) => (i === index ? { ...p, ...patch } : p));

/**
 * A period run on one more or one fewer school day. All days ticked again is
 * the same as no days set; the last day can't be taken away (remove the
 * period instead).
 */
export function withPeriodDayToggled(periods: readonly TimetablePeriod[], index: number, day: number, schoolDays: readonly number[]): TimetablePeriod[] {
    return periods.map((p, i) => {
        if (i !== index) return p;
        const on = schoolDays.filter(d => !p.days || p.days.includes(d));
        const next = on.includes(day) ? on.filter(d => d !== day) : [...on, day].sort((a, b) => a - b);
        if (next.length === 0) return p;
        const every = { label: p.label, start: p.start, end: p.end, is_break: p.is_break };
        return next.length === schoolDays.length ? every : { ...every, days: next };
    });
}

/** "Mon–Thu" for a run of days, else "Mon, Wed". */
function daysPhrase(days: readonly number[]): string {
    const sorted = [...days].sort((a, b) => a - b);
    const run = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    if (run && sorted.length >= 3) return `${WEEKDAY_LABELS[sorted[0]]}–${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
    return sorted.map(d => WEEKDAY_LABELS[d]).join(', ');
}

/**
 * A bell in a line: "8 lessons a day · 40 a week · 08:20–15:20", or with
 * days that differ, "8 lessons Mon–Thu, 9 on Fri · 41 a week".
 */
export function bellSummary(periods: readonly TimetablePeriod[], schoolDays: readonly number[]): string {
    if (periods.length === 0 || schoolDays.length === 0) return 'No periods yet';
    const byCount = new Map<number, number[]>();
    schoolDays.forEach(d => { const n = lessonsOn(periods, d); byCount.set(n, [...(byCount.get(n) ?? []), d]); });
    const groups = [...byCount.entries()].sort((a, b) => b[1].length - a[1].length);
    const perDay = groups.length === 1
        ? `${groups[0][0]} lesson${groups[0][0] === 1 ? '' : 's'} a day`
        : groups.map(([n, days], i) => `${n} ${i === 0 ? `lesson${n === 1 ? '' : 's'} ` : ''}${i === 0 ? daysPhrase(days) : `on ${daysPhrase(days)}`}`).join(', ');
    const running = (p: TimetablePeriod) => !p.days || p.days.some(d => schoolDays.includes(d));
    const used = periods.filter(running);
    const start = used[0]?.start;
    const end = used[used.length - 1]?.end;
    return `${perDay} · ${weeklyLessons(periods, schoolDays)} a week${start && end ? ` · ${start}–${end}` : ''}`;
}

/** Overlapping or out-of-order periods in a bell, in words, or null. */
export function bellOrderProblem(periods: readonly TimetablePeriod[]): string | null {
    for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        if (p.end <= p.start) return `${p.label} ends before it starts.`;
        if (i > 0 && p.start < periods[i - 1].end) return `${p.label} starts before ${periods[i - 1].label} ends.`;
        if (!p.is_break && p.end > LATEST_LESSON_END) return `${p.label} ends at ${p.end}: lessons in Kenya end by 5 pm (${USUAL_LAST_END} at most schools). Remove it or start the day earlier.`;
    }
    return null;
}

/** A bell built from a few numbers: the form's values, read back from an existing bell. */
export interface QuickDay {
    start: string;
    lessonMinutes: number;
    lessons: number;
    breaks: { after: number; minutes: number; label: string }[];
}

export function quickDayOf(periods: readonly TimetablePeriod[]): QuickDay {
    if (periods.length === 0) return { start: '08:20', lessonMinutes: 40, lessons: 8, breaks: [{ after: 2, minutes: 10, label: 'Short break' }, { after: 4, minutes: 30, label: 'Tea break' }, { after: 6, minutes: 60, label: 'Lunch' }] };
    const breaks: QuickDay['breaks'] = [];
    let lessons = 0;
    for (const p of periods) {
        if (p.is_break) { if (lessons > 0) breaks.push({ after: lessons, minutes: minutesOf(p.end) - minutesOf(p.start), label: p.label }); }
        else if (!p.days) lessons++;
    }
    return { start: periods[0].start, lessonMinutes: lessonLength(periods), lessons: Math.max(1, lessons), breaks };
}

export type TimetableSection = TimetableConfig['sections'][number];

/** A level belongs to one section at most, so giving it to one takes it from the others. */
function claimBands(sections: readonly TimetableSection[], ownerId: string, bands: readonly CurriculumBand[]): TimetableSection[] {
    return sections
        .map(s => (s.id === ownerId ? s : { ...s, bands: s.bands.filter(b => !bands.includes(b)) }))
        .filter(s => s.id === ownerId || s.bands.length > 0);
}

/** Adds a section from a preset (or a blank one), taking its levels from other sections. */
export function withSectionAdded(config: TimetableConfig, presetKey: string | null): TimetableConfig {
    const preset = SECTION_PRESETS.find(p => p.key === presetKey);
    const id = `${preset?.key ?? 'section'}-${Date.now().toString(36)}`;
    const free = CURRICULUM_BANDS.filter(b => !config.sections.some(s => s.bands.includes(b)));
    const section: TimetableSection = preset
        ? { id, name: preset.name, bands: [...preset.bands], periods: [...preset.periods] }
        : { id, name: 'New section', bands: free.slice(0, 1), periods: [...config.periods] };
    return { ...config, sections: claimBands([...config.sections, section], id, section.bands) };
}

/** Turns a level on or off for a section. */
export function withSectionBandToggled(config: TimetableConfig, sectionId: string, band: CurriculumBand): TimetableConfig {
    const section = config.sections.find(s => s.id === sectionId);
    if (!section) return config;
    if (section.bands.includes(band)) {
        return { ...config, sections: config.sections.map(s => (s.id === sectionId ? { ...s, bands: s.bands.filter(b => b !== band) } : s)) };
    }
    const next = config.sections.map(s => (s.id === sectionId ? { ...s, bands: [...s.bands, band] } : s));
    return { ...config, sections: claimBands(next, sectionId, [band]) };
}

export const withSectionPatched = (config: TimetableConfig, sectionId: string, patch: Partial<TimetableSection>): TimetableConfig =>
    ({ ...config, sections: config.sections.map(s => (s.id === sectionId ? { ...s, ...patch } : s)) });

export const withSectionRemoved = (config: TimetableConfig, sectionId: string): TimetableConfig =>
    ({ ...config, sections: config.sections.filter(s => s.id !== sectionId) });

/** Presets whose levels are not all covered yet. */
export const openSectionPresets = (config: TimetableConfig) =>
    SECTION_PRESETS.filter(p => p.bands.some(b => !config.sections.some(s => s.bands.includes(b))));

export const SECTIONS_NOTE = 'Give levels with a different bell their own section, e.g. 30-minute lessons for Grades 1–3 and 40 for Junior School. Classes in no section follow the main day; a teacher is never booked in two sections at once.';

export const PUBLISH_TIMETABLE_WARNING = 'It replaces the timetable teachers and learners see now; the current one is archived.';
export const newDraftName = (name: string) => name.trim() || `Draft ${new Date().toLocaleDateString('en-KE')}`;

// ── Professional records ─────────────────────────────────────

export type SchemeStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
export const SCHEME_TONES: Record<SchemeStatus, PillTone> = { DRAFT: 'neutral', SUBMITTED: 'info', APPROVED: 'good', RETURNED: 'warn' };

export interface Scheme { id: string; title: string; status: SchemeStatus; teacher_id: string; subject: { name: string } | null; stream: { full_name: string } | null; teacher: PersonName | null; term: { name: string } | null }
export interface LessonPlan { id: string; topic: string; lesson_date: string; teacher_id: string; subject: { name: string } | null; stream: { full_name: string } | null; teacher: PersonName | null }
export interface WorkRecord { id: string; work_covered: string; lesson_date: string; teacher_id: string; remarks: string | null; subject: { name: string } | null; stream: { full_name: string } | null; teacher: PersonName | null }
export interface Coverage { schemeId: string; title: string; status: string; teacher: string; subject: string; className: string; planned: number; covered: number; lastTaught: string | null }

/** One row of a scheme of work (week, lesson and what it covers). */
export interface SchemeEntry {
    id?: string;
    week: number;
    lesson: number;
    topic: string;
    sub_topic: string | null;
    objectives: string | null;
    activities: string | null;
    resources: string | null;
    assessment: string | null;
}
export interface SchemeDetail {
    id: string; title: string; status: SchemeStatus; teacher_id: string; subject_id: string; grade_stream_id: string;
    review_comment: string | null; editable: boolean;
    subject: { name: string } | null; stream: { full_name: string } | null;
    teacher: PersonName | null; reviewer: PersonName | null;
    entries: (SchemeEntry & { id: string })[];
    covered: string[];
}

export const blankSchemeEntry = (week: number, lesson: number): SchemeEntry => ({ week, lesson, topic: '', sub_topic: null, objectives: null, activities: null, resources: null, assessment: null });
/** The next row after the last one: same week, next lesson. */
export const nextSchemeEntry = (entries: readonly SchemeEntry[]) => { const last = entries.at(-1); return blankSchemeEntry(last?.week ?? 1, (last?.lesson ?? 0) + 1); };
export const SCHEME_DETAIL_FIELDS = [['objectives', 'Objectives'], ['activities', 'Learning activities'], ['resources', 'Resources'], ['assessment', 'Assessment']] as const;

/** Rows with a topic, as the entries endpoint takes them. */
export const schemeEntriesPayload = (entries: readonly SchemeEntry[]) => entries
    .filter(e => e.topic.trim())
    .map(e => ({ week: Number(e.week), lesson: Number(e.lesson), topic: e.topic, sub_topic: e.sub_topic, objectives: e.objectives, activities: e.activities, resources: e.resources, assessment: e.assessment }));

export type SchemeAction = 'SUBMIT' | 'APPROVE' | 'RETURN';
export const SCHEME_ACTION_DONE: Record<SchemeAction, string> = { SUBMIT: 'Submitted for review.', APPROVE: 'Approved.', RETURN: 'Returned to the teacher.' };

/** What the viewer may do with a scheme now: the owner submits, a reviewer approves or returns. */
export function schemeActions(s: Pick<SchemeDetail, 'status'>, can: { owner: boolean; reviewer: boolean }): SchemeAction[] {
    const out: SchemeAction[] = [];
    if (can.owner && (s.status === 'DRAFT' || s.status === 'RETURNED')) out.push('SUBMIT');
    if (can.reviewer && s.status === 'SUBMITTED') out.push('APPROVE');
    if (can.reviewer && (s.status === 'SUBMITTED' || s.status === 'APPROVED')) out.push('RETURN');
    return out;
}

/** A taught lesson as a record of work. */
export const taughtRecord = (scheme: Pick<SchemeDetail, 'subject_id' | 'grade_stream_id'>, e: SchemeEntry & { id: string }) => ({
    scheme_entry_id: e.id, subject_id: scheme.subject_id, grade_stream_id: scheme.grade_stream_id, lesson_date: today(),
    work_covered: [e.topic, e.sub_topic].filter(Boolean).join(': '),
});

const CLASS_SUBJECT = [
    { name: 'grade_stream_id', label: 'Class', kind: 'lookup', lookup: 'streams', required: true },
    { name: 'subject_id', label: 'Subject', kind: 'lookup', lookup: 'subjects', required: true },
] as const;

export const SCHEME_FIELDS: readonly FieldDef<FieldName<'schemes'>>[] = [
    { name: 'title', label: 'Title', kind: 'text', required: true, span: 'full', placeholder: 'e.g. Form 3 Chemistry — Term 2' },
    ...CLASS_SUBJECT,
    { name: 'term_id', label: 'Term', kind: 'lookup', lookup: 'terms' },
];

export const PLAN_FIELDS: readonly FieldDef<FieldName<'lesson-plans'>>[] = [
    ...CLASS_SUBJECT,
    { name: 'lesson_date', label: 'Lesson date', kind: 'date', required: true },
    { name: 'topic', label: 'Topic / sub-strand', kind: 'text', required: true },
    { name: 'objectives', label: 'Specific objectives', kind: 'textarea' },
    { name: 'introduction', label: 'Introduction', kind: 'textarea' },
    { name: 'development', label: 'Lesson development', kind: 'textarea' },
    { name: 'conclusion', label: 'Conclusion', kind: 'textarea' },
    { name: 'resources', label: 'Resources', kind: 'textarea' },
    { name: 'reflection', label: 'Self-evaluation', kind: 'textarea', hint: 'After the lesson: what worked, what to change.' },
];

export const RECORD_FIELDS: readonly FieldDef<FieldName<'records-of-work'>>[] = [
    ...CLASS_SUBJECT,
    { name: 'lesson_date', label: 'Date taught', kind: 'date', required: true },
    { name: 'work_covered', label: 'Work covered', kind: 'textarea', required: true },
    { name: 'remarks', label: 'Remarks', kind: 'textarea' },
];

export const coveragePercent = (c: Coverage) => (c.planned ? Math.round((c.covered / c.planned) * 100) : 0);
export const coverageTone = (pct: number): PillTone => (pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad');
export const RECORDS_TIP = 'Tip: tick lessons as taught inside a scheme of work and they are recorded here and count towards coverage.';

// ── CBC assessment ───────────────────────────────────────────

export type CbcLevel = (typeof CBC_LEVELS)[number];
export interface CbcRow { studentId: string; name: string; admissionNumber: string | null; level: CbcLevel | null; comment: string | null }
export interface StrandOption { strand: string; subStrands: string[] }
export const CBC_LEVEL_TONES: Record<CbcLevel, PillTone> = { EE: 'good', ME: 'info', AE: 'warn', BE: 'bad' };
export const EMPTY_CBC_FILTER = { grade_stream_id: '', subject_id: '', term_id: '', strand: '', sub_strand: '' };
export type CbcFilter = typeof EMPTY_CBC_FILTER;
export const cbcFilterReady = (f: CbcFilter) => !!(f.grade_stream_id && f.subject_id && f.term_id && f.strand.trim());
export const cbcCounts = (rows: readonly CbcRow[] | null) => Object.fromEntries(CBC_LEVELS.map(l => [l, rows?.filter(r => r.level === l).length ?? 0])) as Record<CbcLevel, number>;

// ── Assembly, games and clubs ───────────────────────────────────────

/** Every bell an activity can cover: the main day and each section. */
export const activityBells = (config: TimetableConfig): { id: string; name: string; periods: readonly TimetablePeriod[] }[] => [
    { id: MAIN_SECTION_ID, name: config.sections.length > 0 ? 'Main school day' : 'Whole school', periods: config.periods },
    ...config.sections.map(s => ({ id: s.id, name: s.name, periods: s.periods })),
];

/**
 * A new activity at the usual time for its kind: assembly on Monday just
 * before the first lesson, games on Wednesday and clubs on Thursday for an
 * hour after the last lesson of the main day.
 */
export function activityPreset(config: TimetableConfig, kind: ActivityKind): TimetableActivity {
    const lessons = config.periods.filter(p => !p.is_break);
    const first = minutesOf(lessons[0]?.start ?? '08:00');
    const last = minutesOf(lessons[lessons.length - 1]?.end ?? '16:00');
    const latest = minutesOf(LATEST_ACTIVITY_END);
    const after = (day: number) => ({ days: [day], start: hhmmOf(Math.min(last, latest - 30)), end: hhmmOf(Math.min(last + 60, latest)) });
    const when = kind === 'assembly' ? { days: [1], start: hhmmOf(Math.max(0, first - 20)), end: hhmmOf(first) }
        : kind === 'games' ? after(3)
        : kind === 'clubs' ? after(4)
        : { days: [config.days[0] ?? 1], start: hhmmOf(last), end: hhmmOf(Math.min(last + 40, latest)) };
    return { id: `act${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, label: ACTIVITY_LABELS[kind], section_ids: [], ...when };
}

/** Lessons a week an activity takes from each bell it covers (none when it sits outside the lessons). */
export function lessonsTakenBy(config: TimetableConfig, activity: TimetableActivity): { name: string; lessons: number }[] {
    return activityBells(config)
        .filter(b => activity.section_ids.length === 0 || activity.section_ids.includes(b.id))
        .map(b => ({ name: b.name, lessons: weeklyLessons(b.periods, config.days) - weeklyLessons(withActivities(b.periods, [activity], config.days), config.days) }))
        .filter(x => x.lessons > 0);
}

/** An activity in a line: "Mon · 07:50–08:20 · Whole school". */
export function activityLine(config: TimetableConfig, a: TimetableActivity): string {
    const bells = activityBells(config);
    const who = a.section_ids.length === 0 ? 'Whole school' : a.section_ids.map(id => bells.find(b => b.id === id)?.name ?? 'A removed section').join(', ');
    return `${daysLabel(a.days, config.days)} · ${a.start}–${a.end} · ${who}`;
}

/** What is wrong with an activity's times, if anything. */
export function activityProblem(a: TimetableActivity): string | null {
    if (a.days.length === 0) return `${a.label}: pick its days.`;
    if (a.end <= a.start) return `${a.label} ends before it starts.`;
    if (a.end > LATEST_ACTIVITY_END) return `${a.label} must end by ${LATEST_ACTIVITY_END}.`;
    return null;
}

export const withActivityAdded = (config: TimetableConfig, kind: ActivityKind): TimetableConfig =>
    ({ ...config, rules: { ...config.rules, activities: [...config.rules.activities, activityPreset(config, kind)] } });
export const withActivityPatched = (config: TimetableConfig, id: string, patch: Partial<TimetableActivity>): TimetableConfig =>
    ({ ...config, rules: { ...config.rules, activities: config.rules.activities.map(a => (a.id === id ? { ...a, ...patch } : a)) } });
export const withActivityRemoved = (config: TimetableConfig, id: string): TimetableConfig =>
    ({ ...config, rules: { ...config.rules, activities: config.rules.activities.filter(a => a.id !== id) } });
