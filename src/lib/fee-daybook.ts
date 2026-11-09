/**
 * The day book: one day's money in, how it came (method, and who recorded
 * it), and a sign-off by someone who looked it over. The person who records
 * payments should not be the only one who checks them, so a reviewer who
 * recorded some of the day's money says so when signing. A payment recorded
 * or voided after the sign-off shows the day as changed since.
 *
 * Client-safe: shared by the web page and the phone app.
 */
import { z } from 'zod';
import type { FeePaymentMethod } from './fees';

export const DAYBOOK_URL = '/api/school/fees/daybook';

/** How many days back the strip of recent days reaches, today included. */
export const DAYBOOK_RECENT_DAYS = 14;

export interface DayBookPayment {
    id: string;
    receiptNumber: string;
    amount: number;
    method: FeePaymentMethod;
    voided: boolean;
    learner: string | null;
    admissionNumber: string | null;
    /** What the payer typed, for money not matched to a learner. */
    unmatchedReference: string | null;
    /** M-Pesa or Pesapal code, bank slip or cheque number. */
    code: string | null;
    payerName: string | null;
    /** Who typed it in; null when it came in on its own. */
    recordedByName: string | null;
    automatic: boolean;
    paidAt: string;
    /** The day it was entered, when that was after the day it was paid (a back-dated entry). */
    recordedLateOn: string | null;
    voidedByName: string | null;
    notes: string | null;
}

/** Money in one group of the day's payments. */
export interface DayBookBucket {
    key: string;
    label: string;
    amount: number;
    count: number;
}

export interface DayBookReview {
    reviewedByName: string | null;
    reviewedAt: string;
    note: string | null;
    /** The day's money in when it was signed. */
    total: number;
    payments: number;
    /** The reviewer recorded some of the day's payments themselves. */
    ownEntries: boolean;
}

/** One day in the strip of recent days. */
export interface DayBookDay {
    day: string;
    amount: number;
    count: number;
    reviewed: boolean;
    /** Money in differs from what was signed. */
    changed: boolean;
}

export interface DayBook {
    day: string;
    /** Completed and voided, oldest first. */
    payments: DayBookPayment[];
    received: { amount: number; count: number };
    voided: { amount: number; count: number };
    /** Money in no learner has yet (it still counts as received). */
    unmatched: { amount: number; count: number };
    /** Payments entered on a later day than they were paid. */
    recordedLate: number;
    byMethod: DayBookBucket[];
    byRecorder: DayBookBucket[];
    review: DayBookReview | null;
    /** A payment was recorded or voided after the sign-off. */
    changedSinceReview: boolean;
    /** The person looking recorded some of the day's payments. */
    viewerRecorded: boolean;
    /** The last DAYBOOK_RECENT_DAYS days to today, newest first. */
    recent: DayBookDay[];
}

export const dayReviewSchema = z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a day.'),
    note: z.string().trim().max(500).nullish(),
    /** Signing off a day you recorded money in yourself: said out loud. */
    ownEntries: z.boolean().optional(),
});
export type DayReviewBody = z.infer<typeof dayReviewSchema>;

/** Whether two amounts of money differ by more than rounding. */
export const moneyDiffers = (a: number, b: number): boolean => Math.abs(a - b) > 0.009;
