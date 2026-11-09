import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Void a payment. Financial ledger entries are never hard-deleted — voiding
 * flips status to CANCELLED (excluded from the paid_amount rollup by the DB
 * trigger) so the receipt number and history stay auditable. A payment shared
 * between learners is voided whole, its shares with it; voiding just one
 * share gives its money back to the payment it was cut from.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
    try {
        const caller = await accessOrResponse('fees.manage');
        if (caller instanceof NextResponse) return caller;
        const supabase = createSupabaseAdmin();

        const { id, paymentId } = await params;

        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, school_id, student_fee_id, status, amount, split_from_payment_id')
            .eq('id', paymentId)
            .maybeSingle();

        if (!payment || payment.school_id !== caller.schoolId || payment.student_fee_id !== id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (payment.status === 'CANCELLED') {
            return NextResponse.json({ error: 'Payment already voided' }, { status: 400 });
        }

        // A void needs a reason, kept with who voided it and when: the audit
        // trail a second person checks (an M-Pesa reversal, a double entry).
        let reason = '';
        try {
            const body = await request.json();
            reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        } catch {
            // no body provided
        }
        if (reason.length < 3) {
            return NextResponse.json({ error: 'Say why the payment is being voided.' }, { status: 400 });
        }

        const voided = { status: 'CANCELLED', voided_by: caller.userId, voided_at: new Date().toISOString(), notes: `Voided: ${reason.slice(0, 300)}`, updated_at: new Date().toISOString() };
        const { data: done, error } = await supabase.from('fee_payments').update(voided).eq('id', paymentId).neq('status', 'CANCELLED').select('id');
        if (error) throw error;
        if (!done || done.length === 0) return NextResponse.json({ error: 'Payment already voided' }, { status: 409 });
        let returnedTo: string | null = null;
        if (payment.split_from_payment_id) {
            // One learner's share: the money goes back to the payment it was cut from, if that still stands.
            const { data: original, error: originalError } = await supabase
                .from('fee_payments').select('id, amount, status').eq('id', payment.split_from_payment_id).maybeSingle();
            if (originalError) throw originalError;
            if (original?.status === 'COMPLETED') {
                const { error: backError } = await supabase.from('fee_payments')
                    .update({ amount: money(Number(original.amount) + Number(payment.amount)), updated_at: new Date().toISOString() })
                    .eq('id', original.id);
                if (backError) throw backError;
                returnedTo = original.id as string;
            }
        } else {
            // A payment shared between learners is voided whole: every share with it.
            const { error: sharesError } = await supabase.from('fee_payments').update(voided).eq('split_from_payment_id', paymentId).neq('status', 'CANCELLED');
            if (sharesError) throw sharesError;
        }
        await audit(caller, 'update', 'fee_payments', paymentId, { voided: true, reason, ...(returnedTo ? { returned_to: returnedTo } : {}) });

        const { data: updatedFee } = await supabase
            .from('student_fees')
            .select('id, total_fee, paid_amount, status')
            .eq('id', id)
            .single();

        return NextResponse.json({ success: true, fee: updatedFee });
    } catch (err: unknown) {
        return internalError('fee payment void', err);
    }
}
