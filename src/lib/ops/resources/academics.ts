import { z } from 'zod';
import { defineResource } from '../resource';
import {
    text, optionalText, isoDate, optionalDate, optionalUuid, uuid, oneOf,
    count, optionalCount, optionalPersonId, personId,
} from '../zod-fields';

export const EVENT_TYPES = ['EXAM', 'CAT', 'MARKS_DEADLINE', 'REPORT_RELEASE', 'MEETING', 'HOLIDAY', 'SPORTS', 'OPENING', 'CLOSING', 'OTHER'] as const;
export const EVENT_AUDIENCES = ['ALL', 'STAFF', 'STUDENTS', 'PARENTS'] as const;
export const ROOM_TYPES = ['CLASSROOM', 'LAB', 'COMPUTER', 'HALL', 'FIELD', 'OTHER'] as const;

export const schoolEvents = defineResource({
    table: 'school_events',
    module: 'calendar',
    label: { singular: 'Event', plural: 'Calendar events' },
    read: ['calendar.view'],
    write: ['calendar.manage'],
    schema: z.object({
        title: text(200),
        event_type: oneOf(EVENT_TYPES).default('OTHER'),
        audience: oneOf(EVENT_AUDIENCES).default('ALL'),
        starts_on: isoDate,
        ends_on: optionalDate,
        exam_id: optionalUuid,
        description: optionalText(2000),
    }),
    validate: v => (v.ends_on && String(v.ends_on) < String(v.starts_on) ? 'The end date must not be before the start.' : null),
    order: { column: 'starts_on', ascending: true },
    filters: ['event_type', 'audience'],
    refs: { exam_id: 'exams' },
    createdByColumn: 'created_by',
});

export const rooms = defineResource({
    table: 'rooms',
    module: 'timetable',
    label: { singular: 'Room', plural: 'Rooms' },
    read: ['timetable.view'],
    write: ['timetable.manage'],
    schema: z.object({
        name: text(100),
        room_type: oneOf(ROOM_TYPES).default('CLASSROOM'),
        capacity: optionalCount(2000),
    }),
    order: { column: 'name' },
});

export const timetableRequirements = defineResource({
    table: 'timetable_requirements',
    module: 'timetable',
    label: { singular: 'Teaching load', plural: 'Teaching loads' },
    read: ['timetable.view'],
    write: ['timetable.manage'],
    schema: z.object({
        grade_stream_id: uuid,
        subject_id: uuid,
        teacher_id: optionalPersonId,
        lessons_per_week: count(20).pipe(z.number().min(1, 'At least one lesson')),
        double_lessons: count(10).default(0),
        room_type: z.preprocess(v => (v === '' ? null : v), z.enum(ROOM_TYPES).nullable()).optional(),
    }),
    validate: v => (Number(v.double_lessons ?? 0) * 2 > Number(v.lessons_per_week) ? 'Each double uses two of the weekly lessons.' : null),
    select: '*, stream:grade_streams(full_name), subject:subjects(name, code), teacher:users!timetable_requirements_teacher_id_fkey(first_name, last_name)',
    order: { column: 'created_at' },
    filters: ['grade_stream_id', 'teacher_id'],
    refs: { grade_stream_id: 'grade_streams', subject_id: 'school_subject_catalogue' },
    userRefs: ['teacher_id'],
    maxRows: 3000,
});

export const timetableSubstitutions = defineResource({
    table: 'timetable_substitutions',
    module: 'timetable',
    label: { singular: 'Cover', plural: 'Lesson cover' },
    read: ['timetable.view'],
    write: ['timetable.manage'],
    schema: z.object({
        lesson_id: uuid,
        cover_date: isoDate,
        absent_teacher_id: optionalPersonId,
        cover_teacher_id: personId,
        reason: optionalText(500),
    }),
    select: '*, lesson:timetable_lessons(day, period, stream:grade_streams(full_name), subject:subjects(name)), cover:users!timetable_substitutions_cover_teacher_id_fkey(first_name, last_name), absent:users!timetable_substitutions_absent_teacher_id_fkey(first_name, last_name)',
    order: { column: 'cover_date', ascending: false },
    filters: ['cover_date'],
    refs: { lesson_id: 'timetable_lessons' },
    userRefs: ['absent_teacher_id', 'cover_teacher_id'],
    createdByColumn: 'created_by',
});

