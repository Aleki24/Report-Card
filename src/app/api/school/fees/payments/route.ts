import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveUserProfile } from '@/lib/auth-server';
import { loadPaymentLog, parsePaymentLogFilters, recorderNames } from '@/lib/fees-payment-log';

/** Payments the log screen lists at once, newest first. */
const LOG_LIMIT = 500;

/**
 * School-wide payment transactions log — every entry in fee_payments,
 * across every student, for bursars/admins to reconcile in one place
 * instead of drilling into each student's fee record individually.
 */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const userProfile = await getActiveUserProfile(userId);

        // ADMIN (bursar) only: this is the school-wide log with payer phone
        // numbers across every student — class teachers still see per-student
        // history through the fee-record endpoints.
        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ data: [] });

        const { entries, truncated } = await loadPaymentLog(supabase, schoolId, parsePaymentLogFilters(new URL(request.url).searchParams));
        // The screen shows the newest LOG_LIMIT; the export has them all.
        const shown = entries.slice(0, LOG_LIMIT);
        const names = await recorderNames(supabase, shown);
        const data = shown.map(({ recordedBy, ...entry }) => ({
            ...entry,
            recordedByName: recordedBy ? names[recordedBy] || null : null,
        }));

        return NextResponse.json({ data, total: entries.length, truncated: truncated || entries.length > LOG_LIMIT });
    } catch (err: unknown) {
        return internalError('payments log', err);
    }
}
