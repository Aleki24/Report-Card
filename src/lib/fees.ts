/**
 * fees.ts
 * Shared fee-status and overdue logic for the Fees module — kept in one
 * place so the admin dashboard, student view, and API routes can never
 * drift out of sync on what "PENDING/PARTIAL/PAID/OVERPAID" or "overdue"
 * actually means.
 */

export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERPAID';

/**
 * A total_fee of 0 (a full waiver/scholarship) means nothing is owed, so it
 * must resolve to PAID rather than PENDING even though paid_amount is also 0.
 */
export function computeFeeStatus(total: number, paid: number): FeeStatus {
    if (total <= 0) return paid > 0 ? 'OVERPAID' : 'PAID';
    if (paid <= 0) return 'PENDING';
    if (paid > total) return 'OVERPAID';
    if (paid >= total) return 'PAID';
    return 'PARTIAL';
}

/**
 * A record is overdue once its due date's calendar day has fully elapsed
 * (not the instant the day begins) and there's still a balance owing.
 * due_date is a plain YYYY-MM-DD DATE column; parsed by hand so the
 * comparison is anchored to local calendar days instead of drifting with
 * UTC-vs-local midnight parsing.
 */
export function isOverdue(dueDate: string | null | undefined, balance: number): boolean {
    if (!dueDate || balance <= 0) return false;
    const [y, m, d] = dueDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    const endOfDueDay = new Date(y, m - 1, d, 23, 59, 59, 999);
    return endOfDueDay.getTime() < Date.now();
}
