import { NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';
import { mapFeePaymentRow } from '@/lib/fees';

/** Payments (usually M-Pesa Paybill) that couldn't be auto-matched to a student's current-term fee record. */
export async function GET() {
    try {
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();

        const { data, error } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('school_id', caller.schoolId)
            .is('student_fee_id', null)
            .not('unmatched_account_reference', 'is', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: (data ?? []).map(mapFeePaymentRow) });
    } catch (err: unknown) {
        return internalError('unmatched payments', err);
    }
}
