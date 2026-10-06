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
import type { TimetableConfig, TimetableLesson, TimetableVersion } from '../../timetable/config';

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
export interface TeachingLoad {
    id: string;
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
];
export const LOAD_DEFAULTS = { lessons_per_week: '5', double_lessons: '0' } as const;

export const loadLessonsLabel = (l: TeachingLoad) => `${l.lessons_per_week}${l.double_lessons ? ` (${l.double_lessons}×2)` : ''}`;

/** "Form 1 East 40 · Form 1 West 38": each class's weekly lessons across its loads. */
export function weeklyLessonsPerClass(rows: readonly TeachingLoad[]): string {
    const perClass = new Map<string, number>();
    rows.forEach(r => perClass.set(r.stream?.full_name ?? '', (perClass.get(r.stream?.full_name ?? '') ?? 0) + r.lessons_per_week));
    return [...perClass.entries()].sort().map(([c, n]) => `${c} ${n}`).join(' · ');
}

export const importLoadsMessage = (created: number) =>
    created === 0 ? 'Every assignment already has a load.' : `${created} teaching loads added. Adjust lessons per week below.`;

export const teacherName = (t: TimetableLesson['teacher']) => (t ? `${t.first_name} ${t.last_name}`.trim() : '');

/** What a cell shows depends on whose timetable it is. */
export function cellLines(l: TimetableLesson, mode: GridMode): [string, string] {
    const subject = l.subject?.code || l.subject?.name || 'Lesson';
    if (mode === 'class') return [subject, [teacherName(l.teacher), l.room?.name ?? ''].filter(Boolean).join(' · ')];
    if (mode === 'teacher') return [subject, [l.stream?.full_name ?? '', l.room?.name ?? ''].filter(Boolean).join(' · ')];
    return [subject, [l.stream?.full_name ?? '', teacherName(l.teacher)].filter(Boolean).join(' · ')];
}

/** The classes a draft covers, by name. */
export function lessonClasses(lessons: readonly TimetableLesson[]): LookupOption[] {
    const seen = new Map<string, string>();
    lessons.forEach(l => seen.set(l.grade_stream_id, l.stream?.full_name ?? ''));
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** A new lesson period (40 minutes) or break (20) after the last one. */
export function withAddedPeriod(config: TimetableConfig, isBreak: boolean): TimetableConfig {
    const last = config.periods[config.periods.length - 1];
    const start = last?.end ?? '08:00';
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + (isBreak ? 20 : 40);
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const teaching = config.periods.filter(p => !p.is_break).length;
    return { ...config, periods: [...config.periods, { label: isBreak ? 'Break' : `P${teaching + 1}`, start, end, is_break: isBreak }] };
}

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
