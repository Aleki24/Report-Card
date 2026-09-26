import { z } from 'zod';
import { defineResource, STUDENT_JOIN, personJoin } from '../resource';
import {
    text, optionalText, isoDate, optionalDate, uuid, oneOf, count, bool, personId,
    optionalPersonId, isoDateTime, optionalUuid,
} from '../zod-fields';

// ── Boarding ─────────────────────────────────────────────────

export const DORM_GENDERS = ['MALE', 'FEMALE', 'MIXED'] as const;
export const ROLL_SESSIONS = ['MORNING', 'EVENING', 'NIGHT'] as const;
export type RollSession = (typeof ROLL_SESSIONS)[number];
export const ROLL_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXEAT', 'SICK_BAY'] as const;
export type RollStatus = (typeof ROLL_STATUSES)[number];
export const EXEAT_TYPES = ['WEEKEND', 'MEDICAL', 'FAMILY', 'OFFICIAL', 'OTHER'] as const;
export const EXEAT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'OUT', 'RETURNED'] as const;
export type ExeatStatus = (typeof EXEAT_STATUSES)[number];

export const dorms = defineResource({
    table: 'dorms',
    module: 'boarding',
    label: { singular: 'Dorm', plural: 'Dorms' },
    read: ['boarding.view'],
    write: ['boarding.manage'],
    schema: z.object({
        name: text(100),
        house: optionalText(100),
        gender: oneOf(DORM_GENDERS).default('MIXED'),
        capacity: count(2000).default(0),
        patron_id: optionalPersonId,
    }),
    select: `*, ${personJoin('patron', 'dorms', 'patron_id')}`,
    order: { column: 'name' },
    userRefs: ['patron_id'],
});

export const dormAllocations = defineResource({
    table: 'dorm_allocations',
    module: 'boarding',
    label: { singular: 'Bed allocation', plural: 'Bed allocations' },
    read: ['boarding.view'],
    write: ['boarding.manage'],
    schema: z.object({
        dorm_id: uuid,
        student_id: personId,
        bed_label: optionalText(50),
        allocated_on: isoDate,
        ended_on: optionalDate,
    }),
    select: `*, dorm:dorms(name), ${STUDENT_JOIN}`,
    order: { column: 'allocated_on', ascending: false },
    filters: ['dorm_id', 'student_id'],
    flags: { current: { column: 'ended_on', isNull: true } },
    refs: { dorm_id: 'dorms', student_id: 'students' },
    maxRows: 3000,
});

export const exeats = defineResource({
    table: 'exeats',
    module: 'boarding',
    label: { singular: 'Exeat', plural: 'Exeats' },
    read: ['boarding.view'],
    write: ['boarding.manage'],
    schema: z.object({
        student_id: personId,
        exeat_type: oneOf(EXEAT_TYPES).default('WEEKEND'),
        leave_at: isoDateTime,
        return_by: isoDateTime,
        reason: optionalText(1000),
    }),
    validate: v => (Date.parse(String(v.return_by)) <= Date.parse(String(v.leave_at)) ? 'The return time must be after leaving.' : null),
    select: `*, ${STUDENT_JOIN}, ${personJoin('requester', 'exeats', 'requested_by')}`,
    order: { column: 'leave_at', ascending: false },
    filters: ['status', 'student_id'],
    refs: { student_id: 'students' },
    createdByColumn: 'requested_by',
    audit: true,
});

export const dormInspections = defineResource({
    table: 'dorm_inspections',
    module: 'boarding',
    label: { singular: 'Inspection', plural: 'Dorm inspections' },
    read: ['boarding.view'],
    write: ['boarding.manage', 'boarding.rollcall'],
    schema: z.object({
        dorm_id: uuid,
        inspected_on: isoDate,
        score: count(100),
        remarks: optionalText(1000),
    }),
    select: `*, dorm:dorms(name), ${personJoin('inspector', 'dorm_inspections', 'inspected_by')}`,
    order: { column: 'inspected_on', ascending: false },
    filters: ['dorm_id'],
    refs: { dorm_id: 'dorms' },
    createdByColumn: 'inspected_by',
});

// ── Health ───────────────────────────────────────────────────

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const VISIT_OUTCOMES = ['RETURNED_TO_CLASS', 'SICK_BAY', 'SENT_HOME', 'REFERRED'] as const;
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

