/**
 * Parent accounts, the parent portal, modules and duties: the shapes,
 * colours and wording the web pages and the mobile screens share.
 */
import type { PersonName } from '../resource';
import type { PillTone } from '../tones';
import { MODULES, type ModuleKey, type ModulePresetId } from '../../platform/modules';
import type { DutyKey, ScopeType } from '../../platform/permissions';

// ── Parent accounts (admin) ──────────────────────────────────

export const GUARDIAN_RELATIONSHIPS = ['MOTHER', 'FATHER', 'GUARDIAN', 'SPONSOR', 'OTHER'] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export interface GuardianLink { id: string; relationship: string; is_primary: boolean; parent: { id: string; first_name: string; last_name: string; phone: string | null; is_active: boolean } | null }
export const EMPTY_PARENT_FORM: { first_name: string; last_name: string; phone: string; relationship: GuardianRelationship } = { first_name: '', last_name: '', phone: '', relationship: 'GUARDIAN' };
export type ParentForm = typeof EMPTY_PARENT_FORM;
export interface ParentLinkResult { invite_code: string | null; reused: boolean }

export const parentLinkedMessage = (r: ParentLinkResult) => (r.reused ? 'Linked to the parent’s existing account.' : 'Parent account created; invite code sent by SMS.');
export const guardianName = (l: GuardianLink) => (l.parent ? `${l.parent.first_name} ${l.parent.last_name}` : '—');
export const guardianStatus = (l: GuardianLink) => (l.parent?.is_active ? 'Active' : 'Invite sent');

// ── Parent portal ────────────────────────────────────────────

export interface ChildLink { relationship: string; student: { id: string; admission_number: string | null; stream: { full_name: string } | null; user: PersonName | null } | null }
export interface ChildResult { id: string; percentage: number | null; grade_symbol: string | null; exams: { name: string; exam_date: string; subjects: { name: string } | null } | null }
export interface ChildOverview {
    child: { id: string; name: string; admissionNumber: string };
    summary: {
        stats: { averageScore: number; averageTerm?: string | null; attendanceRate: number; examsTaken: number; attendanceRecords: number };
        latestResults: ChildResult[];
        announcements: { id: string; title: string; content: string; createdAt: string; isImportant: boolean }[];
        currentTerm?: { name: string };
    } | null;
    reports: {
        id: string;
        overall_average: number | null;
        overall_position: number | null;
        comments_class_teacher: string | null;
        comments_principal: string | null;
        terms: { id: string; name: string } | null;
        academic_years: { id: string; name: string } | null;
    }[];
    attendance: { id: string; date: string; status: string }[];
    /** The latest terms' fees, for the list. */
    fees: { id: string; total_fee: number; paid_amount: number; status: string; due_date: string | null; term: { name: string } | null }[];
    /** Owed across every term (older servers sent only `fees`). */
    feeOwed?: number;
    events: { id: string; title: string; event_type: string; starts_on: string; ends_on: string | null }[];
    ride: { route: { name: string } | null; stop: { name: string; pickup_time: string | null; dropoff_time: string | null } | null } | null;
    bus: { status: string; last_seen_at: string | null; vehicle: { registration: string } | null; boarded: string | null } | null;
}

export const FEE_STATUS_TONES: Record<string, PillTone> = { PENDING: 'warn', PARTIAL: 'info', PAID: 'good', OVERPAID: 'violet' };
export const ATTENDANCE_TONES: Record<string, PillTone> = { present: 'good', absent: 'bad', late: 'warn', excused: 'info' };

/** What the parent owes for the child: every term, owed only (an overpaid term doesn't hide arrears). */
export const feeBalance = (o: ChildOverview) =>
    o.feeOwed ?? o.fees.reduce((n, f) => n + Math.max(0, Number(f.total_fee) - Number(f.paid_amount)), 0);
/** "Term 2 2026" for a report card. */
export const reportTermLabel = (r: ChildOverview['reports'][number]) =>
    [r.terms?.name, r.academic_years?.name].filter(Boolean).join(' ') || 'Report card';
export const absences = (o: ChildOverview) => o.attendance.filter(a => a.status === 'absent').length;
export const rideLine = (ride: NonNullable<ChildOverview['ride']>) =>
    `${ride.route?.name ?? ''} · ${ride.stop?.name ?? 'stop not set'}${ride.stop?.pickup_time ? ` · pick-up ${ride.stop.pickup_time.slice(0, 5)}` : ''}${ride.stop?.dropoff_time ? ` · drop-off ${ride.stop.dropoff_time.slice(0, 5)}` : ''}`;

// ── Modules ──────────────────────────────────────────────────

export interface ModuleState { key: ModuleKey; enabled: boolean; entitled: boolean }
export type ModuleChange = { module: ModuleKey; enabled: boolean } | { preset: ModulePresetId };

export const PRESET_WARNING = 'Modules in the preset are switched on and the rest off. Data in switched-off modules is kept and comes back when you switch them on again.';
export const moduleChangeMessage = (enabled: boolean, also: readonly ModuleKey[]) =>
    `${enabled ? 'It needs' : 'These depend on it and will also be switched off'}: ${also.map(k => MODULES[k].name).join(', ')}.`;

// ── Duties ───────────────────────────────────────────────────

export interface DutyRow {
    id: string;
    user_id: string;
    duty: DutyKey;
    scope_type: ScopeType | null;
    scope_id: string | null;
    starts_on: string | null;
    ends_on: string | null;
    user: PersonName & { role: string } | null;
}
export const EMPTY_DUTY_FORM = { user_id: '', duty: '' as DutyKey | '', scope_id: '', starts_on: '', ends_on: '' };
export type DutyForm = typeof EMPTY_DUTY_FORM;

/** A duty form as the duties resource takes it: a scope only when the duty has one and it was chosen. */
export const dutyPayload = (form: DutyForm, scope: ScopeType | undefined) => ({
    user_id: form.user_id,
    duty: form.duty,
    scope_type: scope && form.scope_id ? scope : null,
    scope_id: scope && form.scope_id ? form.scope_id : null,
    starts_on: form.starts_on,
    ends_on: form.ends_on,
});
