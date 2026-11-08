import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { embedOne } from '@/lib/postgrest';
import { phoneKey } from '@/lib/fee-matching';
import { shareBodySchema, type ShareCandidates } from '@/lib/fee-reconcile';
import { feeRecordsForPayment, insertShares, loadLearnerDirectory } from '@/lib/fee-reconcile-server';

interface PaymentRow {
    id: string;
    student_fee_id: string | null;
    amount: number | string;
    method: string;
    status: string;
    mpesa_receipt_number: string | null;
    reference: string | null;
    receipt_number: string;
    payer_name: string | null;
    phone_number: string | null;
    paid_at: string;
    split_from_payment_id: string | null;
    reconciliation_id: string | null;
    student_fees: { student_id: string } | { student_id: string }[] | null;
}

const money = (n: number) => Math.round(n * 100) / 100;

/** The payment to share, if it can be: completed, on a learner, and not itself a share. */
async function shareablePayment(db: SupabaseClient, access: Pick<Access, 'schoolId'>, paymentId: string): Promise<PaymentRow & { ownerId: string }> {
    const { data, error } = await db
        .from('fee_payments')
        .select('id, student_fee_id, amount, method, status, mpesa_receipt_number, reference, receipt_number, payer_name, phone_number, paid_at, split_from_payment_id, reconciliation_id, student_fees ( student_id )')
        .eq('id', paymentId)
        .eq('school_id', access.schoolId)
        .maybeSingle<PaymentRow>();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Payment not found.');
    if (data.status !== 'COMPLETED') throw new HttpError(400, 'Only a completed payment can be shared.');
    const ownerId = embedOne(data.student_fees)?.student_id;
    if (!data.student_fee_id || !ownerId) throw new HttpError(400, 'Match this payment to a learner first (Fees › Reconcile).');
    if (data.split_from_payment_id) throw new HttpError(400, 'This is already a share of another payment. Share the original receipt instead.');
    return { ...data, ownerId };
}

/** GET: who the payment could go to, brothers and sisters first (a guardian phone in common, or the payer's phone). */
export const GET = route<{ paymentId: string }>('payment share candidates', { module: 'fees', permission: 'fees.manage' }, async ({ access, params }): Promise<ShareCandidates> => {
    const db = createSupabaseAdmin();
    const payment = await shareablePayment(db, access, params.paymentId);
    const { learners, directory } = await loadLearnerDirectory(db, access.schoolId);
    const owner = learners.find(l => l.id === payment.ownerId);
    const family = new Set([...(owner?.phones ?? []), payment.phone_number].map(phoneKey).filter((k): k is string => !!k));
    const siblingIds = new Set(learners.filter(l => l.id !== payment.ownerId && l.phones.some(p => family.has(phoneKey(p) ?? ''))).map(l => l.id));
    return {
        owner: directory.find(l => l.id === payment.ownerId) ?? null,
        siblings: directory.filter(l => siblingIds.has(l.id)),
        learners: directory.filter(l => l.id !== payment.ownerId),
    };
});

/**
 * POST { studentId, amount }: moves part of a payment to another learner,
 * for one M-Pesa payment that covered two children but came in under one
 * child's admission number. The payment keeps its code and the rest of the
 * money; the share becomes the other learner's own receipt, pointing back to
 * it. Voiding the share later gives its money back to the payment.
 */
export const POST = route<{ paymentId: string }>('payment share', { module: 'fees', permission: 'fees.manage' }, async ({ access, request, params }) => {
    const { studentId, amount } = await parseBody(request, shareBodySchema);
    const db = createSupabaseAdmin();
    const payment = await shareablePayment(db, access, params.paymentId);
    const total = money(Number(payment.amount));
    const share = money(amount);
    if (share >= total) throw new HttpError(400, `The share must be less than the payment (KSh ${total.toLocaleString()}). To move all of it, void it and record it for the right learner.`);
    if (studentId === payment.ownerId) throw new HttpError(400, 'Pick a different learner from the one the payment is on.');
    const feeId = (await feeRecordsForPayment(db, access.schoolId, [studentId])).get(studentId);
    if (!feeId) throw new HttpError(400, 'That learner has no fee record yet. Bill them first (Billing › Invoicing), then share the payment.');

    // Conditional on the amount: someone sharing or voiding the same payment
    // at the same moment would otherwise split money that is no longer there.
    const { data: cut, error: cutError } = await db
        .from('fee_payments')
        .update({ amount: money(total - share), updated_at: new Date().toISOString() })
        .eq('id', payment.id)
        .eq('status', 'COMPLETED')
        .eq('amount', total)
        .select('id');
    if (cutError) throw cutError;
    if (!cut || cut.length === 0) throw new HttpError(409, 'The payment changed while you were sharing it. Reload and try again.');
    try {
        await insertShares(db, access, payment, [{ feeId, amount: share }]);
    } catch (err) {
        await db.from('fee_payments').update({ amount: total }).eq('id', payment.id);
        throw err;
    }
    await audit(access, 'update', 'fee_payments', payment.id, { shared_with: studentId, share, from_total: total });
    return { ok: true };
});