export const medicalProfiles = defineResource({
    table: 'medical_profiles',
    module: 'health',
    label: { singular: 'Medical profile', plural: 'Medical profiles' },
    read: ['health.clinical'],
    write: ['health.manage'],
    schema: z.object({
        student_id: personId,
        blood_group: z.preprocess(v => (v === '' ? null : v), z.enum(BLOOD_GROUPS).nullable()).optional(),
        allergies: optionalText(1000),
        conditions: optionalText(1000),
        regular_medication: optionalText(1000),
        sha_number: optionalText(50),
        doctor_name: optionalText(150),
        doctor_phone: optionalText(30),
        emergency_contact: optionalText(150),
        emergency_phone: optionalText(30),
        consent_on_file: bool.default(false),
        notes: optionalText(2000),
    }),
    select: `*, ${STUDENT_JOIN}`,
    order: { column: 'created_at', ascending: false },
    filters: ['student_id'],
    refs: { student_id: 'students' },
    audit: true,
    maxRows: 5000,
});

export const medicineStock = defineResource({
    table: 'medicine_stock',
    module: 'health',
    label: { singular: 'Medicine', plural: 'Medicine stock' },
    read: ['health.clinical'],
    write: ['health.manage'],
    schema: z.object({
        name: text(150),
        unit: text(30).default('tablet'),
        quantity: count(),
        reorder_level: count().default(0),
        batch: optionalText(60),
        expiry_date: optionalDate,
    }),
    order: { column: 'name' },
    audit: true,
});

export const medicationLogs = defineResource({
    table: 'medication_logs',
    module: 'health',
    label: { singular: 'Dose', plural: 'Medication given' },
    read: ['health.clinical'],
    write: ['health.manage'],
    schema: z.object({
        student_id: personId,
        stock_id: optionalUuid,
        medicine: text(150),
        dose: optionalText(100),
        quantity: count(1000).default(1),
        given_at: isoDateTime,
        notes: optionalText(1000),
    }),
    select: `*, ${STUDENT_JOIN}, ${personJoin('giver', 'medication_logs', 'given_by')}`,
    order: { column: 'given_at', ascending: false },
    filters: ['student_id'],
    refs: { student_id: 'students', stock_id: 'medicine_stock' },
    createdByColumn: 'given_by',
    audit: true,
});

// ── Discipline ───────────────────────────────────────────────

export const INCIDENT_CATEGORIES = ['LATENESS', 'TRUANCY', 'FIGHTING', 'BULLYING', 'CHEATING', 'INSUBORDINATION', 'PROPERTY_DAMAGE', 'SUBSTANCE', 'UNIFORM', 'OTHER'] as const;
export const INCIDENT_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const INCIDENT_ACTIONS = ['NONE', 'WARNING', 'COUNSELLING', 'PUNISHMENT', 'PARENT_CALLED', 'SUSPENSION', 'EXPULSION'] as const;
export const INCIDENT_STATUSES = ['OPEN', 'RESOLVED'] as const;

export const disciplineIncidents = defineResource({
    table: 'discipline_incidents',
    module: 'discipline',
    label: { singular: 'Incident', plural: 'Discipline incidents' },
    read: ['discipline.manage'],
    write: ['discipline.manage'],
    schema: z.object({
        student_id: personId,
        occurred_on: isoDate,
        category: oneOf(INCIDENT_CATEGORIES),
        severity: oneOf(INCIDENT_SEVERITIES).default('MINOR'),
        description: text(3000),
        action_taken: oneOf(INCIDENT_ACTIONS).default('NONE'),
        status: oneOf(INCIDENT_STATUSES).default('OPEN'),
        parent_notified: bool.default(false),
    }),
    select: `*, ${STUDENT_JOIN}, ${personJoin('reporter', 'discipline_incidents', 'reported_by')}`,
    order: { column: 'occurred_on', ascending: false },
    filters: ['student_id', 'status', 'severity', 'category'],
    refs: { student_id: 'students' },
    own: {
        column: 'reported_by',
        permission: 'discipline.record',
        fields: ['student_id', 'occurred_on', 'category', 'severity', 'description'],
        editableWhile: { column: 'status', values: ['OPEN'] },
    },
    audit: true,
});
