import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, accessOrResponse, errorResponse } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { allocationSchema } from '@/lib/fee-reconcile';
import { assertAllocations, feeRecordsForPayment } from '@/lib/fee-reconcile-server';

const bodySchema = z.union([
    // Older clients: one learner's fee record.
    z.object({ student_fee_id: z.string().uuid() }),
    // One learner or several (siblings sharing one payment), by learner: the money lands on each one's fee record.
    z.object({ allocations: z.array(allocationSchema).min(1).max(8) }),
]);

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Assigns an unmatched (typically M-Pesa Paybill) payment to a learner, or
 * shares it between several: the payment keeps its code and the first
 * learner's share, and each other share becomes its own receipt pointing
 * back to it. Each learner's share lands on this term's fee record, else
 * their latest one.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
    try {
        const caller = await accessOrResponse('fees.collect');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();
        const { paymentId } = await params;
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Choose who the payment is for.' }, { status: 400 });

        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, school_id, student_fee_id, amount, method, status, mpesa_receipt_number, reference, payer_name, phone_number, paid_at, receipt_number')
            .eq('id', paymentId)
            .maybeSingle();
        if (!payment || payment.school_id !== caller.schoolId) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        if (payment.student_fee_id) return NextResponse.json({ error: 'Payment is already assigned' }, { status: 400 });
        if (payment.status !== 'COMPLETED') return NextResponse.json({ error: 'This payment was set aside and cannot be assigned.' }, { status: 400 });

        // Each share as a fee record of this school.
        let shares: { feeId: string; amount: number }[];
        if ('student_fee_id' in parsed.data) {
            const { data: fee } = await supabase.from('student_fees').select('id, school_id').eq('id', parsed.data.student_fee_id).maybeSingle();
            if (!fee || fee.school_id !== caller.schoolId) return NextResponse.json({ error: 'Fee record not found in your school' }, { status: 404 });
            shares = [{ feeId: fee.id as string, amount: Number(payment.amount) }];
        } else {
            const { allocations } = parsed.data;
            assertAllocations(allocations, Number(payment.amount));
            const feeIds = await feeRecordsForPayment(supabase, caller.schoolId, allocations.map(a => a.studentId));
            const unbilled = allocations.filter(a => !feeIds.has(a.studentId));
            if (unbilled.length > 0) throw new HttpError(400, 'A learner in this payment has no fee record yet. Bill them first (Billing → Invoicing), then assign it.');
            shares = allocations.map(a => ({ feeId: feeIds.get(a.studentId)!, amount: a.amount }));
        }

        // Conditional on the payment still being unassigned: two staff
        // assigning the same payment at once both passed the check above, and
        // the second silently moved the money onto a different learner.
        const [first, ...rest] = shares;
        const { data: assigned, error } = await supabase
            .from('fee_payments')
            .update({ student_fee_id: first.feeId, amount: money(first.amount), updated_at: new Date().toISOString() })
            .eq('id', paymentId)
            .is('student_fee_id', null)
            .select('id');
        if (error) throw error;
        if (!assigned || assigned.length === 0) return NextResponse.json({ error: 'Payment is already assigned' }, { status: 409 });

        if (rest.length > 0) {
            const code = (payment.mpesa_receipt_number ?? payment.reference ?? payment.receipt_number) as string;
            const { error: shareError } = await supabase.from('fee_payments').insert(rest.map(s => ({
                school_id: caller.schoolId,
                student_fee_id: s.feeId,
                amount: money(s.amount),
                method: payment.method,
                status: 'COMPLETED',
                reference: payment.mpesa_receipt_number ?? payment.reference,
                payer_name: payment.payer_name,
                phone_number: payment.phone_number,
                paid_at: payment.paid_at,
                recorded_by: caller.userId,
                split_from_payment_id: paymentId,
                notes: `Share of ${code}`,
            })));
            if (shareError) {
                // Put the payment back as it was rather than leave it half-shared.
                await supabase.from('fee_payments').update({ student_fee_id: null, amount: payment.amount }).eq('id', paymentId);
                throw shareError;
            }
        }

        await audit(caller, 'update', 'fee_payments', paymentId, { assigned: shares.length, amount: Number(payment.amount) });
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        if (err instanceof HttpError) return errorResponse('unmatched assign', err);
        return internalError('unmatched assign', err);
    }
}
