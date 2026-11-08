/**
 * Loads the fees overview: this term against last term, what is owed by
 * class, and the counts the health check is scored from. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { addDays, schoolDayOf, schoolDayRange, schoolToday } from '@/lib/dates';
import { findActiveTermId } from '@/lib/term-calendar';
import { loadDefaulters } from '@/lib/fee-reports-server';
import { recentDays } from '@/lib/fee-daybook-server';
import type { CollectionBucket } from '@/lib/fee-reports';
import { healthCheck, type FeesOverview, type TermCollection } from '@/lib/fee-overview';

interface TermRow {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean | null;
    academic_years: { name: string | null } | { name: string | null }[] | null;
}

interface FeeRow { term_id: string; total_fee: number | string; paid_amount: number | string }

const round = (n: number) => Math.round(n * 100) / 100;
const dayGap = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));

/** What a term billed and what came in against it. */
function collectionOf(term: TermRow, fees: readonly FeeRow[]): TermCollection {
    const billed = fees.filter(f => f.term_id === term.id && Number(f.total_fee) > 0);
    const expected = round(billed.reduce((n, f) => n + Number(f.total_fee), 0));
    const collected = round(billed.reduce((n, f) => n + Number(f.paid_amount), 0));
    // Overpayments are credit, not a higher rate: each bill counts up to its total.
    const towardBills = billed.reduce((n, f) => n + Math.min(Number(f.paid_amount), Number(f.total_fee)), 0);
    return {
        termId: term.id,
        termName: term.name,
        yearName: embedOne(term.academic_years)?.name ?? null,
        expected,
        collected,
        rate: expected > 0 ? Math.round((towardBills / expected) * 100) : 0,
        learners: billed.length,
        paidNothing: billed.filter(f => Number(f.paid_amount) <= 0).length,
    };
}

export async function loadFeesOverview(db: SupabaseClient, schoolId: string): Promise<FeesOverview> {
    const today = schoolToday();
    const { data: termData, error: termError } = await db
        .from('terms').select('id, name, start_date, end_date, is_current, academic_years ( name )').eq('school_id', schoolId);
    if (termError) throw termError;
    const terms = (termData ?? []) as TermRow[];
    const currentId = terms.length > 0 ? findActiveTermId(terms.map(t => ({ ...t, start_date: t.start_date ?? undefined, end_date: t.end_date ?? undefined, is_current: t.is_current ?? undefined }))) : null;
    const current = terms.find(t => t.id === currentId) ?? null;
    const previous = current?.start_date
        ? [...terms].filter(t => t.start_date && t.start_date < (current.start_date ?? '')).sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0] ?? null
        : null;
    const termIds = [current?.id, previous?.id].filter((id): id is string => !!id);

    const [fees, owing, unmatched, lastStatement, traceable, week] = await Promise.all([
        termIds.length > 0
            ? fetchAllRows<FeeRow>(() => db.from('student_fees').select('term_id, total_fee, paid_amount').eq('school_id', schoolId).in('term_id', termIds).order('id'))
            : Promise.resolve({ rows: [] as FeeRow[], error: null, truncated: false }),
        loadDefaulters(db, schoolId, {}),
        fetchAllRows<{ amount: number | string; paid_at: string }>(() => db
            .from('fee_payments').select('amount, paid_at')
            .eq('school_id', schoolId).is('student_fee_id', null).eq('status', 'COMPLETED').not('unmatched_account_reference', 'is', null)
            .order('id')),
        db.from('fee_reconciliations').select('created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(1).maybeSingle<{ created_at: string }>(),
        db.from('fee_payments').select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId).eq('status', 'COMPLETED').in('method', ['MPESA', 'BANK', 'CHEQUE'])
            .gte('paid_at', schoolDayRange(addDays(today, -29)).start),
        recentDays(db, schoolId, 7),
    ]);
    if (fees.error) throw fees.error;
    if (unmatched.error) throw unmatched.error;
    if (lastStatement.error) throw lastStatement.error;
    if (traceable.error) throw traceable.error;

    const currentCollection = current ? collectionOf(current, fees.rows) : null;
    const previousCollection = previous ? collectionOf(previous, fees.rows) : null;

    const byClass = new Map<string, CollectionBucket>();
    for (const d of owing) {
        const key = d.gradeStreamId ?? 'none';
        const b = byClass.get(key) ?? { key, label: d.className ?? 'No class', amount: 0, count: 0 };
        b.amount = round(b.amount + d.owed);
        b.count += 1;
        byClass.set(key, b);
    }

    const oldestUnmatched = unmatched.rows.reduce<string | null>((min, p) => (!min || p.paid_at < min ? p.paid_at : min), null);
    const daysWithPayments = week.filter(d => d.count > 0);

    return {
        current: currentCollection,
        previous: previousCollection,
        totalOwed: round(owing.reduce((n, d) => n + d.owed, 0)),
        learnersOwing: owing.length,
        arrearsByClass: [...byClass.values()].sort((a, b) => b.amount - a.amount),
        health: healthCheck({
            current: currentCollection,
            termDay: current?.start_date ? dayGap(current.start_date, today) : 0,
            unmatchedCount: unmatched.rows.length,
            unmatchedAmount: round(unmatched.rows.reduce((n, p) => n + Number(p.amount), 0)),
            unmatchedOldestDays: oldestUnmatched ? dayGap(schoolDayOf(oldestUnmatched), today) : 0,
            daysSinceStatement: lastStatement.data ? dayGap(schoolDayOf(lastStatement.data.created_at), today) : null,
            traceablePayments30d: traceable.count ?? 0,
            daysWithPayments: daysWithPayments.length,
            daysReviewed: daysWithPayments.filter(d => d.reviewed && !d.changed).length,
            learnersOwing: owing.length,
            owingWithoutPhone: owing.filter(d => !d.guardianPhone).length,
            brokenPromises: owing.filter(d => d.followUp?.promise?.state === 'BROKEN').length,
        }),
    };
}
