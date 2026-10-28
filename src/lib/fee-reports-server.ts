import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { methodLabel } from '@/lib/fee-account';
import type { CollectionBucket, CollectionsResponse, Defaulter } from '@/lib/fee-reports';

type One<T> = T | T[] | null;

interface FeeRow {
    id: string;
    student_id: string;
    total_fee: number | string;
    paid_amount: number | string;
    due_date: string | null;
    students: One<{
        admission_number: string | null;
        status: string;
        current_grade_stream_id: string | null;
        guardian_name: string | null;
        guardian_phone: string | null;
        users: One<{ first_name: string | null; last_name: string | null }>;
        grade_streams: One<{ full_name: string }>;
    }>;
}

const CHUNK = 150;

/**
 * Learners who owe across all their terms, most owed first. A learner whose
 * terms net to nothing owing (Term 1 overpaid, Term 2 short by the same) is
 * not a defaulter. Contacts prefer a linked parent over the learner's record.
 */
export async function loadDefaulters(supabase: SupabaseClient, schoolId: string, opts: { gradeStreamId?: string | null; minBalance?: number; includeLeft?: boolean }): Promise<Defaulter[]> {
    const { rows, error } = await fetchAllRows<FeeRow>(() => supabase
        .from('student_fees')
        .select('id, student_id, total_fee, paid_amount, due_date, students!inner ( admission_number, status, current_grade_stream_id, guardian_name, guardian_phone, users ( first_name, last_name ), grade_streams ( full_name ) )')
        .eq('school_id', schoolId)
        .order('id'));
    if (error) throw new Error('Could not load fee records');

    const byLearner = new Map<string, { fees: FeeRow[]; owed: number }>();
    for (const f of rows) {
        const entry = byLearner.get(f.student_id) ?? { fees: [], owed: 0 };
        entry.fees.push(f);
        entry.owed += Number(f.total_fee) - Number(f.paid_amount);
        byLearner.set(f.student_id, entry);
    }
    const min = Math.max(1, opts.minBalance ?? 1);
    const owing = [...byLearner.entries()].filter(([, e]) => {
        if (e.owed < min) return false;
        const s = embedOne(e.fees[0].students);
        if (!s) return false;
        if (!opts.includeLeft && s.status !== 'ACTIVE') return false;
        return !opts.gradeStreamId || s.current_grade_stream_id === opts.gradeStreamId;
    });
    if (owing.length === 0) return [];

    // The last payment and a linked parent for each, a chunk of learners at a time.
    const ids = owing.map(([id]) => id);
    const feeIds = owing.flatMap(([, e]) => e.fees.map(f => f.id));
    const lastPaid = new Map<string, string>();
    const feeOwner = new Map(owing.flatMap(([id, e]) => e.fees.map(f => [f.id, id] as const)));
    for (let i = 0; i < feeIds.length; i += CHUNK) {
        const { data, error: payError } = await supabase.from('fee_payments').select('student_fee_id, paid_at').in('student_fee_id', feeIds.slice(i, i + CHUNK)).eq('status', 'COMPLETED');
        if (payError) throw new Error('Could not load payments');
        for (const p of data ?? []) {
            const owner = feeOwner.get(p.student_fee_id as string);
            if (owner && (p.paid_at as string) > (lastPaid.get(owner) ?? '')) lastPaid.set(owner, p.paid_at as string);
        }
    }
    const parent = new Map<string, { name: string; phone: string | null }>();
    for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error: linkError } = await supabase
            .from('student_guardians')
            .select('student_id, is_primary, parent:users!student_guardians_parent_user_id_fkey ( first_name, last_name, phone )')
            .eq('school_id', schoolId)
            .in('student_id', ids.slice(i, i + CHUNK))
            .order('is_primary', { ascending: false });
        if (linkError) throw new Error('Could not load parents');
        for (const l of data ?? []) {
            if (parent.has(l.student_id as string)) continue;
            const p = embedOne(l.parent as One<{ first_name: string | null; last_name: string | null; phone: string | null }>);
            if (p) parent.set(l.student_id as string, { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Parent', phone: p.phone });
        }
    }

    return owing
        .map(([id, e]): Defaulter => {
            const s = embedOne(e.fees[0].students)!;
            const u = embedOne(s.users);
            const owingFees = e.fees.filter(f => Number(f.total_fee) - Number(f.paid_amount) > 0);
            const dues = owingFees.map(f => f.due_date).filter((d): d is string => !!d).sort();
            const contact = parent.get(id);
            return {
                studentId: id,
                name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || 'Learner',
                admissionNumber: s.admission_number,
                className: embedOne(s.grade_streams)?.full_name ?? null,
                gradeStreamId: s.current_grade_stream_id,
                owed: Math.round(e.owed * 100) / 100,
                termsOwing: owingFees.length,
                oldestDue: dues[0] ?? null,
                lastPaymentAt: lastPaid.get(id) ?? null,
                guardianName: contact?.name ?? (s.guardian_name?.trim() || null),
                guardianPhone: contact?.phone ?? (s.guardian_phone?.trim() || null),
            };
        })
        .sort((a, b) => b.owed - a.owed);
}

