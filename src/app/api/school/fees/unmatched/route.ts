import { NextResponse } from 'next/server';
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
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER'].includes(userProfile.role)) {
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
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