// ── Professional records ─────────────────────────────────────

const OWN_RECORD = { column: 'teacher_id', permission: 'lesson_records.write' } as const;

export const schemesOfWork = defineResource({
    table: 'schemes_of_work',
    module: 'lesson_records',
    label: { singular: 'Scheme of work', plural: 'Schemes of work' },
    read: ['lesson_records.review'],
    write: ['lesson_records.review'],
    schema: z.object({
        teacher_id: optionalPersonId,
        subject_id: uuid,
        grade_stream_id: uuid,
        term_id: optionalUuid,
        title: text(200),
    }),
    select: '*, subject:subjects(name), stream:grade_streams(full_name), teacher:users!schemes_of_work_teacher_id_fkey(first_name, last_name), term:terms(name)',
    order: { column: 'created_at', ascending: false },
    filters: ['teacher_id', 'status', 'grade_stream_id', 'subject_id'],
    refs: { subject_id: 'school_subject_catalogue', grade_stream_id: 'grade_streams', term_id: 'terms' },
    userRefs: ['teacher_id'],
    own: { ...OWN_RECORD, fields: ['subject_id', 'grade_stream_id', 'term_id', 'title'], editableWhile: { column: 'status', values: ['DRAFT', 'RETURNED'] } },
});

export const lessonPlans = defineResource({
    table: 'lesson_plans',
    module: 'lesson_records',
    label: { singular: 'Lesson plan', plural: 'Lesson plans' },
    read: ['lesson_records.review'],
    write: [],
    schema: z.object({
        teacher_id: optionalPersonId,
        scheme_entry_id: optionalUuid,
        subject_id: uuid,
        grade_stream_id: uuid,
        lesson_date: isoDate,
        topic: text(300),
        objectives: optionalText(3000),
        introduction: optionalText(3000),
        development: optionalText(5000),
        conclusion: optionalText(3000),
        resources: optionalText(2000),
        reflection: optionalText(3000),
    }),
    select: '*, subject:subjects(name), stream:grade_streams(full_name), teacher:users!lesson_plans_teacher_id_fkey(first_name, last_name)',
    order: { column: 'lesson_date', ascending: false },
    filters: ['teacher_id', 'grade_stream_id', 'subject_id'],
    refs: { subject_id: 'school_subject_catalogue', grade_stream_id: 'grade_streams', scheme_entry_id: 'scheme_entries' },
    userRefs: ['teacher_id'],
    own: OWN_RECORD,
});

export const recordsOfWork = defineResource({
    table: 'records_of_work',
    module: 'lesson_records',
    label: { singular: 'Record of work', plural: 'Records of work' },
    read: ['lesson_records.review'],
    write: [],
    schema: z.object({
        teacher_id: optionalPersonId,
        scheme_entry_id: optionalUuid,
        subject_id: uuid,
        grade_stream_id: uuid,
        lesson_date: isoDate,
        work_covered: text(3000),
        remarks: optionalText(2000),
    }),
    select: '*, subject:subjects(name), stream:grade_streams(full_name), teacher:users!records_of_work_teacher_id_fkey(first_name, last_name)',
    order: { column: 'lesson_date', ascending: false },
    filters: ['teacher_id', 'grade_stream_id', 'subject_id'],
    refs: { subject_id: 'school_subject_catalogue', grade_stream_id: 'grade_streams', scheme_entry_id: 'scheme_entries' },
    userRefs: ['teacher_id'],
    own: OWN_RECORD,
});

export const CBC_LEVELS = ['EE', 'ME', 'AE', 'BE'] as const;
export const CBC_LEVEL_LABELS: Record<(typeof CBC_LEVELS)[number], string> = {
    EE: 'Exceeding expectations',
    ME: 'Meeting expectations',
    AE: 'Approaching expectations',
    BE: 'Below expectations',
};
