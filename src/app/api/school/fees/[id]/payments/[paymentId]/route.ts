import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Void a payment. Financial ledger entries are never hard-deleted — voiding
 * flips status to CANCELLED (excluded from the paid_amount rollup by the DB
 * trigger) so the receipt number and history stay auditable.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only an admin can void a payment' }, { status: 403 });
        }

        const { id, paymentId } = await params;

        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, school_id, student_fee_id, status')
            .eq('id', paymentId)
            .maybeSingle();

        if (!payment || payment.school_id !== userProfile.school_id || payment.student_fee_id !== id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (payment.status === 'CANCELLED') {
            return NextResponse.json({ error: 'Payment already voided' }, { status: 400 });
        }

        let reason: string | null = null;
        try {
            const body = await request.json();
            reason = body?.reason || null;
        } catch {
            // no body provided — voiding without a reason is fine
        }

        const { error } = await supabase
            .from('fee_payments')
            .update({
                status: 'CANCELLED',
                notes: reason ? `Voided: ${reason}` : 'Voided',
                updated_at: new Date().toISOString(),
            })
            .eq('id', paymentId);

        if (error) throw error;

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
