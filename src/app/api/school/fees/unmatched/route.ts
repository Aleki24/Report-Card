import { NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { mapFeePaymentRow } from '@/lib/fees';

/** Payments (usually M-Pesa Paybill) that couldn't be auto-matched to a student's current-term fee record. */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        // Unmatched Paybill money is school-level ledger work, handled from
        // Settings > Payments, which only admins can open.
        if (!userProfile || userProfile.role !== 'ADMIN' || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('school_id', userProfile.school_id)
            .is('student_fee_id', null)
            .not('unmatched_account_reference', 'is', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: (data ?? []).map(mapFeePaymentRow) });
    } catch (err: unknown) {
        return internalError('unmatched payments', err);
    }
}