interface PaymentRow {
    amount: number | string;
    method: string;
    paid_at: string;
    student_fees: One<{ students: One<{ grade_streams: One<{ id: string; full_name: string }> }> }>;
}

/** Nairobi calendar day (UTC+3, no daylight saving) of an instant. */
const nairobiDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

function buckets(map: Map<string, CollectionBucket>, order: (a: CollectionBucket, b: CollectionBucket) => number): CollectionBucket[] {
    return [...map.values()].map(b => ({ ...b, amount: Math.round(b.amount * 100) / 100 })).sort(order);
}

/** Money that came in between two days (inclusive, Nairobi time), by day, method and class. */
export async function loadCollections(supabase: SupabaseClient, schoolId: string, from: string, to: string): Promise<CollectionsResponse> {
    // The window in UTC: Nairobi midnight is 21:00 the day before.
    const start = new Date(`${from}T00:00:00+03:00`).toISOString();
    const end = new Date(new Date(`${to}T00:00:00+03:00`).getTime() + 86_400_000).toISOString();
    const { rows, error } = await fetchAllRows<PaymentRow>(() => supabase
        .from('fee_payments')
        .select('amount, method, paid_at, student_fees ( students ( grade_streams ( id, full_name ) ) )')
        .eq('school_id', schoolId)
        .eq('status', 'COMPLETED')
        .gte('paid_at', start)
        .lt('paid_at', end)
        .order('paid_at'));
    if (error) throw new Error('Could not load payments');

    const byDay = new Map<string, CollectionBucket>();
    const byMethod = new Map<string, CollectionBucket>();
    const byClass = new Map<string, CollectionBucket>();
    const add = (map: Map<string, CollectionBucket>, key: string, label: string, amount: number) => {
        const b = map.get(key) ?? { key, label, amount: 0, count: 0 };
        b.amount += amount;
        b.count += 1;
        map.set(key, b);
    };
    let total = 0;
    for (const p of rows) {
        const amount = Number(p.amount);
        total += amount;
        const day = nairobiDay(p.paid_at);
        add(byDay, day, day, amount);
        add(byMethod, p.method, methodLabel(p.method), amount);
        const stream = embedOne(embedOne(embedOne(p.student_fees)?.students ?? null)?.grade_streams ?? null);
        add(byClass, stream?.id ?? 'unmatched', stream?.full_name ?? 'Not matched to a learner', amount);
    }
    return {
        from,
        to,
        total: Math.round(total * 100) / 100,
        count: rows.length,
        byDay: buckets(byDay, (a, b) => a.key.localeCompare(b.key)),
        byMethod: buckets(byMethod, (a, b) => b.amount - a.amount),
        byClass: buckets(byClass, (a, b) => b.amount - a.amount),
    };
}
