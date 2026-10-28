import React from 'react';
import { humanize } from '@/lib/text';
import { methodLabel as accountMethodLabel } from '@/lib/fee-account';

/**
 * What the Fees page's tabs share: the shapes the fees APIs return, and the
 * small helpers for money, dates and status badges.
 */

export interface FeeRecord {
    id: string;
    totalFee: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
    notes: string;
    termId: string | null;
    termName: string;
    studentName: string | null;
    admissionNumber: string | null;
    studentId: string | null;
    gradeStreamId: string | null;
    className: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface StudentOption {
    id: string;
    name: string;
    admission: string;
    gradeStreamId?: string | null;
    status?: string;
}

export interface TermOption {
    id: string;
    name: string;
    academic_year_id: string | null;
}

/** Rows of /api/school/data?type=students, as far as this page reads them. */
export interface StudentApiRow {
    id: string;
    admission_number: string | null;
    current_grade_stream_id: string | null;
    status: string;
    users: { first_name: string | null; last_name: string | null } | null;
}

export const toStudentOption = (s: StudentApiRow): StudentOption => ({
    id: s.id,
    name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
    admission: s.admission_number ?? '',
    gradeStreamId: s.current_grade_stream_id || null,
    status: s.status,
});

/** One row of the batch screen. Money already paid is read from the ledger, never typed. */
export interface BatchEntry {
    total: string;
    /** New money received now, recorded as a payment on save. */
    payNow: string;
    dueDate: string;
    notes: string;
    existing: FeeRecord | null;
}

export const emptyBatchEntry = (existing: FeeRecord | null): BatchEntry => ({
    total: existing ? String(existing.totalFee) : '',
    payNow: '',
    dueDate: existing?.dueDate || '',
    notes: existing?.notes || '',
    existing,
});

/** Whether the fee part of a row differs from what is saved. */
export const feeChanged = (e: BatchEntry) =>
    e.total !== '' && (
        !e.existing
        || Number(e.total) !== e.existing.totalFee
        || (e.dueDate || '') !== (e.existing.dueDate || '')
        || (e.notes || '') !== (e.existing.notes || '')
    );

export interface StreamOption {
    id: string;
    full_name: string;
}

export interface PaymentLogRow {
    id: string;
    studentFeeId: string | null;
    receiptNumber: string;
    amount: number;
    method: string;
    status: string;
    source: 'AUTO' | 'MANUAL';
    studentName: string | null;
    admissionNumber: string | null;
    unmatchedReference: string | null;
    termId: string | null;
    termName: string | null;
    mpesaReceiptNumber: string | null;
    pesapalConfirmationCode: string | null;
    notes: string | null;
    recordedByName: string | null;
    paidAt: string;
}

export function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB');
}

/** Today as YYYY-MM-DD in the viewer's time zone (what a date input shows). */
export function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Runs `task` over `items`, at most `limit` at a time. */
export async function runLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const item = items[next++];
            await task(item);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** A destructive action waiting for the user to confirm it. */
export interface PendingConfirm {
    title: string;
    message: string;
    confirmText: string;
    run: () => Promise<void>;
}

/** Requests in flight at once while a batch saves. */
export const BATCH_CONCURRENCY = 6;

export function formatCurrency(n: number): string {
    return `KSh ${n.toLocaleString()}`;
}

export const STATUS_BADGE: Record<string, string> = {
    PENDING: 'badge-warning',
    PARTIAL: 'badge-info',
    PAID: 'badge-success',
    OVERPAID: 'badge-info',
    COMPLETED: 'badge-success',
    FAILED: 'badge-danger',
    CANCELLED: 'badge-danger',
};

export const statusBadge = (status: string) => (
    <span className={`badge whitespace-nowrap ${STATUS_BADGE[status] || 'badge-warning'}`}>{humanize(status)}</span>
);

/** Balance figures: red when owing, green when settled (theme-aware viz tokens). */
export const balanceColor = (balance: number) => (balance > 0 ? 'var(--viz-bad)' : 'var(--viz-good)');

/** M-Pesa, Pesapal, Cash, Bank, Cheque, Other. */
export const methodLabel = accountMethodLabel;
