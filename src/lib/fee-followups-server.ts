/**
 * Follow-ups on arrears, server side: a learner's notes and promises, each
 * promise judged against the payments that came in, and the one-line
 * summary per learner the Who owes list shows. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/postgrest';
import { schoolDayOf, schoolDayRange, schoolToday } from '@/lib/dates';
import { recorderNames } from '@/lib/fees-payment-log';
import { promiseState, type FeeFollowUp, type FollowUpKind, type FollowUpSummary, type PromiseProgress } from '@/lib/fee-followups';

const CHUNK = 150;

interface FollowUpRow {
    id: string;
    student_id: string;
    kind: FollowUpKind;
    amount: number | string | null;
    due_date: string | null;
    note: string;
    created_by: string | null;
    created_at: string;
}

interface DayPayment { day: string; amount: number }

const round = (n: number) => Math.round(n * 100) / 100;
const chunks = <T,>(items: readonly T[]): T[][] => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, i * CHUNK + CHUNK));

/** Each learner's completed payments since a day, as (Nairobi day, amount). */
async function paymentsByLearner(db: SupabaseClient, schoolId: string, studentIds: readonly string[], sinceDay: string): Promise<Map<string, DayPayment[]>> {
    const owner = new Map<string, string>();
    for (const ids of chunks([...new Set(studentIds)])) {
        const { data, error } = await db.from('student_fees').select('id, student_id').eq('school_id', schoolId).in('student_id', ids);
        if (error) throw error;
        for (const f of data ?? []) owner.set(f.id as string, f.student_id as string);
    }
    const out = new Map<string, DayPayment[]>();
    const since = schoolDayRange(sinceDay).start;
    for (const feeIds of chunks([...owner.keys()])) {
        const { rows, error } = await fetchAllRows<{ student_fee_id: string; amount: number | string; paid_at: string }>(() => db
            .from('fee_payments')
            .select('student_fee_id, amount, paid_at')
            .eq('school_id', schoolId)
            .eq('status', 'COMPLETED')
            .in('student_fee_id', feeIds)
            .gte('paid_at', since)
            .order('id'));
        if (error) throw error;
        for (const p of rows) {
            const learner = owner.get(p.student_fee_id);
            if (!learner) continue;
            out.set(learner, [...(out.get(learner) ?? []), { day: schoolDayOf(p.paid_at), amount: Number(p.amount) }]);
        }
    }
    return out;
}

/** How a promise went: what was paid from the day it was made to its due date. */
function progressOf(row: FollowUpRow, payments: readonly DayPayment[], today: string): PromiseProgress | null {
    if (row.kind !== 'PROMISE' || row.amount === null || !row.due_date) return null;
    const from = schoolDayOf(row.created_at);
    const due = row.due_date;
    const paidByDue = round(payments.filter(p => p.day >= from && p.day <= due).reduce((n, p) => n + p.amount, 0));
    const amount = Number(row.amount);
    return { amount, dueDate: due, state: promiseState(amount, due, paidByDue, today), paidByDue };
}

const earliestDay = (rows: readonly FollowUpRow[]) => rows.reduce((min, r) => (schoolDayOf(r.created_at) < min ? schoolDayOf(r.created_at) : min), schoolToday());

/** A learner's follow-ups, newest first, each promise with how it went. */
export async function loadFollowUps(db: SupabaseClient, schoolId: string, studentId: string): Promise<FeeFollowUp[]> {
    const { rows, error } = await fetchAllRows<FollowUpRow>(() => db
        .from('fee_followups')
        .select('id, student_id, kind, amount, due_date, note, created_by, created_at')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }));
    if (error) throw error;
    const promises = rows.filter(r => r.kind === 'PROMISE');
    const [payments, names] = await Promise.all([
        promises.length > 0 ? paymentsByLearner(db, schoolId, [studentId], earliestDay(promises)) : Promise.resolve(new Map<string, DayPayment[]>()),
        recorderNames(db, rows.map(r => ({ recordedBy: r.created_by }))),
    ]);
    const today = schoolToday();
    const mine = payments.get(studentId) ?? [];
    return rows.map(r => ({
        id: r.id,
        studentId: r.student_id,
        kind: r.kind,
        note: r.note,
        createdAt: r.created_at,
        createdByName: r.created_by ? names[r.created_by] || null : null,
        promise: progressOf(r, mine, today),
    }));
}

/** Per learner: when the family was last contacted, and how their latest promise is going. */
export async function followUpSummaries(db: SupabaseClient, schoolId: string, studentIds: readonly string[]): Promise<Map<string, FollowUpSummary>> {
    const rows: FollowUpRow[] = [];
    for (const ids of chunks([...new Set(studentIds)])) {
        const { rows: part, error } = await fetchAllRows<FollowUpRow>(() => db
            .from('fee_followups')
            .select('id, student_id, kind, amount, due_date, note, created_by, created_at')
            .eq('school_id', schoolId)
            .in('student_id', ids)
            .order('created_at', { ascending: false })
            .order('id'));
        if (error) throw error;
        rows.push(...part);
    }
    if (rows.length === 0) return new Map();

    // Newest first: the first row per learner is the last contact, the first promise the latest one.
    const latest = new Map<string, { lastContactAt: string; promise: FollowUpRow | null }>();
    for (const r of rows) {
        const held = latest.get(r.student_id);
        if (!held) latest.set(r.student_id, { lastContactAt: r.created_at, promise: r.kind === 'PROMISE' ? r : null });
        else if (!held.promise && r.kind === 'PROMISE') held.promise = r;
    }
    const promised = [...latest.values()].map(v => v.promise).filter((p): p is FollowUpRow => !!p);
    const payments = promised.length > 0 ? await paymentsByLearner(db, schoolId, promised.map(p => p.student_id), earliestDay(promised)) : new Map<string, DayPayment[]>();
    const today = schoolToday();
    return new Map([...latest].map(([studentId, v]) => [studentId, {
        lastContactAt: v.lastContactAt,
        promise: v.promise ? progressOf(v.promise, payments.get(studentId) ?? [], today) : null,
    }]));
}
