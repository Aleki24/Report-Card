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

/**
 * Individual entries in the fee_payments ledger. student_fees.paid_amount
 * and .status are derived from the SUM of COMPLETED rows here by a DB
 * trigger (see supabase/migrations/20260720191758_add_fee_payments_ledger.sql)
 * — every entry point (manual recording, M-Pesa STK Push, M-Pesa C2B
 * confirmation) writes here rather than touching the aggregate directly.
 */
export type FeePaymentMethod = 'MPESA' | 'PESAPAL' | 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';
export type FeePaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export const FEE_PAYMENT_METHODS: FeePaymentMethod[] = ['MPESA', 'PESAPAL', 'CASH', 'BANK', 'CHEQUE', 'OTHER'];

export type PaymentProvider = 'NONE' | 'DARAJA' | 'PESAPAL';

export interface FeePayment {
    id: string;
    studentFeeId: string | null;
    receiptNumber: string;
    amount: number;
    method: FeePaymentMethod;
    status: FeePaymentRecordStatus;
    phoneNumber: string | null;
    payerName: string | null;
    mpesaReceiptNumber: string | null;
    mpesaCheckoutRequestId: string | null;
    pesapalOrderTrackingId: string | null;
    pesapalConfirmationCode: string | null;
    pesapalPaymentMethod: string | null;
    unmatchedAccountReference: string | null;
    notes: string | null;
    recordedBy: string | null;
    paidAt: string;
    createdAt: string;
}

export interface SchoolBankAccount {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch: string | null;
    isPrimary: boolean;
}

export function mapBankAccountRow(a: any): SchoolBankAccount {
    return {
        id: a.id,
        bankName: a.bank_name,
        accountName: a.account_name,
        accountNumber: a.account_number,
        branch: a.branch,
        isPrimary: a.is_primary,
    };
}

export function mapFeePaymentRow(p: any): FeePayment {
    return {
        id: p.id,
        studentFeeId: p.student_fee_id,
        receiptNumber: p.receipt_number,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        phoneNumber: p.phone_number,
        payerName: p.payer_name,
        mpesaReceiptNumber: p.mpesa_receipt_number,
        mpesaCheckoutRequestId: p.mpesa_checkout_request_id,
        pesapalOrderTrackingId: p.pesapal_order_tracking_id,
        pesapalConfirmationCode: p.pesapal_confirmation_code,
        pesapalPaymentMethod: p.pesapal_payment_method,
        unmatchedAccountReference: p.unmatched_account_reference,
        notes: p.notes,
        recordedBy: p.recorded_by,
        paidAt: p.paid_at,
        createdAt: p.created_at,
    };
}
