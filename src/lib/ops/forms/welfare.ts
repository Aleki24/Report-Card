/**
 * Boarding, health and discipline: the row shapes, status colours, form
 * fields and workflow steps the web pages and the mobile screens share.
 */
import type { FieldDef, FieldName } from '../form';
import type { PersonName, StudentEmbed } from '../resource';
import type { PillTone } from '../tones';
import { daysUntil, nowLocalInput, today } from '../format';
import {
    BLOOD_GROUPS, DORM_GENDERS, EXEAT_TYPES, INCIDENT_ACTIONS, INCIDENT_CATEGORIES, INCIDENT_SEVERITIES, INCIDENT_STATUSES,
    VISIT_OUTCOMES, type ExeatStatus, type RollSession, type RollStatus, type VisitOutcome,
} from '../resources/welfare';

// ── Boarding ─────────────────────────────────────────────────

export interface Dorm { id: string; name: string; house: string | null; gender: string; capacity: number; patron: PersonName | null }
export interface Allocation { id: string; bed_label: string | null; allocated_on: string; student: StudentEmbed | null }
export interface Exeat { id: string; exeat_type: string; leave_at: string; return_by: string; reason: string | null; status: ExeatStatus; pass_code: string | null; student: StudentEmbed | null; requester: PersonName | null }
export interface Inspection { id: string; inspected_on: string; score: number; remarks: string | null; dorm: { name: string } | null; inspector: PersonName | null }

export const EXEAT_TONES: Record<ExeatStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', OUT: 'violet', RETURNED: 'good' };
export const DORM_GENDER_LABELS: Record<(typeof DORM_GENDERS)[number], string> = { MALE: 'Boys', FEMALE: 'Girls', MIXED: 'Mixed' };

export const DORM_FIELDS: readonly FieldDef<FieldName<'dorms'>>[] = [
    { name: 'name', label: 'Dorm name', kind: 'text', required: true },
    { name: 'house', label: 'House', kind: 'text' },
    { name: 'gender', label: 'For', kind: 'enum', values: DORM_GENDERS, required: true, labels: DORM_GENDER_LABELS },
    { name: 'capacity', label: 'Beds', kind: 'number' },
    { name: 'patron_id', label: 'Patron / house master', kind: 'lookup', lookup: 'staff', span: 'full' },
];
export const DORM_DEFAULTS = { gender: 'MIXED' } as const;

export const ALLOCATION_FIELDS: readonly FieldDef<FieldName<'dorm-allocations'>>[] = [
    { name: 'dorm_id', label: 'Dorm', kind: 'hidden' },
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'bed_label', label: 'Bed / cubicle', kind: 'text' },
    { name: 'allocated_on', label: 'From', kind: 'date', required: true },
];
export const allocationDefaults = (dormId: string) => ({ dorm_id: dormId, allocated_on: today() });

export const EXEAT_FIELDS: readonly FieldDef<FieldName<'exeats'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'exeat_type', label: 'Type', kind: 'enum', values: EXEAT_TYPES, required: true },
    { name: 'leave_at', label: 'Leaving', kind: 'datetime', required: true },
    { name: 'return_by', label: 'Back by', kind: 'datetime', required: true },
    { name: 'reason', label: 'Reason', kind: 'textarea' },
];
export const EXEAT_DEFAULTS = { exeat_type: 'WEEKEND' } as const;

export type ExeatAction = 'APPROVE' | 'REJECT' | 'CHECK_OUT' | 'CHECK_IN';

/** The buttons an exeat offers this viewer: the patron decides, the gate records out and back. */
export function exeatActions(status: ExeatStatus, can: { manage: boolean; rollcall: boolean }): { action: ExeatAction; label: string }[] {
    const out: { action: ExeatAction; label: string }[] = [];
    if (can.manage && status === 'PENDING') out.push({ action: 'APPROVE', label: 'Approve' });
    if (can.manage && (status === 'PENDING' || status === 'APPROVED')) out.push({ action: 'REJECT', label: 'Reject' });
    if (can.rollcall && status === 'APPROVED') out.push({ action: 'CHECK_OUT', label: 'Out' });
    if (can.rollcall && status === 'OUT') out.push({ action: 'CHECK_IN', label: 'Back' });
    return out;
}

export const exeatActionMessage = (action: ExeatAction, r: { pass_code: string | null; notified?: boolean }) =>
    action === 'APPROVE' ? `Approved. Gate pass code: ${r.pass_code}` : action === 'REJECT' ? 'Rejected.' : `Recorded${r.notified ? '; guardian notified' : ''}.`;

