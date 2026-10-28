import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canViewStudentFees, getActiveUserProfile } from '@/lib/auth-server';
import { getAccess } from '@/lib/platform/access';

/** Polled by the client after initiating an STK Push, until it resolves. */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const userProfile = await getActiveUserProfile(userId);
        if (!userProfile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const checkoutRequestId = searchParams.get('checkout_request_id');
        const paymentId = searchParams.get('payment_id');
        if (!checkoutRequestId && !paymentId) {
            return NextResponse.json({ error: 'checkout_request_id or payment_id is required' }, { status: 400 });
        }

        let query = supabase
            .from('fee_payments')
            .select('id, status, amount, mpesa_receipt_number, notes, school_id, student_fee_id, student_fees(student_id)');
        query = checkoutRequestId ? query.eq('mpesa_checkout_request_id', checkoutRequestId) : query.eq('id', paymentId as string);

        const { data: payment } = await query.maybeSingle();
        if (!payment || payment.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Only someone who may see the learner's fees can follow the payment.
        const access = await getAccess();
        const studentId = (payment.student_fees as { student_id?: string } | { student_id?: string }[] | null);
        const owner = Array.isArray(studentId) ? studentId[0]?.student_id : studentId?.student_id;
        if (!access || !owner || !(await canViewStudentFees(access, owner))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            data: {
                // The ledger row, so the payer can open its receipt once it completes.
                id: payment.id,
                status: payment.status,
                amount: Number(payment.amount),
                mpesaReceiptNumber: payment.mpesa_receipt_number,
                notes: payment.notes,
            },
        });
    } catch (err: unknown) {
        return internalError('mpesa stkpush status', err);
    }
}
