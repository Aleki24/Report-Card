import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne } from '@/lib/postgrest';
import { allocateByPriority } from '@/lib/finance/billing';
import { loadFeeAccount } from '@/lib/fee-account-server';
import type { FeeAccount } from '@/lib/fee-account';

/**
 * Everything a receipt prints about one payment. Balances are as they
 * stood right after the payment (from the statement's running balance), so
 * a receipt reprinted next term still matches the one handed over.
 */

export interface ReceiptAllocation {
    description: string;
    amount: number;
}

export interface FeeReceiptRecord {
    paymentId: string;
    schoolId: string;
    studentId: string;
    receiptNumber: string;
    status: string;
    amount: number;
    method: string;
    reference: string | null;
    payerName: string | null;
    phoneNumber: string | null;
    notes: string | null;
    paidAt: string;
    recordedByName: string | null;
    termName: string;
    yearName: string | null;
    /** The term's fees after bursaries. */
    termBilled: number;
    /** Paid towards the term, this payment included. */
    termPaidToDate: number;
    termBalance: number;
    /** Owed across every term once this payment was in; negative is credit. */
    accountBalance: number;
    /** What this payment cleared, by vote head (empty when the term was not billed from a structure). */
    allocation: ReceiptAllocation[];
    learner: FeeAccount['learner'];
}

interface PaymentRow {
    id: string;
    school_id: string;
    student_fee_id: string | null;
    receipt_number: string;
    status: string;
    amount: number | string;
    method: string;
    mpesa_receipt_number: string | null;
    pesapal_confirmation_code: string | null;
    payer_name: string | null;
    phone_number: string | null;
    notes: string | null;
    paid_at: string;
    recorded_by: string | null;
    student_fees: { student_id: string; term_id: string } | { student_id: string; term_id: string }[] | null;
}

interface LineRow {
    vote_head_id: string | null;
    description: string;
    amount: number | string;
    vote_heads: { priority: number | null } | { priority: number | null }[] | null;
}

/** One payment as its receipt prints it, or null when there is no such payment against a learner. */
export async function loadFeeReceipt(supabase: SupabaseClient, paymentId: string): Promise<FeeReceiptRecord | null> {
    const { data: payment, error } = await supabase
        .from('fee_payments')
        .select('id, school_id, student_fee_id, receipt_number, status, amount, method, mpesa_receipt_number, pesapal_confirmation_code, payer_name, phone_number, notes, paid_at, recorded_by, student_fees ( student_id, term_id )')
        .eq('id', paymentId)
        .maybeSingle<PaymentRow>();
    if (error) throw new Error('Could not load the payment');
    const fee = embedOne(payment?.student_fees ?? null);
    if (!payment || !fee) return null;

    const [account, recorder, linesRes] = await Promise.all([
        loadFeeAccount(supabase, payment.school_id, fee.student_id),
        payment.recorded_by
            ? supabase.from('users').select('first_name, last_name').eq('id', payment.recorded_by).maybeSingle().then(r => r.data)
            : Promise.resolve(null),
        supabase
            .from('invoice_lines')
            .select('vote_head_id, description, amount, vote_heads ( priority ), invoices!inner ( student_id, term_id )')
            .eq('invoices.student_id', fee.student_id)
            .eq('invoices.term_id', fee.term_id)
            .returns<LineRow[]>(),
    ]);
    if (!account) return null;
    const term = account.terms.find(t => t.feeId === payment.student_fee_id);
    if (!term) return null;

    const amount = Number(payment.amount);
    // Payments to this term up to this one, oldest first (a voided payment counts only towards itself).
    const termPayments = account.payments.filter(p => p.feeId === term.feeId).sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.receiptNumber.localeCompare(b.receiptNumber));
    const at = termPayments.findIndex(p => p.id === payment.id);
    const before = (at >= 0 ? termPayments.slice(0, at) : termPayments.filter(p => p.paidAt <= payment.paid_at)).reduce((n, p) => n + p.amount, 0);
    const termPaidToDate = before + amount;

    const ledgerEntry = account.ledger.find(e => e.paymentId === payment.id);
    const accountBalance = ledgerEntry ? ledgerEntry.balance : account.totals.balance;

    // What this payment paid for: the term's vote heads filled in priority order.
    const lines = (linesRes.data ?? []).map((l, i) => ({
        voteHeadId: l.vote_head_id ?? `line-${i}`,
        description: l.description,
        amount: Number(l.amount),
        priority: embedOne(l.vote_heads)?.priority ?? 1000 + i,
    }));
    const allocation: ReceiptAllocation[] = [];
    if (lines.length > 0) {
        const upTo = allocateByPriority(lines, termPaidToDate);
        const prior = allocateByPriority(lines, before);
        for (const l of [...lines].sort((a, b) => a.priority - b.priority)) {
            const share = (upTo.allocated.get(l.voteHeadId) ?? 0) - (prior.allocated.get(l.voteHeadId) ?? 0);
            if (share > 0.004) allocation.push({ description: l.description, amount: Math.round(share * 100) / 100 });
        }
        const extra = upTo.overpaid - prior.overpaid;
        if (extra > 0.004) allocation.push({ description: 'Credit carried forward', amount: Math.round(extra * 100) / 100 });
    }

    return {
        paymentId: payment.id,
        schoolId: payment.school_id,
        studentId: fee.student_id,
        receiptNumber: payment.receipt_number,
        status: payment.status,
        amount,
        method: payment.method,
        reference: payment.mpesa_receipt_number ?? payment.pesapal_confirmation_code ?? null,
        payerName: payment.payer_name,
        phoneNumber: payment.phone_number,
        notes: payment.notes,
        paidAt: payment.paid_at,
        recordedByName: recorder ? `${recorder.first_name ?? ''} ${recorder.last_name ?? ''}`.trim() || null : null,
        termName: term.termName,
        yearName: term.yearName,
        termBilled: term.billed,
        termPaidToDate,
        termBalance: Math.round((term.billed - termPaidToDate) * 100) / 100,
        accountBalance,
        allocation,
        learner: account.learner,
    };
}
