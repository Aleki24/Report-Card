/**
 * Reconciling a statement against the ledger: what the page sends and gets
 * back. A statement's money in must be accounted for line by line: recorded
 * now against a learner, already in Skulbase, left in the unmatched queue to
 * chase, or set aside as not school fees. And the ledger's payments for the
 * period should all be on the statement. Client-safe and shared with the app.
 */
import { z } from 'zod';
import type { MatchCandidate, MatchKind } from './fee-matching';
import type { StatementRow, StatementSource } from './fee-statement';
import type { FeePayment } from './fees';
import { schoolDayOf, schoolTimeOf } from './dates';

export const RECONCILE_URL = '/api/school/fees/reconcile';

/** RECORDED: the code is already in Skulbase; the rest come from matching. */
export type ReconcileStatus = 'RECORDED' | MatchKind;

export interface PreviewLine extends StatementRow {
    status: ReconcileStatus;
    candidates: MatchCandidate[];
    /** For a line already in Skulbase: its receipt, and the amount recorded (shares included). */
    recorded?: { receiptNumber: string; amount: number; unmatched: boolean };
}

/** A learner to pick when matching by hand. */
export interface DirectoryLearner {
    id: string;
    name: string;
    admissionNumber: string | null;
    className: string | null;
    /** Owed across every term; negative is credit. */
    balance: number;
}

/** A payment in Skulbase for the statement's period that the statement does not show. */
export interface LedgerOnlyPayment {
    id: string;
    receiptNumber: string;
    code: string | null;
    amount: number;
    paidAt: string;
    learner: string | null;
}

export interface ReconcilePreview {
    source: StatementSource;
    lines: PreviewLine[];
    learners: DirectoryLearner[];
    ledgerOnly: LedgerOnlyPayment[];
    period: { from: string | null; to: string | null };
}

/** RECORD against learners, QUEUE in the unmatched list to chase, or SKIP (not school fees). */
export type LineAction = 'RECORD' | 'QUEUE' | 'SKIP';

const statementRowSchema = z.object({
    line: z.number().int().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).nullable(),
    amount: z.number().positive().max(100_000_000),
    code: z.string().trim().max(64).nullable(),
    accountRef: z.string().trim().max(120).nullable(),
    payerName: z.string().trim().max(160).nullable(),
    phone: z.string().trim().max(32).nullable(),
    details: z.string().max(400),
});

export const previewBodySchema = z.object({
    source: z.enum(['MPESA', 'BANK']),
    rows: z.array(statementRowSchema).min(1, 'The statement has no payments in.').max(5000, 'Upload at most 5,000 lines at a time.'),
});

export const allocationSchema = z.object({ studentId: z.string().min(1).max(64), amount: z.number().positive() });
/** A learner's share of a payment. */
export type Allocation = z.infer<typeof allocationSchema>;

export const commitBodySchema = z.object({
    source: z.enum(['MPESA', 'BANK']),
    fileName: z.string().trim().max(200).nullable(),
    lines: z.array(statementRowSchema.extend({
        action: z.enum(['RECORD', 'QUEUE', 'SKIP']),
        allocations: z.array(allocationSchema).max(8).default([]),
    })).min(1).max(5000),
});
export type CommitBody = z.infer<typeof commitBodySchema>;

export interface ReconcileSummary {
    id: string;
    source: StatementSource;
    file_name: string | null;
    period_from: string | null;
    period_to: string | null;
    lines: number;
    statement_total: number;
    recorded_total: number;
    already_total: number;
    unmatched_total: number;
    skipped_total: number;
    created_at: string;
    created_by_name: string | null;
}

export interface CommitResult {
    summary: ReconcileSummary;
    /** Lines whose learner has no fee record yet: their money waits as unmatched. */
    notBilled: number;
    /** Lines already recorded by the time this was saved (another upload, or M-Pesa itself). */
    alreadyRecorded: number;
}

export const UNMATCHED_URL = '/api/school/fees/unmatched';

/** What the unmatched queue loads: the payments, who each most likely is, and everyone to pick from. */
export interface UnmatchedResponse {
    data: FeePayment[];
    suggestions?: Record<string, MatchCandidate[]>;
    learners?: DirectoryLearner[];
}

/** What a payer typed as the account, unless the Paybill got nothing. */
export const typedAccount = (reference: string | null): string | null =>
    reference && !reference.startsWith('(none') ? reference : null;

/** An unmatched payment shaped like a statement line, so it is reviewed the same way. */
export function unmatchedAsLine(p: FeePayment, index: number, candidates: MatchCandidate[]): PreviewLine {
    return {
        line: index + 1,
        date: schoolDayOf(p.paidAt),
        time: schoolTimeOf(p.paidAt),
        amount: p.amount,
        code: p.mpesaReceiptNumber ?? p.reference ?? null,
        accountRef: typedAccount(p.unmatchedAccountReference),
        payerName: p.payerName,
        phone: p.phoneNumber,
        details: p.notes ?? '',
        status: candidates.length > 0 ? 'SUGGESTED' : 'UNMATCHED',
        candidates,
    };
}

/** Whether a statement's money in is fully accounted for. */
export const reconciled = (s: Pick<ReconcileSummary, 'statement_total' | 'recorded_total' | 'already_total' | 'unmatched_total' | 'skipped_total'>): boolean =>
    Math.abs(s.statement_total - (s.recorded_total + s.already_total + s.unmatched_total + s.skipped_total)) < 0.01;

export const STATUS_COPY: Record<ReconcileStatus, { label: string; hue: 'emerald' | 'sky' | 'amber' | 'rose' }> = {
    MATCHED: { label: 'Matched', hue: 'emerald' },
    RECORDED: { label: 'Already in Skulbase', hue: 'sky' },
    SUGGESTED: { label: 'Check', hue: 'amber' },
    UNMATCHED: { label: 'No match', hue: 'rose' },
};
