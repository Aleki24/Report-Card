/**
 * Billing and expenses: the row shapes, status colours, form fields and
 * workflow steps the web pages and the mobile screens share.
 */
import type { FieldDef, FieldName } from '../form';
import type { PersonName, StudentEmbed } from '../resource';
import type { PillTone } from '../tones';
import { today } from '../format';
import { AWARD_KINDS, EXPENSE_METHODS, STRUCTURE_RESIDENCES, type ExpenseStatus } from '../resources/finance';

export interface Named { id: string; name: string }

// ── Expenses ─────────────────────────────────────────────────

export interface Expense {
    id: string; description: string; amount: number; expense_date: string; status: ExpenseStatus;
    payment_method: string | null; reference: string | null; decision_note: string | null; requested_by: string | null;
    supplier: { name: string } | null; vote_head: { name: string } | null;
    requester: PersonName | null; decider: PersonName | null;
}
export interface Supplier extends Named { phone: string | null; kra_pin: string | null; category: string | null }

export const EXPENSE_TONES: Record<ExpenseStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', PAID: 'good' };

export const expenseFields = (suppliers: readonly Named[], voteHeads: readonly Named[]): readonly FieldDef<FieldName<'expenses'>>[] => [
    { name: 'description', label: 'What for', kind: 'text', required: true, span: 'full' },
    { name: 'amount', label: 'Amount (KES)', kind: 'number', required: true },
    { name: 'expense_date', label: 'Date', kind: 'date', required: true },
    { name: 'supplier_id', label: 'Supplier', kind: 'options', options: suppliers.map(s => ({ id: s.id, label: s.name })) },
    { name: 'vote_head_id', label: 'Vote head', kind: 'options', options: voteHeads.map(v => ({ id: v.id, label: v.name })) },
    { name: 'payment_method', label: 'Payment method', kind: 'enum', values: EXPENSE_METHODS },
    { name: 'reference', label: 'Invoice / reference', kind: 'text' },
];
export const expenseDefaults = () => ({ expense_date: today() });

export const SUPPLIER_FIELDS: readonly FieldDef<FieldName<'suppliers'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, span: 'full' },
    { name: 'phone', label: 'Phone', kind: 'tel' },
    { name: 'email', label: 'Email', kind: 'email' },
    { name: 'kra_pin', label: 'KRA PIN', kind: 'text' },
    { name: 'category', label: 'Category', kind: 'text', hint: 'Food, stationery, fuel…' },
];

export type ExpenseDecision = 'APPROVE' | 'REJECT' | 'PAID';

export const EXPENSE_DECISION_TITLES: Record<ExpenseDecision, string> = { APPROVE: 'Approve expense', REJECT: 'Reject expense', PAID: 'Mark as paid' };
export const EXPENSE_DECISION_DONE: Record<ExpenseDecision, string> = { APPROVE: 'Approved.', REJECT: 'Rejected.', PAID: 'Marked paid.' };

/** An approver's next steps; nobody approves their own request. */
export function expenseDecisions(e: Expense, viewerId: string | undefined): ExpenseDecision[] {
    if (e.status === 'PENDING') return e.requested_by !== viewerId ? ['APPROVE', 'REJECT'] : ['REJECT'];
    if (e.status === 'APPROVED') return ['PAID'];
    return [];
}

/** Amounts by status, for the figures above the list. */
export const expenseTotal = (rows: readonly Expense[], statuses: readonly ExpenseStatus[]) =>
    rows.filter(r => statuses.includes(r.status)).reduce((n, r) => n + Number(r.amount), 0);

// ── Billing ──────────────────────────────────────────────────

