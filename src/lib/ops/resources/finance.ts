import { z } from 'zod';
import { defineResource, STUDENT_JOIN } from '../resource';
import {
    text, optionalText, isoDate, optionalUuid, uuid, oneOf, money, count, bool, personId,
} from '../zod-fields';

export const RESIDENCES = ['DAY', 'BOARDER'] as const;
export type Residence = (typeof RESIDENCES)[number];
export const STRUCTURE_RESIDENCES = ['ALL', ...RESIDENCES] as const;
export const AWARD_KINDS = ['BURSARY', 'SCHOLARSHIP', 'WAIVER', 'DISCOUNT'] as const;
export const EXPENSE_METHODS = ['CASH', 'BANK', 'MPESA', 'CHEQUE'] as const;
export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const voteHeads = defineResource({
    table: 'vote_heads',
    module: 'fee_structures',
    label: { singular: 'Vote head', plural: 'Vote heads' },
    read: ['billing.view', 'expenses.view', 'expenses.request'],
    write: ['billing.manage'],
    schema: z.object({
        name: text(120),
        code: optionalText(20),
        priority: count(10_000).default(100),
        is_active: bool.default(true),
    }),
    order: { column: 'priority' },
    audit: true,
});

/** Shares must be positive and add up to 100%. */
const termSplit = z.array(z.preprocess(v => (typeof v === 'string' ? Number(v) : v), z.number().min(0).max(100))).min(1).max(4)
    .refine(parts => Math.abs(parts.reduce((a, b) => a + b, 0) - 100) < 0.01, 'The term shares must add up to 100%');

export const feeStructures = defineResource({
    table: 'fee_structures',
    module: 'fee_structures',
    label: { singular: 'Fee structure', plural: 'Fee structures' },
    read: ['billing.view'],
    write: ['billing.manage'],
    schema: z.object({
        name: text(150),
        academic_year_id: uuid,
        grade_id: optionalUuid,
        residence: oneOf(STRUCTURE_RESIDENCES).default('ALL'),
        term_split: termSplit.default([50, 30, 20]),
        notes: optionalText(1000),
    }),
    select: '*, year:academic_years(name), grade:grades(name_display), items:fee_structure_items(id, vote_head_id, annual_amount, vote_head:vote_heads(name))',
    order: { column: 'created_at', ascending: false },
    filters: ['academic_year_id'],
    refs: { academic_year_id: 'academic_years' },
    audit: true,
});

export const feeStructureItems = defineResource({
    table: 'fee_structure_items',
    module: 'fee_structures',
    label: { singular: 'Fee item', plural: 'Fee items' },
    read: ['billing.view'],
    write: ['billing.manage'],
    schema: z.object({
        structure_id: uuid,
        vote_head_id: uuid,
        annual_amount: money,
    }),
    select: '*, vote_head:vote_heads(name)',
    filters: ['structure_id'],
    refs: { structure_id: 'fee_structures', vote_head_id: 'vote_heads' },
    audit: true,
});

export const feeAwards = defineResource({
    table: 'fee_awards',
    module: 'fee_structures',
    label: { singular: 'Award', plural: 'Bursaries & waivers' },
    read: ['billing.view'],
    write: ['billing.manage'],
    schema: z.object({
        student_id: personId,
        term_id: uuid,
        kind: oneOf(AWARD_KINDS).default('BURSARY'),
        sponsor: optionalText(200),
        amount: money.pipe(z.number().positive('Must be more than zero')),
        reference: optionalText(100),
        notes: optionalText(1000),
    }),
    select: `*, term:terms(name), ${STUDENT_JOIN}`,
    order: { column: 'created_at', ascending: false },
    filters: ['term_id', 'student_id', 'kind'],
    refs: { student_id: 'students', term_id: 'terms' },
    createdByColumn: 'created_by',
    audit: true,
});

export const suppliers = defineResource({
    table: 'suppliers',
    module: 'expenses',
    label: { singular: 'Supplier', plural: 'Suppliers' },
    read: ['expenses.view', 'expenses.request'],
    write: ['expenses.approve'],
    schema: z.object({
        name: text(200),
        phone: optionalText(30),
        email: optionalText(200),
        kra_pin: optionalText(20),
        category: optionalText(100),
    }),
    order: { column: 'name' },
});

export const expenses = defineResource({
    table: 'expenses',
    module: 'expenses',
    label: { singular: 'Expense', plural: 'Expenses' },
    read: ['expenses.view', 'expenses.approve'],
    write: ['expenses.approve'],
    schema: z.object({
        description: text(300),
        amount: money.pipe(z.number().positive('Must be more than zero')),
        expense_date: isoDate,
        supplier_id: optionalUuid,
        vote_head_id: optionalUuid,
        payment_method: z.preprocess(v => (v === '' ? null : v), z.enum(EXPENSE_METHODS).nullable()).optional(),
        reference: optionalText(100),
    }),
    select: '*, supplier:suppliers(name), vote_head:vote_heads(name), requester:users!expenses_requested_by_fkey(first_name, last_name), decider:users!expenses_decided_by_fkey(first_name, last_name)',
    order: { column: 'expense_date', ascending: false },
    filters: ['status', 'vote_head_id', 'supplier_id'],
    refs: { supplier_id: 'suppliers', vote_head_id: 'vote_heads' },
    own: {
        column: 'requested_by',
        permission: 'expenses.request',
        fields: ['description', 'amount', 'expense_date', 'supplier_id', 'vote_head_id', 'payment_method', 'reference'],
        editableWhile: { column: 'status', values: ['PENDING'] },
    },
    audit: true,
});
