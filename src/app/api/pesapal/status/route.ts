import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Polled by the client after redirecting to Pesapal checkout, until the IPN resolves it. */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const orderTrackingId = searchParams.get('order_tracking_id');
        const paymentId = searchParams.get('payment_id');
        if (!orderTrackingId && !paymentId) {
            return NextResponse.json({ error: 'order_tracking_id or payment_id is required' }, { status: 400 });
        }

        let query = supabase
            .from('fee_payments')
            .select('id, status, amount, pesapal_confirmation_code, pesapal_payment_method, notes, school_id, student_fee_id, student_fees(student_id)');
        query = orderTrackingId ? query.eq('pesapal_order_tracking_id', orderTrackingId) : query.eq('id', paymentId as string);

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
                confirmationCode: payment.pesapal_confirmation_code,
                paymentMethod: payment.pesapal_payment_method,
                notes: payment.notes,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
