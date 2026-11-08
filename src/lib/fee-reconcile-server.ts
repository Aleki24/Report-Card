/**
 * Server side of matching payments to learners: who the school's learners
 * are (with their guardians' phones and names), which fee record a payment
 * lands on, what a statement's codes already are in the ledger, and how a
 * payment shared between learners is recorded. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { findActiveTermId } from '@/lib/term-calendar';
import { HttpError } from '@/lib/platform/access';
import type { MatchLearner } from '@/lib/fee-matching';
import type { Allocation } from '@/lib/fee-reconcile';

const ID_CHUNK = 150;

interface Person { first_name: string | null; last_name: string | null; phone?: string | null }
interface LearnerRow {
    id: string;
    admission_number: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    users: Person | Person[] | null;
    grade_streams: { full_name: string | null } | { full_name: string | null }[] | null;
}
interface GuardianRow { student_id: string; parent: Person | Person[] | null }

const fullName = (p: Person | null): string => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();

/** Every learner of the school as the matcher needs them, leavers included (they can still owe). */
export async function loadMatchLearners(db: SupabaseClient, schoolId: string): Promise<MatchLearner[]> {
    const [learners, guardians] = await Promise.all([
        fetchAllRows<LearnerRow>(() => db
            .from('students')
            .select('id, admission_number, guardian_name, guardian_phone, users ( first_name, last_name ), grade_streams ( full_name )')
            .eq('school_id', schoolId)
            .order('id')),
        fetchAllRows<GuardianRow>(() => db
            .from('student_guardians')
            .select('student_id, parent:users!student_guardians_parent_user_id_fkey ( first_name, last_name, phone )')
            .eq('school_id', schoolId)
            .order('id')),
    ]);
    if (learners.error) throw learners.error;
    if (guardians.error) throw guardians.error;

    const linked = new Map<string, Person[]>();
    for (const g of guardians.rows) {
        const parent = embedOne(g.parent);
        if (parent) linked.set(g.student_id, [...(linked.get(g.student_id) ?? []), parent]);
    }
    return learners.rows.map(l => {
        const parents = linked.get(l.id) ?? [];
        return {
            id: l.id,
            name: fullName(embedOne(l.users)) || 'Unnamed learner',
            admissionNumber: l.admission_number,
            className: embedOne(l.grade_streams)?.full_name ?? null,
            phones: [l.guardian_phone, ...parents.map(p => p.phone ?? null)].filter((p): p is string => !!p),
            guardianNames: [l.guardian_name, ...parents.map(fullName)].filter((n): n is string => !!n),
        };
    });
}

/**
 * The fee record each learner's payment lands on: this term's, else their
 * latest (arrears from an earlier term). Learners with no fee record at all
 * are left out: their money waits as unmatched until they are billed.
 */
export async function feeRecordsForPayment(db: SupabaseClient, schoolId: string, studentIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(studentIds)];
    if (ids.length === 0) return new Map();
    const { data: terms, error: termsError } = await db.from('terms').select('id, name, start_date, end_date, is_current').eq('school_id', schoolId);
    if (termsError) throw termsError;
    const currentTermId = terms && terms.length > 0 ? findActiveTermId(terms) : null;
    const startOf = new Map((terms ?? []).map(t => [t.id as string, (t.start_date as string | null) ?? '']));

    const records: { id: string; student_id: string; term_id: string }[] = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
        const { data, error } = await db.from('student_fees').select('id, student_id, term_id').eq('school_id', schoolId).in('student_id', ids.slice(i, i + ID_CHUNK));
        if (error) throw error;
        records.push(...((data ?? []) as typeof records));
    }
    const best = new Map<string, { id: string; current: boolean; start: string }>();
    for (const r of records) {
        const candidate = { id: r.id, current: r.term_id === currentTermId, start: startOf.get(r.term_id) ?? '' };
        const held = best.get(r.student_id);
        if (!held || (candidate.current && !held.current) || (candidate.current === held.current && candidate.start > held.start)) best.set(r.student_id, candidate);
    }
    return new Map([...best].map(([studentId, r]) => [studentId, r.id]));
}

export interface RecordedCode {
    /** The whole payment, its shares included. */
    amount: number;
    receiptNumber: string;
    unmatched: boolean;
}

