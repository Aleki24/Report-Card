/**
 * Following up arrears: what was said to a family (a call, a message, a
 * meeting) and what they promised to pay by when. Whether a promise was kept
 * is read from the payments, not ticked by hand. Client-safe and shared with
 * the phone app.
 */
import { z } from 'zod';

export const FOLLOWUPS_URL = '/api/school/fees/followups';

export type FollowUpKind = 'NOTE' | 'PROMISE';
/** KEPT: paid by the due date. DUE: not yet, but there is still time. BROKEN: the date passed short. */
export type PromiseState = 'KEPT' | 'DUE' | 'BROKEN';

export interface PromiseProgress {
    amount: number;
    dueDate: string;
    state: PromiseState;
    /** Paid from the day of the promise to its due date. */
    paidByDue: number;
}

export interface FeeFollowUp {
    id: string;
    studentId: string;
    kind: FollowUpKind;
    note: string;
    createdAt: string;
    createdByName: string | null;
    /** For a promise: the amount, the date, and how it went. */
    promise: PromiseProgress | null;
}

/** The follow-up a learner's row in Who owes shows: when the family was last contacted, and the latest promise. */
export interface FollowUpSummary {
    lastContactAt: string | null;
    promise: PromiseProgress | null;
}

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.');

export const followUpBodySchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('NOTE'),
        studentId: z.string().min(1).max(64),
        note: z.string().trim().min(3, 'Say what was said.').max(500),
    }),
    z.object({
        kind: z.literal('PROMISE'),
        studentId: z.string().min(1).max(64),
        note: z.string().trim().max(500).default(''),
        amount: z.number().positive('Enter the amount promised.').max(100_000_000),
        dueDate: isoDay,
    }),
]);
export type FollowUpBody = z.input<typeof followUpBodySchema>;

/** Where a promise stands, from what was paid between the day it was made and its due date. */
export function promiseState(amount: number, dueDate: string, paidByDue: number, today: string): PromiseState {
    if (paidByDue >= amount - 0.009) return 'KEPT';
    return today <= dueDate ? 'DUE' : 'BROKEN';
}

export const PROMISE_COPY: Record<PromiseState, { label: string; hue: 'emerald' | 'sky' | 'rose' }> = {
    KEPT: { label: 'Promise kept', hue: 'emerald' },
    DUE: { label: 'Promised', hue: 'sky' },
    BROKEN: { label: 'Promise broken', hue: 'rose' },
};

/** Quick notes a bursar writes most, one tap each. */
export const FOLLOW_UP_NOTES = ['Called, no answer', 'Called, will pay soon', 'Sent a reminder SMS', 'Met the parent', 'Asked for a payment plan'] as const;
