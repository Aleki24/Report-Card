import { NextResponse, type NextRequest } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';
import { mapFeePaymentRow } from '@/lib/fees';
import { buildLearnerIndex, matchPayment, type MatchCandidate } from '@/lib/fee-matching';
import { loadLearnerDirectory } from '@/lib/fee-reconcile-server';
import { typedAccount, type DirectoryLearner, type UnmatchedResponse } from '@/lib/fee-reconcile';

/**
 * Payments (usually M-Pesa Paybill) not yet matched to a learner, each with
 * the learners it most likely belongs to (by a loose account number, the
 * payer's phone against guardians', or the payer's name), and the school's
 * learners to pick from by hand. `data` stays the plain list older app
 * builds read. `?suggest=0` skips the matching, for a count.
 */
export async function GET(request: NextRequest) {
    try {
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();

        const { data, error } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('school_id', caller.schoolId)
            .is('student_fee_id', null)
            .eq('status', 'COMPLETED')
            .not('unmatched_account_reference', 'is', null)
            .order('paid_at', { ascending: false });
        if (error) throw error;
        const payments = (data ?? []).map(mapFeePaymentRow);

        let suggestions: Record<string, MatchCandidate[]> = {};
        let learners: DirectoryLearner[] = [];
        if (payments.length > 0 && new URL(request.url).searchParams.get('suggest') !== '0') {
            const loaded = await loadLearnerDirectory(supabase, caller.schoolId);
            const index = buildLearnerIndex(loaded.learners);
            suggestions = Object.fromEntries(payments.map(p => [p.id, matchPayment({
                accountRef: typedAccount(p.unmatchedAccountReference),
                phone: p.phoneNumber,
                payerName: p.payerName,
            }, index).candidates]));
            learners = loaded.directory;
        }

        return NextResponse.json({ data: payments, suggestions, learners } satisfies UnmatchedResponse);
    } catch (err: unknown) {
        return internalError('unmatched payments', err);
    }
}