/** Which statement codes the ledger already holds (M-Pesa codes or bank references), and for how much. */
export async function recordedCodes(db: SupabaseClient, schoolId: string, codes: readonly string[]): Promise<Map<string, RecordedCode>> {
    const wanted = [...new Set(codes.filter(Boolean))];
    const found = new Map<string, RecordedCode>();
    if (wanted.length === 0) return found;
    type Row = { id: string; amount: number; receipt_number: string; mpesa_receipt_number: string | null; reference: string | null; student_fee_id: string | null; split_from_payment_id: string | null };
    const rows: Row[] = [];
    for (let i = 0; i < wanted.length; i += ID_CHUNK) {
        const chunk = wanted.slice(i, i + ID_CHUNK);
        const [byMpesa, byRef] = await Promise.all([
            db.from('fee_payments').select('id, amount, receipt_number, mpesa_receipt_number, reference, student_fee_id, split_from_payment_id').eq('school_id', schoolId).neq('status', 'CANCELLED').in('mpesa_receipt_number', chunk),
            db.from('fee_payments').select('id, amount, receipt_number, mpesa_receipt_number, reference, student_fee_id, split_from_payment_id').eq('school_id', schoolId).neq('status', 'CANCELLED').is('split_from_payment_id', null).in('reference', chunk),
        ]);
        if (byMpesa.error) throw byMpesa.error;
        if (byRef.error) throw byRef.error;
        rows.push(...((byMpesa.data ?? []) as Row[]), ...((byRef.data ?? []) as Row[]));
    }
    // A payment shared between learners: its shares count towards the whole.
    const parents = [...new Set(rows.map(r => r.id))];
    const shares = new Map<string, number>();
    for (let i = 0; i < parents.length; i += ID_CHUNK) {
        const { data, error } = await db.from('fee_payments').select('split_from_payment_id, amount').eq('school_id', schoolId).neq('status', 'CANCELLED').in('split_from_payment_id', parents.slice(i, i + ID_CHUNK));
        if (error) throw error;
        for (const s of data ?? []) shares.set(s.split_from_payment_id as string, (shares.get(s.split_from_payment_id as string) ?? 0) + Number(s.amount));
    }
    for (const r of rows) {
        const code = (r.mpesa_receipt_number ?? r.reference ?? '').toUpperCase();
        if (!code || found.has(code)) continue;
        found.set(code, { amount: Number(r.amount) + (shares.get(r.id) ?? 0), receiptNumber: r.receipt_number, unmatched: !r.student_fee_id });
    }
    return found;
}

export interface PaymentFacts {
    method: 'MPESA' | 'BANK' | 'CHEQUE' | 'CASH' | 'OTHER';
    /** The M-Pesa code or bank/cheque reference. */
    code: string | null;
    paidAt: string;
    payerName: string | null;
    phone: string | null;
    notes?: string | null;
    reconciliationId?: string | null;
}

const money = (n: number) => Math.round(n * 100) / 100;

/** Checks a split: every share positive and the shares adding up to the payment. */
export function assertAllocations(allocations: readonly Allocation[], total: number): void {
    if (allocations.length === 0) throw new HttpError(400, 'Choose who the payment is for.');
    if (allocations.some(a => !(a.amount > 0))) throw new HttpError(400, 'Each learner’s share must be more than zero.');
    if (new Set(allocations.map(a => a.studentId)).size !== allocations.length) throw new HttpError(400, 'A learner appears twice in the split.');
    const sum = money(allocations.reduce((n, a) => n + a.amount, 0));
    if (Math.abs(sum - money(total)) > 0.009) throw new HttpError(400, `The shares add up to ${sum.toLocaleString()} but the payment is ${money(total).toLocaleString()}.`);
}

/**
 * Records a payment against one learner, or shares it between several (two
 * siblings in one M-Pesa payment): the first share keeps the code, each
 * other share is its own receipt pointing back to it. Returns the rows made.
 */
export async function insertAllocatedPayment(
    db: SupabaseClient,
    ctx: { schoolId: string; userId: string },
    facts: PaymentFacts,
    allocations: readonly { feeId: string; amount: number }[],
): Promise<{ id: string; receipt_number: string }[]> {
    const base = {
        school_id: ctx.schoolId,
        method: facts.method,
        status: 'COMPLETED',
        payer_name: facts.payerName,
        phone_number: facts.phone,
        paid_at: facts.paidAt,
        recorded_by: ctx.userId,
        notes: facts.notes ?? null,
        reconciliation_id: facts.reconciliationId ?? null,
    };
    const [first, ...rest] = allocations;
    const { data: main, error } = await db.from('fee_payments').insert({
        ...base,
        student_fee_id: first.feeId,
        amount: money(first.amount),
        mpesa_receipt_number: facts.method === 'MPESA' ? facts.code : null,
        reference: facts.method === 'MPESA' ? null : facts.code,
    }).select('id, receipt_number').single();
    if (error) throw error;
    if (rest.length === 0) return [main];
    const { data: shares, error: shareError } = await db.from('fee_payments').insert(rest.map(a => ({
        ...base,
        student_fee_id: a.feeId,
        amount: money(a.amount),
        reference: facts.code,
        split_from_payment_id: main.id,
        notes: `Share of ${facts.code ?? main.receipt_number}${facts.notes ? ` · ${facts.notes}` : ''}`,
    }))).select('id, receipt_number');
    if (shareError) throw shareError;
    return [main, ...(shares ?? [])];
}
