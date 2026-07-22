import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Assigns an unmatched (typically M-Pesa Paybill) payment to the correct student's fee record. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        if (!payment || payment.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }
        if (payment.student_fee_id) {
            return NextResponse.json({ error: 'Payment is already assigned' }, { status: 400 });
        }
        if (!targetFee || targetFee.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Fee record not found in your school' }, { status: 404 });
        }

        const { error } = await supabase
            .from('fee_payments')
            .update({ student_fee_id, updated_at: new Date().toISOString() })
            .eq('id', paymentId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('unmatched assign', err);
    }
}
