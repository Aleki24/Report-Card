import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { MPESA_RECEIPT_UNIQUE_INDEX, isUniqueViolation } from '@/lib/api-errors';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { embedOne } from '@/lib/postgrest';
import { statementPaidAt, statementPeriod } from '@/lib/fee-statement';
import { assertAllocations, feeRecordsForPayment, insertAllocatedPayment, recordedCodes } from '@/lib/fee-reconcile-server';
import { commitBodySchema, type CommitResult, type ReconcileSummary } from '@/lib/fee-reconcile';

const SUMMARY_SELECT = 'id, source, file_name, period_from, period_to, lines, statement_total, recorded_total, already_total, unmatched_total, skipped_total, created_at, users:created_by ( first_name, last_name )';
type One<T> = T | T[] | null;
type SummaryRow = Omit<ReconcileSummary, 'created_by_name'> & { users: One<{ first_name: string | null; last_name: string | null }> };

const toSummary = ({ users, ...row }: SummaryRow): ReconcileSummary => {
    const user = embedOne(users);
    return {
        ...row,
        statement_total: Number(row.statement_total), recorded_total: Number(row.recorded_total), already_total: Number(row.already_total),
        unmatched_total: Number(row.unmatched_total), skipped_total: Number(row.skipped_total),
        created_by_name: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || null : null,
    };
};
const money = (n: number) => Math.round(n * 100) / 100;

/** GET — the school's last statement reconciliations, newest first. */
export const GET = route('fees reconcile list', { module: 'fees', permission: 'fees.view' }, async ({ access }): Promise<ReconcileSummary[]> => {
    const { data, error } = await createSupabaseAdmin()
        .from('fee_reconciliations').select(SUMMARY_SELECT).eq('school_id', access.schoolId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
});

/**
 * POST — applies a reviewed statement: each line is recorded against its
 * learners (shared between siblings when split), left in the unmatched queue,
 * or set aside as not school fees. Lines whose code is in Skulbase by now are
 * left alone, so uploading the same statement twice records nothing twice.
 */
export const POST = route('fees reconcile commit', { module: 'fees', permission: 'fees.collect' }, async ({ access, request }): Promise<CommitResult> => {
    const body = await parseBody(request, commitBodySchema);
    const db = createSupabaseAdmin();
    const method = body.source === 'MPESA' ? 'MPESA' : 'BANK';
    const codes = body.lines.map(l => (l.code ?? '').toUpperCase()).filter(Boolean);
    if (new Set(codes).size !== codes.length) throw new HttpError(400, 'The statement lists the same transaction code twice. Check the file and upload it again.');
    for (const line of body.lines) if (line.action === 'RECORD') assertAllocations(line.allocations, line.amount);

    const [recorded, feeIds] = await Promise.all([
        recordedCodes(db, access.schoolId, codes),
        feeRecordsForPayment(db, access.schoolId, body.lines.flatMap(l => (l.action === 'RECORD' ? l.allocations.map(a => a.studentId) : []))),
    ]);
    // Every learner named must be this school's (feeRecordsForPayment reads only this school's records).
    const period = statementPeriod(body.lines);
    const { data: rec, error: recError } = await db.from('fee_reconciliations').insert({
        school_id: access.schoolId, source: body.source, file_name: body.fileName, period_from: period.from, period_to: period.to,
        lines: body.lines.length, statement_total: money(body.lines.reduce((n, l) => n + l.amount, 0)), created_by: access.userId,
    }).select('id').single();
    if (recError) throw recError;

    const totals = { recorded: 0, already: 0, unmatched: 0, skipped: 0 };
    let notBilled = 0;
    let alreadyRecorded = 0;
    for (const line of body.lines) {
        const code = line.code ? line.code.toUpperCase() : null;
        if (code && recorded.has(code)) { totals.already += line.amount; alreadyRecorded++; continue; }
        if (line.action === 'SKIP') { totals.skipped += line.amount; continue; }
        const facts = {
            method, code, paidAt: statementPaidAt(line), payerName: line.payerName, phone: line.phone, reconciliationId: rec.id as string,
        } as const;
        const shares = line.action === 'RECORD' ? line.allocations.map(a => ({ feeId: feeIds.get(a.studentId), amount: a.amount })) : [];
        try {
            if (line.action === 'RECORD' && shares.every(s => s.feeId)) {
                await insertAllocatedPayment(db, access, { ...facts, notes: `From the ${body.source === 'MPESA' ? 'M-Pesa' : 'bank'} statement` }, shares as { feeId: string; amount: number }[]);
                totals.recorded += line.amount;
                continue;
            }
        } catch (err) {
            // M-Pesa itself (or another upload) recorded this code a moment ago.
            if (isUniqueViolation(err as { code?: string; message: string }, MPESA_RECEIPT_UNIQUE_INDEX)) { totals.already += line.amount; alreadyRecorded++; continue; }
            throw err;
        }
        if (line.action === 'RECORD') notBilled++;
        // Left to chase: in the unmatched queue with what the payer typed.
        const { error } = await db.from('fee_payments').insert({
            school_id: access.schoolId, amount: money(line.amount), method, status: 'COMPLETED',
            mpesa_receipt_number: method === 'MPESA' ? code : null, reference: method === 'MPESA' ? null : code,
            phone_number: line.phone, payer_name: line.payerName, paid_at: facts.paidAt, recorded_by: access.userId,
            unmatched_account_reference: line.accountRef || '(none)', reconciliation_id: rec.id,
            notes: line.action === 'RECORD' ? 'The learner has no fee record yet: bill them, then assign this payment' : `From the ${body.source === 'MPESA' ? 'M-Pesa' : 'bank'} statement, not yet matched`,
        });
        if (error && isUniqueViolation(error, MPESA_RECEIPT_UNIQUE_INDEX)) { totals.already += line.amount; alreadyRecorded++; continue; }
        if (error) throw error;
        totals.unmatched += line.amount;
    }

    const { data: saved, error: saveError } = await db.from('fee_reconciliations').update({
        recorded_total: money(totals.recorded), already_total: money(totals.already), unmatched_total: money(totals.unmatched), skipped_total: money(totals.skipped),
    }).eq('id', rec.id).select(SUMMARY_SELECT).single();
    if (saveError) throw saveError;
    await audit(access, 'create', 'fee_reconciliations', rec.id as string, { source: body.source, lines: body.lines.length, ...totals });
    return { summary: toSummary(saved as unknown as SummaryRow), notBilled, alreadyRecorded };
});
