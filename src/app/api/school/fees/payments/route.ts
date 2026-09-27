import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';
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
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();
        const schoolId = caller.schoolId;

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
