import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { parseBody, route } from '@/lib/platform/access';
import { fetchAllRows, embedOne } from '@/lib/postgrest';
import { buildLearnerIndex, matchPayment } from '@/lib/fee-matching';
import { statementPeriod } from '@/lib/fee-statement';
import { schoolDayRange } from '@/lib/dates';
import { loadLearnerDirectory, recordedCodes } from '@/lib/fee-reconcile-server';
import { previewBodySchema, type LedgerOnlyPayment, type PreviewLine, type ReconcilePreview } from '@/lib/fee-reconcile';

/** An embedded row, as PostgREST may give it: one, a list of one, or none. */
type One<T> = T | T[] | null;
interface LedgerRow {
    id: string;
    receipt_number: string;
    mpesa_receipt_number: string | null;
    reference: string | null;
    amount: number;
    paid_at: string;
    student_fees: One<{ students: One<{ users: One<{ first_name: string | null; last_name: string | null }> }> }>;
}

/**
 * POST — matches a statement (read in the browser) against the school: each
 * payment in is already in Skulbase (by its code), matched to one learner by
 * admission number, suggested (phone, name, a loose account number), or
 * unmatched. Also lists Skulbase payments of the period the statement does
 * not show. Writes nothing.
 */
export const POST = route('fees reconcile preview', { module: 'fees', permission: 'fees.collect' }, async ({ access, request }): Promise<ReconcilePreview> => {
    const body = await parseBody(request, previewBodySchema);
    const db = createSupabaseAdmin();
    const codes = body.rows.map(r => (r.code ?? '').toUpperCase()).filter(Boolean);
    const period = statementPeriod(body.rows);
    // The ledger's payments over the statement's days, to find any the statement lacks.
    const window = period.from && period.to ? schoolDayRange(period.from, period.to) : null;

    const [{ learners, directory }, recorded, ledger] = await Promise.all([
        loadLearnerDirectory(db, access.schoolId),
        recordedCodes(db, access.schoolId, codes),
        window
            ? fetchAllRows<LedgerRow>(() => {
                let q = db.from('fee_payments')
                    .select('id, receipt_number, mpesa_receipt_number, reference, amount, paid_at, student_fees ( students ( users ( first_name, last_name ) ) )')
                    .eq('school_id', access.schoolId)
                    .eq('status', 'COMPLETED')
                    .is('split_from_payment_id', null)
                    .gte('paid_at', window.start)
                    .lt('paid_at', window.end);
                q = body.source === 'MPESA' ? q.eq('method', 'MPESA') : q.in('method', ['BANK', 'CHEQUE']);
                return q.order('id');
            })
            : Promise.resolve({ rows: [], error: null, truncated: false }),
    ]);
    if (ledger.error) throw ledger.error;

    const index = buildLearnerIndex(learners);
    const lines: PreviewLine[] = body.rows.map(row => {
        const done = row.code ? recorded.get(row.code.toUpperCase()) : undefined;
        if (done) return { ...row, status: 'RECORDED', candidates: [], recorded: done };
        const match = matchPayment({ accountRef: row.accountRef, phone: row.phone, payerName: row.payerName, details: row.details }, index);
        return { ...row, status: match.kind, candidates: match.candidates };
    });

    const onStatement = new Set(codes);
    const ledgerOnly: LedgerOnlyPayment[] = ledger.rows
        .filter(p => !onStatement.has(((body.source === 'MPESA' ? p.mpesa_receipt_number : p.reference) ?? '').toUpperCase()))
        .slice(0, 200)
        .map(p => {
            const user = embedOne(embedOne(embedOne(p.student_fees)?.students)?.users);
            return {
                id: p.id,
                receiptNumber: p.receipt_number,
                code: (body.source === 'MPESA' ? p.mpesa_receipt_number : p.reference) ?? null,
                amount: Number(p.amount),
                paidAt: p.paid_at,
                learner: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : null,
            };
        });

    return {
        source: body.source,
        lines,
        learners: directory,
        ledgerOnly,
        period,
    };
});
