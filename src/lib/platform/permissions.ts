/**
 * Permissions and duties.
 *
 * A user's login role (`users.role`) says what kind of account it is. Duties
 * (`user_duties`) are the jobs a person holds in the school: a chemistry
 * teacher can also be the DOS and a house patron. Each duty grants
 * permissions, and code checks permissions, never role names.
 *
 * Every permission belongs to a domain, and every domain to a module, so a
 * permission is only ever granted while its module is on: `can()` needs no
 * separate module check.
 *
 * Client-safe: shared by API routes, the sidebar and pages.
 */
import type { UserRole } from '@/types';
import type { ModuleKey } from './modules';

export const PERMISSIONS = [
    // Administration (always available)
    'school.manage', 'modules.manage', 'duties.manage', 'audit.view',
    // Academics
    'calendar.view', 'calendar.manage',
    'exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage',
    'timetable.view', 'timetable.manage',
    'lesson_records.write', 'lesson_records.review',
    'cbc.assess', 'cbc.view',
    // Finance
    'fees.view', 'fees.collect', 'fees.manage',
    'billing.view', 'billing.manage',
    'expenses.request', 'expenses.approve', 'expenses.view',
    // Welfare
    'boarding.view', 'boarding.rollcall', 'boarding.manage',
    'health.view', 'health.clinical', 'health.manage',
    'discipline.record', 'discipline.manage',
    // Operations
    'transport.view', 'transport.drive', 'transport.manage',
    'library.view', 'library.manage',
    'inventory.request', 'inventory.manage',
    // People
    'hr.request', 'hr.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionDomain = Permission extends `${infer D}.${string}` ? D : never;
/** A permission, every permission in a domain (`fees.*`), or everything (`*`). */
export type PermissionPattern = Permission | `${PermissionDomain}.*` | '*';

/** The module a domain belongs to; null for domains that are always available. */
export const DOMAIN_MODULE = {
    school: null,
    modules: null,
    duties: null,
    audit: null,
    calendar: 'calendar',
    exam_papers: 'exam_papers',
    timetable: 'timetable',
    lesson_records: 'lesson_records',
    cbc: 'cbc_assessment',
    fees: 'fees',
    billing: 'fee_structures',
    expenses: 'expenses',
    boarding: 'boarding',
    health: 'health',
    discipline: 'discipline',
    transport: 'transport',
    library: 'library',
    inventory: 'inventory',
    hr: 'staff_hr',
} as const satisfies Record<PermissionDomain, ModuleKey | null>;

export function permissionDomain(p: Permission): PermissionDomain {
    return p.slice(0, p.indexOf('.')) as PermissionDomain;
}

export function isPermission(value: unknown): value is Permission {
    return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

// ── Duties ───────────────────────────────────────────────────

export const SCOPE_TYPES = ['DEPARTMENT', 'STREAM', 'DORM', 'VEHICLE', 'ROUTE'] as const;
/** Scope kinds the duty picker offers today (departments are not modelled yet). */
export const SCOPE_LABELS: Partial<Record<(typeof SCOPE_TYPES)[number], string>> = {
    STREAM: 'Class',
    DORM: 'Dorm',
    VEHICLE: 'Vehicle',
    ROUTE: 'Route',
};
export type ScopeType = (typeof SCOPE_TYPES)[number];

export interface DutyDefinition {
    label: string;
    description: string;
    grants: readonly PermissionPattern[];
    /** The kind of thing this duty can be limited to, if any. */
    scope?: ScopeType;
    /** The module this duty exists for; hidden from the picker while it is off. */
    module?: ModuleKey;
}

export const DUTIES = {
    PRINCIPAL: { label: 'Principal / Head teacher', description: 'Every module page and approval. School setup (classes, users, settings) stays with Admin accounts.', grants: ['*'] },
    DEPUTY_PRINCIPAL: {
        label: 'Deputy Principal',
        description: 'Runs academics, discipline and welfare day to day.',
        grants: ['calendar.*', 'exam_papers.*', 'timetable.*', 'lesson_records.*', 'cbc.*', 'discipline.*', 'boarding.view', 'health.view', 'hr.manage', 'expenses.approve', 'expenses.view'],
    },
    DOS: {
        label: 'Director of Studies',
        description: 'Exams, papers, timetable, professional records and academic calendar.',
        grants: ['calendar.*', 'exam_papers.*', 'timetable.*', 'lesson_records.*', 'cbc.*'],
    },
    HOD: {
        label: 'Head of Department',
        description: 'Moderates papers and reviews professional records for a department.',
        grants: ['exam_papers.moderate', 'exam_papers.upload', 'lesson_records.*', 'cbc.view', 'calendar.view', 'timetable.view'],
    },
    TIMETABLER: { label: 'Timetabler', description: 'Builds and publishes the timetable.', grants: ['timetable.*'], module: 'timetable' },
    EXAMS_OFFICER: { label: 'Exams Officer', description: 'Runs the paper bank and printing.', grants: ['exam_papers.*', 'calendar.view'], module: 'exam_papers' },
    BURSAR: {
        label: 'Bursar',
        description: 'Fees, billing, expenses and financial reports.',
        grants: ['fees.*', 'billing.*', 'expenses.*'],
        module: 'fees',
    },
    ACCOUNTANT: {
        label: 'Accountant',
        description: 'Records payments and expenses; approvals stay with the bursar or principal.',
        grants: ['fees.view', 'fees.collect', 'billing.view', 'expenses.request', 'expenses.view'],
        module: 'fees',
    },
    MATRON: { label: 'Matron', description: 'Runs boarding: dorms, roll calls, exeats and inspections.', grants: ['boarding.*', 'health.view'], module: 'boarding' },
    PATRON: { label: 'Patron / House master', description: 'Takes roll calls and records incidents for a house.', grants: ['boarding.view', 'boarding.rollcall', 'discipline.record'], scope: 'DORM', module: 'boarding' },
    NURSE: { label: 'School Nurse', description: 'Medical profiles, clinic visits, sick bay and medicine stock.', grants: ['health.*'], module: 'health' },
    DISCIPLINE_MASTER: { label: 'Discipline Master', description: 'Manages incidents and actions.', grants: ['discipline.*'], module: 'discipline' },
    TRANSPORT_MANAGER: { label: 'Transport Manager', description: 'Fleet, drivers, routes, trips and compliance.', grants: ['transport.*'], module: 'transport' },
    DRIVER: { label: 'Driver', description: 'Runs the trips they are assigned (link them under Transport → Crew) and shares the bus location.', grants: ['transport.drive'], module: 'transport' },
    LIBRARIAN: { label: 'Librarian', description: 'Catalogue, issues and returns.', grants: ['library.*'], module: 'library' },
    STOREKEEPER: { label: 'Storekeeper', description: 'Stores, stock levels and requisitions.', grants: ['inventory.*'], module: 'inventory' },
    HR_OFFICER: { label: 'HR / Secretary', description: 'Approves staff leave.', grants: ['hr.*'], module: 'staff_hr' },
} as const satisfies Record<string, DutyDefinition>;

export type DutyKey = keyof typeof DUTIES;
export const DUTY_KEYS = Object.keys(DUTIES) as DutyKey[];

export function isDutyKey(value: unknown): value is DutyKey {
    return typeof value === 'string' && value in DUTIES;
}

/**
 * What each login role can do before any duty is assigned. ADMIN keeps full
 * access, and teachers keep what they could already do, so introducing
 * duties takes nothing away from anyone.
 */
export const ROLE_GRANTS: Record<UserRole, readonly PermissionPattern[]> = {
    ADMIN: ['*'],
    CLASS_TEACHER: ['calendar.view', 'timetable.view', 'exam_papers.upload', 'lesson_records.write', 'cbc.assess', 'cbc.view', 'discipline.record', 'health.view', 'boarding.view', 'library.view', 'inventory.request', 'hr.request', 'expenses.request'],
    SUBJECT_TEACHER: ['calendar.view', 'timetable.view', 'exam_papers.upload', 'lesson_records.write', 'cbc.assess', 'cbc.view', 'discipline.record', 'library.view', 'inventory.request', 'hr.request', 'expenses.request'],
    STAFF: ['calendar.view', 'library.view', 'inventory.request', 'hr.request'],
    STUDENT: ['calendar.view', 'timetable.view', 'library.view'],
    PENDING: [],
};

// ── Evaluation ───────────────────────────────────────────────

export function patternMatches(pattern: PermissionPattern, permission: Permission): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) return permissionDomain(permission) === pattern.slice(0, -2);
    return pattern === permission;
}

/** Everything a role plus its duties grant, as patterns (sent to the client as-is). */
export function collectGrants(role: UserRole | null, duties: readonly DutyKey[]): PermissionPattern[] {
    const patterns = new Set<PermissionPattern>(role ? ROLE_GRANTS[role] : []);
    for (const d of duties) DUTIES[d].grants.forEach(g => patterns.add(g));
    return [...patterns];
}

/**
 * Whether the grants allow `permission` with the school's current modules.
 * The single evaluation used on both server and client.
 */
export function grantAllows(
    grants: readonly PermissionPattern[],
    modules: ReadonlySet<ModuleKey>,
    permission: Permission,
): boolean {
    const owner = DOMAIN_MODULE[permissionDomain(permission)];
    if (owner && !modules.has(owner)) return false;
    return grants.some(g => patternMatches(g, permission));
}

/** A duty's definition widened to the common shape (optional scope and module readable). */
export const dutyDefinition = (key: DutyKey): DutyDefinition => DUTIES[key];