export interface VoteHead { id: string; name: string; code: string | null; priority: number; is_active: boolean }
export interface StructureItem { id: string; vote_head_id: string; annual_amount: number; vote_head: { name: string } | null }
export interface Structure {
    id: string; name: string; residence: string; term_split: number[]; notes: string | null;
    year: { name: string } | null; grade: { name_display: string } | null;
    items: StructureItem[];
}
export interface Award { id: string; kind: string; sponsor: string | null; amount: number; reference: string | null; term: { name: string } | null; student: StudentEmbed | null }
export interface InvoiceSummary { learners: number; unbilled: number; billed: number; awards: number; dry_run: boolean }
export interface Invoice { id: string; total: number; structure: { name: string } | null; student: StudentEmbed | null; lines: { id: string; description: string; amount: number }[] }
export interface VoteHeadLine { voteHeadId: string | null; name: string; billed: number; collected: number; outstanding: number; spent: number }
export interface VoteHeadStatement { lines: VoteHeadLine[]; overpaid: number }
export type Residence = 'DAY' | 'BOARDER';
export interface ResidenceLearner { id: string; admission_number: string | null; residence: Residence; user: PersonName | null }

export const VOTE_HEAD_FIELDS: readonly FieldDef<FieldName<'vote-heads'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, hint: 'e.g. Tuition, Boarding equipment & stores, Activity' },
    { name: 'code', label: 'Code', kind: 'text' },
    { name: 'priority', label: 'Allocation order', kind: 'number', hint: 'Payments fill lower numbers first.' },
    { name: 'is_active', label: 'In use', kind: 'checkbox' },
];
export const VOTE_HEAD_DEFAULTS = { priority: '100', is_active: true } as const;

export const STRUCTURE_RESIDENCE_LABELS: Record<(typeof STRUCTURE_RESIDENCES)[number], string> = { ALL: 'Day scholars and boarders', DAY: 'Day scholars', BOARDER: 'Boarders' };

export const STRUCTURE_FIELDS: readonly FieldDef<FieldName<'fee-structures'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, span: 'full', hint: 'e.g. Grade 10 boarders 2026' },
    { name: 'academic_year_id', label: 'Academic year', kind: 'lookup', lookup: 'years', required: true },
    { name: 'grade_id', label: 'Class level', kind: 'lookup', lookup: 'grades', hint: 'Leave empty for every class.' },
    { name: 'residence', label: 'Applies to', kind: 'enum', values: STRUCTURE_RESIDENCES, required: true, labels: STRUCTURE_RESIDENCE_LABELS },
    { name: 'term_split', label: 'Share per term (%)', kind: 'numberList', placeholder: '50, 30, 20', hint: 'Ministry guideline: 50, 30, 20.' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];
export const STRUCTURE_DEFAULTS = { residence: 'ALL', term_split: '50, 30, 20' } as const;

export const structureItemFields = (voteHeads: readonly VoteHead[]): readonly FieldDef<FieldName<'fee-structure-items'>>[] => [
    { name: 'structure_id', label: 'Structure', kind: 'hidden' },
    { name: 'vote_head_id', label: 'Vote head', kind: 'options', options: voteHeads.filter(v => v.is_active).map(v => ({ id: v.id, label: v.name })), required: true },
    { name: 'annual_amount', label: 'Amount for the year (KES)', kind: 'number', required: true },
];

export const structureTotal = (items: readonly { annual_amount: number }[]) => items.reduce((n, i) => n + Number(i.annual_amount), 0);
/** One term's share of a year's amount. */
export const termShare = (annual: number, pct: number) => Math.round(Number(annual) * pct / 100);

export const AWARD_FIELDS: readonly FieldDef<FieldName<'fee-awards'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'term_id', label: 'Term', kind: 'lookup', lookup: 'terms', required: true },
    { name: 'kind', label: 'Kind', kind: 'enum', values: AWARD_KINDS, required: true },
    { name: 'amount', label: 'Amount (KES)', kind: 'number', required: true },
    { name: 'sponsor', label: 'Sponsor', kind: 'text', hint: 'CDF, county, church, company…' },
    { name: 'reference', label: 'Reference', kind: 'text' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];
export const AWARD_DEFAULTS = { kind: 'BURSARY' } as const;

export const BILL_TERM_WARNING = "Each learner's fee for the term is set from their fee structure (and transport), less bursaries. Payments already made are kept. Running it again replaces the term's invoices.";
export const AWARDS_NOTE = 'Awards reduce what a learner owes when the term is billed (bill again after adding one).';

export const statementTotal = (report: VoteHeadStatement | null, key: 'billed' | 'collected' | 'outstanding' | 'spent') =>
    report?.lines.reduce((n, l) => n + l[key], 0) ?? 0;
