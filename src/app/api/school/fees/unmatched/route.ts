import { NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { accessOrResponse } from '@/lib/platform/access';
import { fetchAllRows } from '@/lib/postgrest';
import { mapFeePaymentRow } from '@/lib/fees';
import { buildLearnerIndex, matchPayment, type MatchCandidate } from '@/lib/fee-matching';
import { loadMatchLearners } from '@/lib/fee-reconcile-server';
import type { DirectoryLearner } from '@/lib/fee-reconcile';

/**
 * Payments (usually M-Pesa Paybill) not yet matched to a learner, each with
 * the learners it most likely belongs to (by a loose account number, the
 * payer's phone against guardians', or the payer's name), and the school's
 * learners to pick from by hand. `data` stays the plain list older app
 * builds read.
 */
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
            .eq('status', 'COMPLETED')
            .not('unmatched_account_reference', 'is', null)
            .order('paid_at', { ascending: false });
        if (error) throw error;
        const payments = (data ?? []).map(mapFeePaymentRow);

        let suggestions: Record<string, MatchCandidate[]> = {};
        let learners: DirectoryLearner[] = [];
        if (payments.length > 0) {
            const [directory, balances] = await Promise.all([
                loadMatchLearners(supabase, caller.schoolId),
                fetchAllRows<{ student_id: string; total_fee: number; paid_amount: number }>(() => supabase
                    .from('student_fees').select('student_id, total_fee, paid_amount').eq('school_id', caller.schoolId).order('id')),
            ]);
            if (balances.error) throw balances.error;
            const index = buildLearnerIndex(directory);
            suggestions = Object.fromEntries(payments.map(p => [p.id, matchPayment({
                accountRef: p.unmatchedAccountReference === '(none provided)' || p.unmatchedAccountReference === '(none)' ? null : p.unmatchedAccountReference,
                phone: p.phoneNumber,
                payerName: p.payerName,
            }, index).candidates]));
            const owed = new Map<string, number>();
            for (const f of balances.rows) owed.set(f.student_id, (owed.get(f.student_id) ?? 0) + Number(f.total_fee) - Number(f.paid_amount));
            learners = directory
                .map(l => ({ id: l.id, name: l.name, admissionNumber: l.admissionNumber, className: l.className, balance: Math.round((owed.get(l.id) ?? 0) * 100) / 100 }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        return NextResponse.json({ data: payments, suggestions, learners });
    } catch (err: unknown) {
        return internalError('unmatched payments', err);
    }
}