export const inspectionFields = (dorms: readonly { id: string; name: string }[]): readonly FieldDef<FieldName<'dorm-inspections'>>[] => [
    { name: 'dorm_id', label: 'Dorm', kind: 'options', options: dorms.map(d => ({ id: d.id, label: d.name })), required: true },
    { name: 'inspected_on', label: 'Date', kind: 'date', required: true },
    { name: 'score', label: 'Score (0–100)', kind: 'number', required: true },
    { name: 'remarks', label: 'Remarks', kind: 'textarea' },
];

/** One learner's line on a dorm roll. */
export interface RollEntry { studentId: string; name: string; admissionNumber: string | null; bed: string | null; status: RollStatus | null; suggested: RollStatus | null }
export interface Roll { taken: boolean; notes: string | null; entries: RollEntry[] }

/** The one-letter buttons on a roll. */
export const ROLL_SHORT: Record<RollStatus, string> = { PRESENT: 'P', ABSENT: 'A', LATE: 'L', EXEAT: 'E', SICK_BAY: 'S' };
export const ROLL_TONES: Record<RollStatus, PillTone> = { PRESENT: 'good', ABSENT: 'bad', LATE: 'warn', EXEAT: 'info', SICK_BAY: 'violet' };

/** Morning before noon, evening until 8pm, then night. */
export const currentRollSession = (hour = new Date().getHours()): RollSession => (hour < 12 ? 'MORNING' : hour < 20 ? 'EVENING' : 'NIGHT');

export const rollSavedMessage = (absent: number) => (absent > 0 ? `Roll saved. ${absent} absent — follow up now.` : 'Roll saved. Everyone accounted for.');

// ── Health ───────────────────────────────────────────────────

export interface Visit {
    id: string; visited_at: string; complaint: string; temperature_c: number | null; diagnosis: string | null; treatment: string | null;
    outcome: VisitOutcome; referred_to: string | null; parent_notified: boolean; discharged_at: string | null;
    student: StudentEmbed | null; attendant: PersonName | null;
}
export interface StatusVisit { id: string; visited_at: string; outcome: VisitOutcome; student: StudentEmbed | null }
export interface HealthStatus { sickBay: StatusVisit[]; wentHome: StatusVisit[]; trends: { complaint: string; visits: number; alert: boolean }[] }
export interface MedicalProfile { id: string; blood_group: string | null; allergies: string | null; conditions: string | null; regular_medication: string | null; emergency_phone: string | null; consent_on_file: boolean; student: StudentEmbed | null }
export interface Stock { id: string; name: string; unit: string; quantity: number; reorder_level: number; batch: string | null; expiry_date: string | null }
export interface Dose { id: string; medicine: string; dose: string | null; quantity: number; given_at: string; student: StudentEmbed | null; giver: PersonName | null }

export const OUTCOME_TONES: Record<VisitOutcome, PillTone> = { RETURNED_TO_CLASS: 'good', SICK_BAY: 'violet', SENT_HOME: 'warn', REFERRED: 'bad' };

export const VISIT_FIELDS: readonly FieldDef<FieldName<'clinic-visits'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'visited_at', label: 'Time', kind: 'datetime', required: true },
    { name: 'temperature_c', label: 'Temperature (°C)', kind: 'number', step: '0.1' },
    { name: 'complaint', label: 'Complaint', kind: 'text', required: true, span: 'full' },
    { name: 'diagnosis', label: 'Assessment', kind: 'textarea' },
    { name: 'treatment', label: 'Treatment given', kind: 'textarea' },
    { name: 'outcome', label: 'Outcome', kind: 'enum', values: VISIT_OUTCOMES, required: true },
    { name: 'referred_to', label: 'Referred to', kind: 'text', hint: 'Hospital or clinic, if referred.' },
];
export const visitDefaults = () => ({ visited_at: nowLocalInput(), outcome: 'RETURNED_TO_CLASS' });

export const PROFILE_FIELDS: readonly FieldDef<FieldName<'medical-profiles'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'blood_group', label: 'Blood group', kind: 'enum', values: BLOOD_GROUPS, labels: Object.fromEntries(BLOOD_GROUPS.map(b => [b, b])) },
    { name: 'sha_number', label: 'SHA number', kind: 'text' },
    { name: 'allergies', label: 'Allergies', kind: 'textarea' },
    { name: 'conditions', label: 'Chronic conditions', kind: 'textarea', hint: 'Asthma, diabetes, sickle cell, epilepsy…' },
    { name: 'regular_medication', label: 'Regular medication', kind: 'textarea' },
    { name: 'doctor_name', label: 'Family doctor', kind: 'text' },
    { name: 'doctor_phone', label: 'Doctor phone', kind: 'tel' },
    { name: 'emergency_contact', label: 'Emergency contact', kind: 'text' },
    { name: 'emergency_phone', label: 'Emergency phone', kind: 'tel' },
    { name: 'consent_on_file', label: 'Treatment consent form on file', kind: 'checkbox' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];

