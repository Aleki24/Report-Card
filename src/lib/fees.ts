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
/**
 * What is still owed across fee records. Owed and credit are kept apart: an
 * overpaid term must not hide a term still owing, as a plain sum of balances
 * did on the dashboards.
 */
export function totalOwed(fees: readonly { balance: number }[]): number {
    return fees.reduce((sum, f) => sum + Math.max(0, f.balance || 0), 0);
}

/** Money paid beyond what was billed, across fee records. */
export function totalCredit(fees: readonly { balance: number }[]): number {
    return fees.reduce((sum, f) => sum + Math.max(0, -(f.balance || 0)), 0);
}

export type FeePaymentMethod = 'MPESA' | 'PESAPAL' | 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';
export type FeePaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export const FEE_PAYMENT_METHODS: FeePaymentMethod[] = ['MPESA', 'PESAPAL', 'CASH', 'BANK', 'CHEQUE', 'OTHER'];

export type PaymentProvider = 'NONE' | 'DARAJA' | 'PESAPAL';

/** What a payer's screen does with an online payment's status while it waits. */
export type PaymentWaitStep = 'paid' | 'failed' | 'wait';

/**
 * Whether an online payment's status ends the wait. An M-Pesa prompt that
 * failed (cancelled, wrong PIN) is over. A Pesapal order marked FAILED is
 * not: the payer can retry on the same checkout page and the IPN then
 * records it COMPLETED, so stopping there invited a second payment.
 */
export function paymentWaitStep(status: string | null | undefined, provider: PaymentProvider): PaymentWaitStep {
    if (status === 'COMPLETED') return 'paid';
    if (status === 'CANCELLED' || (status === 'FAILED' && provider !== 'PESAPAL')) return 'failed';
    return 'wait';
}

/** When the wait for an online payment ends with no confirmation. */
export const PAYMENT_UNCONFIRMED_MESSAGE =
    'We haven’t had confirmation yet. If you completed the payment, it will still be recorded — check back in a few minutes before paying again.';

/** When the wait ends on a Pesapal attempt it reported as unsuccessful. */
export const PESAPAL_NOT_CONFIRMED_MESSAGE =
    'Pesapal reported this attempt as unsuccessful. If you retried on the Pesapal page it may still go through — check your fees before paying again.';

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
    /** The bank slip or cheque number of a non-cash, non-M-Pesa payment; on a share of a split payment, the original's code. */
    reference: string | null;
    /** Set on each other learner's share of one payment split between learners. */
    splitFromPaymentId: string | null;
    notes: string | null;
    recordedBy: string | null;
    voidedAt: string | null;
    paidAt: string;
    createdAt: string;
}

/** The code a payment is traced by: the M-Pesa or Pesapal code, else the bank slip or cheque number. */
export const paymentCode = (p: { mpesaReceiptNumber: string | null; pesapalConfirmationCode: string | null; reference: string | null }): string | null =>
    p.mpesaReceiptNumber ?? p.pesapalConfirmationCode ?? p.reference ?? null;

/**
 * The reference a payment is traced by, per method: the M-Pesa code, the bank
 * slip or transaction number, the cheque number. Every non-cash payment needs
 * one, so it can be found on the statement, cannot be entered twice, and a
 * reversal or bounced cheque can be traced. Cash has the receipt; Other may
 * carry one.
 */
export const PAYMENT_REFERENCE: Readonly<Partial<Record<FeePaymentMethod, { label: string; placeholder: string; hint: string; required: boolean }>>> = {
    MPESA: { label: 'M-Pesa code', placeholder: 'e.g. QGX7ZZ99AA', hint: 'From the M-Pesa message. It ties the payment to the statement and stops it being entered twice.', required: true },
    BANK: { label: 'Bank slip or transaction number', placeholder: 'e.g. FT24310ABC12', hint: 'From the deposit slip or the bank’s message, so the payment can be found on the bank statement.', required: true },
    CHEQUE: { label: 'Cheque number', placeholder: 'e.g. 004512', hint: 'Kept so a bounced cheque can be traced and voided.', required: true },
    OTHER: { label: 'Reference (optional)', placeholder: 'Any number that traces it', hint: 'A voucher, transfer or bursary letter number, if there is one.', required: false },
};

/** A reference as stored: trimmed, inner spaces gone, upper case (codes are case-blind). */
export const normalizeReference = (reference: string | null | undefined): string | null => {
    const v = (reference ?? '').replace(/\s+/g, '').toUpperCase();
    return v ? v : null;
};

/** M-Pesa transaction codes: ten letters and digits. */
const MPESA_CODE = /^[A-Z0-9]{10}$/;

/** Why a payment's reference will not do, or null when it is fine. */
export function referenceProblem(method: FeePaymentMethod, reference: string | null | undefined): string | null {
    const field = PAYMENT_REFERENCE[method];
    const v = normalizeReference(reference);
    if (!field) return null;
    if (!v) return field.required ? `Enter the ${field.label.toLowerCase()}.` : null;
    if (v.length > 64) return 'That reference is too long.';
    if (method === 'MPESA' && !MPESA_CODE.test(v)) return 'An M-Pesa code is 10 letters and numbers, like QGX7ZZ99AA.';
    return null;
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
        reference: p.reference ?? null,
        splitFromPaymentId: p.split_from_payment_id ?? null,
        notes: p.notes,
        recordedBy: p.recorded_by,
        voidedAt: p.voided_at ?? null,
        paidAt: p.paid_at,
        createdAt: p.created_at,
    };
}
