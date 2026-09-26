/**
 * The runtime module registry: every feature a school can switch on or off.
 *
 * Client-safe (no server imports) so the sidebar, the Modules settings tab
 * and API routes all read the same list. A module a school has not enabled
 * disappears from menus, its API answers 404, and its data is kept.
 *
 * Storage: `school_modules` holds one row per school per module the school
 * has touched. No row means the module's `defaultEnabled`, which is true for
 * every module that existed before the registry, so no live school loses a
 * feature when this ships.
 */

export const MODULE_KEYS = [
    // Academics
    'exams', 'report_cards', 'attendance', 'analytics', 'assignments',
    'calendar', 'exam_papers', 'timetable', 'lesson_records', 'cbc_assessment',
    // Finance
    'fees', 'fee_structures', 'expenses',
    // Welfare
    'boarding', 'health', 'discipline',
    // Operations
    'transport', 'transport_tracking', 'library', 'inventory',
    // People
    'parent_portal', 'staff_hr',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_CATEGORIES = ['academics', 'finance', 'welfare', 'operations', 'people'] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export const MODULE_CATEGORY_LABELS: Record<ModuleCategory, string> = {
    academics: 'Academics',
    finance: 'Finance',
    welfare: 'Welfare',
    operations: 'Operations',
    people: 'People',
};

export interface ModuleDefinition {
    key: ModuleKey;
    name: string;
    category: ModuleCategory;
    /** One line on what the school gets. */
    description: string;
    /** Modules that must be on first; enabling this one turns them on too. */
    requires: readonly ModuleKey[];
    /** On for a school that has never changed it. */
    defaultEnabled: boolean;
}

const def = <K extends ModuleKey>(
    key: K,
    category: ModuleCategory,
    name: string,
    description: string,
    opts: { requires?: readonly ModuleKey[]; defaultEnabled?: boolean } = {},
): ModuleDefinition & { key: K } => ({
    key,
    category,
    name,
    description,
    requires: opts.requires ?? [],
    defaultEnabled: opts.defaultEnabled ?? false,
});

/** Modules that shipped before the registry stay on unless a school turns them off. */
const EXISTING = { defaultEnabled: true } as const;

export const MODULES = {
    exams: def('exams', 'academics', 'Exams & Marks', 'Create exams, enter or scan marks, publish results.', EXISTING),
    report_cards: def('report_cards', 'academics', 'Report Cards', 'Branded report cards with comments, rankings and PDF export.', { ...EXISTING, requires: ['exams'] }),
    attendance: def('attendance', 'academics', 'Attendance', 'Daily registers with SMS to parents.', EXISTING),
    analytics: def('analytics', 'academics', 'Analytics', 'School, class and subject performance trends.', { ...EXISTING, requires: ['exams'] }),
    assignments: def('assignments', 'academics', 'Assignments', 'Homework and submissions per class.', EXISTING),
    calendar: def('calendar', 'academics', 'School Calendar', 'Exam windows, deadlines, events and report-release dates for everyone.', EXISTING),
    exam_papers: def('exam_papers', 'academics', 'Exam Paper Bank', 'Secure paper upload, HOD moderation, printing queue and timed release.', { requires: ['exams'] }),
    timetable: def('timetable', 'academics', 'Timetable', 'Generate clash-free timetables, publish them and manage lesson cover.'),
    lesson_records: def('lesson_records', 'academics', 'Professional Records', 'Schemes of work, lesson plans, records of work and syllabus coverage.'),
    cbc_assessment: def('cbc_assessment', 'academics', 'CBC Assessment', 'Rubric-based formative assessment per strand and sub-strand.'),

    fees: def('fees', 'finance', 'Fees & Payments', 'Balances, M-Pesa and bank payments, receipts and exports.', EXISTING),
    fee_structures: def('fee_structures', 'finance', 'Fee Structures & Billing', 'Vote heads, fee structures, bulk invoicing and bursaries.', { requires: ['fees'] }),
    expenses: def('expenses', 'finance', 'Expenses', 'Suppliers, payment vouchers with approval, and spending by vote head.'),

    boarding: def('boarding', 'welfare', 'Boarding', 'Dorms and beds, roll calls, exeats and dorm inspections.'),
    health: def('health', 'welfare', 'Health & Sick Bay', 'Medical profiles, clinic visits, sick bay, medication and stock.'),
    discipline: def('discipline', 'welfare', 'Discipline', 'Incidents, actions taken and parent notification.'),

    transport: def('transport', 'operations', 'Transport', 'Vehicles, drivers, compliance expiries, routes, stops and trips.'),
    transport_tracking: def('transport_tracking', 'operations', 'Live Bus Tracking', 'Drivers share GPS during trips; admins see every bus on a live map.', { requires: ['transport'] }),
    library: def('library', 'operations', 'Library', 'Catalogue, issue and return, overdue tracking.'),
    inventory: def('inventory', 'operations', 'Inventory & Stores', 'Asset register, stock levels and store requisitions.'),

    parent_portal: def('parent_portal', 'people', 'Parent Portal', 'Parents sign in to see results, fees, attendance and notices for each child.'),
    staff_hr: def('staff_hr', 'people', 'Staff Leave', 'Leave requests and approvals for teaching and support staff.'),
} as const satisfies Record<ModuleKey, ModuleDefinition>;

export const MODULE_LIST: readonly ModuleDefinition[] = MODULE_KEYS.map(k => MODULES[k]);

export function isModuleKey(value: unknown): value is ModuleKey {
    return typeof value === 'string' && (MODULE_KEYS as readonly string[]).includes(value);
}

/** Every module `key` needs, transitively, including itself. */
export function withDependencies(key: ModuleKey): ModuleKey[] {
    const seen = new Set<ModuleKey>();
    const visit = (k: ModuleKey) => {
        if (seen.has(k)) return;
        seen.add(k);
        MODULES[k].requires.forEach(visit);
    };
    visit(key);
    return [...seen];
}

/** Modules that depend on `key` (directly or not); switching `key` off switches these off too. */
export function dependents(key: ModuleKey): ModuleKey[] {
    return MODULE_KEYS.filter(k => k !== key && withDependencies(k).includes(key));
}

export interface SchoolModuleRow {
    module_key: string;
    enabled: boolean;
    entitled: boolean;
}

/**
 * The modules on for a school: its stored choices over the defaults. A module
 * whose plan does not include it (`entitled = false`) is off whatever the
 * school chose, and so is anything that depends on a module that is off.
 */
export function resolveEnabledModules(rows: readonly SchoolModuleRow[]): Set<ModuleKey> {
    const stored = new Map(rows.filter(r => isModuleKey(r.module_key)).map(r => [r.module_key as ModuleKey, r]));
    const chosen = MODULE_KEYS.filter(k => {
        const row = stored.get(k);
        if (!row) return MODULES[k].defaultEnabled;
        return row.entitled && row.enabled;
    });
    const on = new Set<ModuleKey>(chosen);
    return new Set(chosen.filter(k => withDependencies(k).every(d => on.has(d))));
}

/** Starting points offered to a school choosing what it runs. */
export const MODULE_PRESETS = [
    {
        id: 'day_primary',
        name: 'Day primary / junior school',
        modules: ['exams', 'report_cards', 'attendance', 'analytics', 'assignments', 'calendar', 'fees', 'cbc_assessment', 'timetable', 'parent_portal'],
    },
    {
        id: 'day_secondary',
        name: 'Day secondary',
        modules: ['exams', 'report_cards', 'attendance', 'analytics', 'assignments', 'calendar', 'fees', 'fee_structures', 'exam_papers', 'timetable', 'lesson_records', 'discipline', 'library', 'parent_portal'],
    },
    {
        id: 'boarding_secondary',
        name: 'Boarding secondary',
        modules: ['exams', 'report_cards', 'attendance', 'analytics', 'assignments', 'calendar', 'fees', 'fee_structures', 'expenses', 'exam_papers', 'timetable', 'lesson_records', 'boarding', 'health', 'discipline', 'library', 'inventory', 'staff_hr', 'parent_portal'],
    },
    {
        id: 'academy_transport',
        name: 'Private academy with transport',
        modules: ['exams', 'report_cards', 'attendance', 'analytics', 'assignments', 'calendar', 'fees', 'fee_structures', 'expenses', 'timetable', 'cbc_assessment', 'lesson_records', 'health', 'transport', 'transport_tracking', 'library', 'parent_portal', 'staff_hr'],
    },
] as const satisfies readonly { id: string; name: string; modules: readonly ModuleKey[] }[];

export type ModulePresetId = (typeof MODULE_PRESETS)[number]['id'];
