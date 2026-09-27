import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';

/** Assigns an unmatched (typically M-Pesa Paybill) payment to the correct student's fee record. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
    try {
        const caller = await accessOrResponse('fees.collect');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();

        const { paymentId } = await params;
        const body = await request.json();
        const { student_fee_id } = body;
        if (!student_fee_id) {
            return NextResponse.json({ error: 'student_fee_id is required' }, { status: 400 });
        }

        const [{ data: payment }, { data: targetFee }] = await Promise.all([
            supabase.from('fee_payments').select('id, school_id, student_fee_id').eq('id', paymentId).maybeSingle(),
            supabase.from('student_fees').select('id, school_id').eq('id', student_fee_id).maybeSingle(),
        ]);

        if (!payment || payment.school_id !== caller.schoolId) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }
        if (payment.student_fee_id) {
            return NextResponse.json({ error: 'Payment is already assigned' }, { status: 400 });
        }
        if (!targetFee || targetFee.school_id !== caller.schoolId) {
            return NextResponse.json({ error: 'Fee record not found in your school' }, { status: 404 });
        }

        // Conditional on the payment still being unassigned: two staff
        // assigning the same payment at once both passed the check above, and
        // the second silently moved the money onto a different learner.
        const { data: assigned, error } = await supabase
            .from('fee_payments')
            .update({ student_fee_id, updated_at: new Date().toISOString() })
            .eq('id', paymentId)
            .is('student_fee_id', null)
            .select('id');

        if (error) throw error;
        if (!assigned || assigned.length === 0) {
            return NextResponse.json({ error: 'Payment is already assigned' }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('unmatched assign', err);
    }
}
