import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { parseBody, route } from '@/lib/platform/access';
import { fetchAllRows, embedOne } from '@/lib/postgrest';
import { buildLearnerIndex, matchPayment } from '@/lib/fee-matching';
import { statementPeriod } from '@/lib/fee-statement';
import { loadMatchLearners, recordedCodes } from '@/lib/fee-reconcile-server';
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

    const [learners, recorded, balances, ledger] = await Promise.all([
        loadMatchLearners(db, access.schoolId),
        recordedCodes(db, access.schoolId, codes),
        fetchAllRows<{ student_id: string; total_fee: number; paid_amount: number }>(() => db
            .from('student_fees').select('student_id, total_fee, paid_amount').eq('school_id', access.schoolId).order('id')),
        period.from && period.to
            ? fetchAllRows<LedgerRow>(() => {
                let q = db.from('fee_payments')
                    .select('id, receipt_number, mpesa_receipt_number, reference, amount, paid_at, student_fees ( students ( users ( first_name, last_name ) ) )')
                    .eq('school_id', access.schoolId)
                    .eq('status', 'COMPLETED')
                    .is('split_from_payment_id', null)
                    .gte('paid_at', `${period.from}T00:00:00+03:00`)
                    .lte('paid_at', `${period.to}T23:59:59+03:00`);
                q = body.source === 'MPESA' ? q.eq('method', 'MPESA') : q.in('method', ['BANK', 'CHEQUE']);
                return q.order('id');
            })
            : Promise.resolve({ rows: [], error: null, truncated: false }),
    ]);
    if (balances.error) throw balances.error;
    if (ledger.error) throw ledger.error;

    const index = buildLearnerIndex(learners);
    const lines: PreviewLine[] = body.rows.map(row => {
        const done = row.code ? recorded.get(row.code.toUpperCase()) : undefined;
        if (done) return { ...row, status: 'RECORDED', candidates: [], recorded: done };
        const match = matchPayment({ accountRef: row.accountRef, phone: row.phone, payerName: row.payerName, details: row.details }, index);
        return { ...row, status: match.kind, candidates: match.candidates };
    });

    const owed = new Map<string, number>();
    for (const f of balances.rows) owed.set(f.student_id, (owed.get(f.student_id) ?? 0) + Number(f.total_fee) - Number(f.paid_amount));

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
        learners: learners
            .map(l => ({ id: l.id, name: l.name, admissionNumber: l.admissionNumber, className: l.className, balance: Math.round((owed.get(l.id) ?? 0) * 100) / 100 }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ledgerOnly,
        period,
    };
});
