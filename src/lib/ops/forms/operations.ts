/**
 * Library, inventory and staff leave: the row shapes, status colours and
 * form fields the web pages and the mobile screens share, so both show and
 * collect exactly the same things.
 */
import type { FieldDef, FieldName } from '../form';
import type { LookupOption } from '../lookups';
import type { PersonName } from '../resource';
import type { PillTone } from '../tones';
import { daysUntil, today } from '../format';
import { ITEM_TYPES, LEAVE_TYPES, type LeaveStatus, type RequisitionStatus } from '../resources/operations';

// ── Library ──────────────────────────────────────────────────

export interface Book { id: string; title: string; author: string | null; isbn: string | null; category: string | null; shelf: string | null; copies_total: number }
export interface Loan { id: string; book_id: string; issued_on: string; due_on: string; returned_on: string | null; fine_amount: number; book: { title: string; author: string | null } | null; borrower: PersonName | null }

export type LoanState = 'OUT' | 'OVERDUE' | 'RETURNED';
export const LOAN_TONES: Record<LoanState, PillTone> = { OUT: 'info', OVERDUE: 'bad', RETURNED: 'good' };
export const loanState = (l: Loan): LoanState => (l.returned_on ? 'RETURNED' : (daysUntil(l.due_on) ?? 0) < 0 ? 'OVERDUE' : 'OUT');
export const inTwoWeeks = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

export const BOOK_FIELDS: readonly FieldDef<FieldName<'books'>>[] = [
    { name: 'title', label: 'Title', kind: 'text', required: true, span: 'full' },
    { name: 'author', label: 'Author', kind: 'text' },
    { name: 'isbn', label: 'ISBN', kind: 'text' },
    { name: 'category', label: 'Category', kind: 'text', hint: 'Class text, set book, reference, fiction…' },
    { name: 'shelf', label: 'Shelf', kind: 'text' },
    { name: 'copies_total', label: 'Copies', kind: 'number', required: true },
];
export const BOOK_DEFAULTS = { copies_total: '1' } as const;

export const loanFields = (books: readonly Book[]): readonly FieldDef<FieldName<'loans'>>[] => [
    { name: 'book_id', label: 'Book', kind: 'options', options: books.map(b => ({ id: b.id, label: b.title, hint: b.author ?? undefined })), required: true, span: 'full' },
    { name: 'borrower_id', label: 'Borrower', kind: 'lookup', lookup: 'people', required: true, span: 'full' },
    { name: 'issued_on', label: 'Issued', kind: 'date', required: true },
    { name: 'due_on', label: 'Due back', kind: 'date', required: true },
    { name: 'fine_amount', label: 'Fine (KES)', kind: 'number' },
];
export const loanDefaults = () => ({ issued_on: today(), due_on: inTwoWeeks(), fine_amount: '0' });

/** Copies of each book out on loan now. */
export function copiesOut(openLoans: readonly Loan[]): Map<string, number> {
    const out = new Map<string, number>();
    openLoans.forEach(l => out.set(l.book_id, (out.get(l.book_id) ?? 0) + 1));
    return out;
}

// ── Inventory ────────────────────────────────────────────────

export interface Item { id: string; name: string; item_type: string; category: string | null; unit: string; quantity: number; reorder_level: number; location: string | null; unit_value: number | null }
export interface Requisition { id: string; quantity: number; purpose: string | null; status: RequisitionStatus; created_at: string; requested_by: string | null; item: { name: string; unit: string; quantity: number } | null; requester: PersonName | null }

export const REQUISITION_TONES: Record<RequisitionStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', ISSUED: 'good' };

export const ITEM_FIELDS: readonly FieldDef<FieldName<'inventory'>>[] = [
    { name: 'name', label: 'Item', kind: 'text', required: true, span: 'full' },
    { name: 'item_type', label: 'Type', kind: 'enum', values: ITEM_TYPES, required: true, labels: { ASSET: 'Asset (furniture, equipment)', CONSUMABLE: 'Consumable (food, stationery)' } },
    { name: 'category', label: 'Category', kind: 'text' },
    { name: 'unit', label: 'Unit', kind: 'text', required: true, placeholder: 'pcs, kg, bags, reams' },
    { name: 'quantity', label: 'Quantity', kind: 'number', required: true },
    { name: 'reorder_level', label: 'Reorder at', kind: 'number' },
    { name: 'location', label: 'Location', kind: 'text' },
    { name: 'serial_number', label: 'Serial / tag', kind: 'text' },
    { name: 'unit_value', label: 'Unit value (KES)', kind: 'number' },
];
export const ITEM_DEFAULTS = { item_type: 'CONSUMABLE', unit: 'pcs', reorder_level: '0' } as const;

export const itemOptions = (items: readonly Item[]): LookupOption[] =>
    items.map(i => ({ id: i.id, label: i.name, hint: `${i.quantity} ${i.unit} in store` }));

export const requisitionFields = (items: readonly Item[]): readonly FieldDef<FieldName<'requisitions'>>[] => [
    { name: 'item_id', label: 'Item', kind: 'options', options: itemOptions(items), required: true, span: 'full' },
    { name: 'quantity', label: 'Quantity', kind: 'number', required: true },
    { name: 'purpose', label: 'For', kind: 'textarea' },
];

export const needsReorder = (i: Item) => i.item_type === 'CONSUMABLE' && Number(i.quantity) <= Number(i.reorder_level);
export const stockValue = (items: readonly Item[]) => items.reduce((n, r) => n + Number(r.quantity) * Number(r.unit_value ?? 0), 0);

/** The store keeper's next steps on a requisition. */
export const requisitionDecisions = (status: RequisitionStatus) =>
    status === 'PENDING'
        ? ([{ decision: 'APPROVE', label: 'Approve', success: 'Approved.' }, { decision: 'REJECT', label: 'Reject', success: 'Rejected.' }] as const)
        : status === 'APPROVED'
            ? ([{ decision: 'ISSUE', label: 'Issue', success: 'Issued and taken off stock.' }] as const)
            : ([] as const);

// ── Staff leave ──────────────────────────────────────────────

export interface Leave { id: string; staff_id: string; leave_type: string; starts_on: string; ends_on: string; reason: string | null; cover_notes: string | null; status: LeaveStatus; staff: PersonName | null; decider: PersonName | null }

export const LEAVE_TONES: Record<LeaveStatus, PillTone> = { PENDING: 'warn', APPROVED: 'good', REJECTED: 'bad', CANCELLED: 'neutral' };

export const LEAVE_FIELDS: readonly FieldDef<FieldName<'leave'>>[] = [
    { name: 'leave_type', label: 'Type', kind: 'enum', values: LEAVE_TYPES, required: true },
    { name: 'starts_on', label: 'First day', kind: 'date', required: true },
    { name: 'ends_on', label: 'Last day', kind: 'date', required: true },
    { name: 'reason', label: 'Reason', kind: 'textarea' },
    { name: 'cover_notes', label: 'Lessons and duties to cover', kind: 'textarea', hint: 'Helps the DOS arrange cover.' },
];
export const leaveDefaults = () => ({ leave_type: 'ANNUAL', starts_on: today(), ends_on: today() });

export const leaveDays = (l: Leave) => Math.round((Date.parse(l.ends_on) - Date.parse(l.starts_on)) / 86_400_000) + 1;