export const STOCK_FIELDS: readonly FieldDef<FieldName<'medicine-stock'>>[] = [
    { name: 'name', label: 'Medicine', kind: 'text', required: true, span: 'full' },
    { name: 'unit', label: 'Unit', kind: 'text', required: true, placeholder: 'tablet, bottle, sachet' },
    { name: 'quantity', label: 'In stock', kind: 'number', required: true },
    { name: 'reorder_level', label: 'Reorder at', kind: 'number' },
    { name: 'batch', label: 'Batch', kind: 'text' },
    { name: 'expiry_date', label: 'Expiry', kind: 'date' },
];
export const STOCK_DEFAULTS = { unit: 'tablet', reorder_level: '0' } as const;

export const stockLow = (s: Stock) => s.quantity <= s.reorder_level;
/** Expires within 60 days (or already has). */
export const stockExpiring = (s: Stock) => { const d = daysUntil(s.expiry_date); return d !== null && d <= 60; };

export const doseFields = (stock: readonly Stock[]): readonly FieldDef<FieldName<'medication-logs'>>[] => [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'stock_id', label: 'From stock', kind: 'options', options: stock.map(s => ({ id: s.id, label: s.name, hint: `${s.quantity} ${s.unit} left` })), hint: 'Takes the quantity off the shelf.' },
    { name: 'medicine', label: 'Medicine', kind: 'text', required: true },
    { name: 'dose', label: 'Dose', kind: 'text', placeholder: 'e.g. 500mg' },
    { name: 'quantity', label: 'Quantity', kind: 'number' },
    { name: 'given_at', label: 'Given at', kind: 'datetime', required: true },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];
export const doseDefaults = () => ({ quantity: '1', given_at: nowLocalInput() });

/** "Discharged" once a sick-bay stay has ended. */
export const visitOutcomeLabel = (v: Visit) => (v.outcome === 'SICK_BAY' && v.discharged_at ? 'Discharged' : undefined);
export const canDischarge = (v: Visit) => v.outcome === 'SICK_BAY' && !v.discharged_at;
export const shouldTellParent = (v: Visit) => !v.parent_notified && v.outcome !== 'RETURNED_TO_CLASS';

export const outbreakMessage = (status: HealthStatus) => {
    const alerts = status.trends.filter(t => t.alert);
    return alerts.length === 0 ? null : `Possible outbreak: ${alerts.map(t => `“${t.complaint}” (${t.visits} visits in 48h)`).join(', ')}. Inform the principal.`;
};

// ── Discipline ───────────────────────────────────────────────

export interface Incident {
    id: string; occurred_on: string; category: string; severity: (typeof INCIDENT_SEVERITIES)[number]; description: string;
    action_taken: string; status: (typeof INCIDENT_STATUSES)[number]; parent_notified: boolean; reported_by: string | null;
    student: StudentEmbed | null; reporter: PersonName | null;
}

export const SEVERITY_TONES: Record<Incident['severity'], PillTone> = { MINOR: 'neutral', MAJOR: 'warn', CRITICAL: 'bad' };
export const INCIDENT_STATUS_TONES: Record<Incident['status'], PillTone> = { OPEN: 'warn', RESOLVED: 'good' };

export const INCIDENT_REPORT_FIELDS: readonly FieldDef<FieldName<'discipline'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'occurred_on', label: 'Date', kind: 'date', required: true },
    { name: 'category', label: 'Category', kind: 'enum', values: INCIDENT_CATEGORIES, required: true },
    { name: 'severity', label: 'Severity', kind: 'enum', values: INCIDENT_SEVERITIES, required: true },
    { name: 'description', label: 'What happened', kind: 'textarea', required: true },
];
/** The discipline master also records the action and closes the case. */
export const INCIDENT_MANAGE_FIELDS: readonly FieldDef<FieldName<'discipline'>>[] = [
    ...INCIDENT_REPORT_FIELDS,
    { name: 'action_taken', label: 'Action taken', kind: 'enum', values: INCIDENT_ACTIONS, required: true },
    { name: 'status', label: 'Status', kind: 'enum', values: INCIDENT_STATUSES, required: true },
];
export const incidentDefaults = () => ({ occurred_on: today(), severity: 'MINOR', action_taken: 'NONE', status: 'OPEN' });
