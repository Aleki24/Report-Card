import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Polled by the client after initiating an STK Push, until it resolves. */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile || userProfile.is_active === false) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        if (userProfile.role === 'STUDENT' && (payment.student_fees as any)?.student_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            data: {
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
