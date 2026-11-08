import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { addDays, isIsoDate, schoolDayOf, schoolToday } from '@/lib/dates';
import { methodLabel } from '@/lib/fee-account';
import { paymentCode, type FeePaymentMethod } from '@/lib/fees';
import { loadPaymentLog, recorderNames, type PaymentLogEntry } from '@/lib/fees-payment-log';
import { loadCollections } from '@/lib/fee-reports-server';
import {
    DAYBOOK_RECENT_DAYS, dayReviewSchema, moneyDiffers,
    type DayBook, type DayBookBucket, type DayBookDay, type DayBookPayment,
} from '@/lib/fee-daybook';

interface ReviewRow { day: string; total: number | string; payments: number; note: string | null; reviewed_by: string | null; reviewed_at: string }

const round = (n: number) => Math.round(n * 100) / 100;

/** The day asked for: a real day, not in the future. */
function dayParam(value: string | null, today: string): string {
    if (value === null || value === '') return today;
    if (!isIsoDate(value)) throw new HttpError(400, 'Pick a day.');
    if (value > today) throw new HttpError(400, 'That day has not happened yet.');
    return value;
}

/** The day's completed and voided payments (failed and pending attempts are not money in). */
async function dayPayments(db: SupabaseClient, schoolId: string, day: string): Promise<PaymentLogEntry[]> {
    const { entries } = await loadPaymentLog(db, schoolId, { termId: null, method: null, status: null, source: null, dateFrom: day, dateTo: day, search: null });
    return entries.filter(e => e.status === 'COMPLETED' || e.status === 'CANCELLED').reverse();
}

const totalOf = (entries: readonly PaymentLogEntry[]) => ({ amount: round(entries.reduce((n, e) => n + e.amount, 0)), count: entries.length });

function addTo(map: Map<string, DayBookBucket>, key: string, label: string, amount: number) {
    const b = map.get(key) ?? { key, label, amount: 0, count: 0 };
    b.amount = round(b.amount + amount);
    b.count += 1;
    map.set(key, b);
}

const automaticLabel = (method: string) => (method === 'PESAPAL' ? 'Pesapal (on its own)' : 'M-Pesa Paybill (on its own)');

async function loadDayBook(db: SupabaseClient, access: Pick<Access, 'schoolId' | 'userId'>, day: string): Promise<DayBook> {
    const today = schoolToday();
    const from = addDays(today, -(DAYBOOK_RECENT_DAYS - 1));
    const recentDays = Array.from({ length: DAYBOOK_RECENT_DAYS }, (_, i) => addDays(today, -i));
    const [entries, collections, reviews] = await Promise.all([
        dayPayments(db, access.schoolId, day),
        loadCollections(db, access.schoolId, from, today),
        db.from('fee_day_reviews').select('day, total, payments, note, reviewed_by, reviewed_at').eq('school_id', access.schoolId).in('day', [...new Set([...recentDays, day])]),
    ]);
    if (reviews.error) throw reviews.error;
    const reviewRows = (reviews.data ?? []) as ReviewRow[];
    const reviewOf = new Map(reviewRows.map(r => [r.day, r] as const));
    const review = reviewOf.get(day) ?? null;
    const names = await recorderNames(db, [...entries, ...(review?.reviewed_by ? [{ recordedBy: review.reviewed_by }] : [])]);

    const kept = entries.filter(e => e.status === 'COMPLETED');
    const received = totalOf(kept);
    const byMethod = new Map<string, DayBookBucket>();
    const byRecorder = new Map<string, DayBookBucket>();
    for (const e of kept) {
        addTo(byMethod, e.method, methodLabel(e.method), e.amount);
        if (e.source === 'AUTO' || !e.recordedBy) addTo(byRecorder, `auto:${e.method}`, automaticLabel(e.method), e.amount);
        else addTo(byRecorder, e.recordedBy, names[e.recordedBy] || 'A former staff member', e.amount);
    }

    const payments: DayBookPayment[] = entries.map(e => {
        const enteredOn = schoolDayOf(e.createdAt);
        return {
            id: e.id,
            receiptNumber: e.receiptNumber,
            amount: e.amount,
            method: e.method as FeePaymentMethod,
            voided: e.status === 'CANCELLED',
            learner: e.studentName && e.studentName !== '—' ? e.studentName : null,
            admissionNumber: e.admissionNumber,
            unmatchedReference: e.unmatchedReference,
            code: paymentCode(e),
            payerName: e.payerName,
            recordedByName: e.source === 'AUTO' || !e.recordedBy ? null : names[e.recordedBy] || 'A former staff member',
            automatic: e.source === 'AUTO',
            paidAt: e.paidAt,
            recordedLateOn: enteredOn > day ? enteredOn : null,
            voidedByName: e.voidedBy ? names[e.voidedBy] || null : null,
            notes: e.notes,
        };
    });

    const recordedBy = new Set(entries.map(e => e.recordedBy).filter((id): id is string => !!id));
    const signed = review ? { total: Number(review.total), payments: review.payments } : null;
    const byDay = new Map(collections.byDay.map(b => [b.key, b] as const));
    const recent: DayBookDay[] = recentDays.map(d => {
        const money = d === day ? received : { amount: byDay.get(d)?.amount ?? 0, count: byDay.get(d)?.count ?? 0 };
        const r = reviewOf.get(d);
        return { day: d, ...money, reviewed: !!r, changed: !!r && (moneyDiffers(Number(r.total), money.amount) || r.payments !== money.count) };
    });

    return {
        day,
        payments,
        received,
        voided: totalOf(entries.filter(e => e.status === 'CANCELLED')),
        unmatched: totalOf(kept.filter(e => !e.studentFeeId)),
        recordedLate: payments.filter(p => p.recordedLateOn && !p.voided).length,
        byMethod: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
        byRecorder: [...byRecorder.values()].sort((a, b) => b.amount - a.amount),
        review: review ? {
            reviewedByName: review.reviewed_by ? names[review.reviewed_by] || 'A former staff member' : null,
            reviewedAt: review.reviewed_at,
            note: review.note,
            total: Number(review.total),
            payments: review.payments,
            ownEntries: !!review.reviewed_by && recordedBy.has(review.reviewed_by),
        } : null,
        changedSinceReview: !!signed && (moneyDiffers(signed.total, received.amount) || signed.payments !== received.count),
        viewerRecorded: recordedBy.has(access.userId),
        recent,
    };
}

/** GET ?day=YYYY-MM-DD (default today, Nairobi): the day's money in, how it came, and its sign-off. */
export const GET = route('fee day book', { module: 'fees', permission: 'fees.view' }, async ({ access, request }) => {
    const day = dayParam(new URL(request.url).searchParams.get('day'), schoolToday());
    return loadDayBook(createSupabaseAdmin(), access, day);
});

/**
 * POST { day, note?, ownEntries? }: signs the day off as looked over, with
 * the total and count as they stand. Someone who recorded some of the day's
 * money must say they are reviewing their own entries; the sign-off keeps it.
 */
export const POST = route('fee day review', { module: 'fees', permission: 'fees.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, dayReviewSchema);
    const day = dayParam(body.day, schoolToday());
    const db = createSupabaseAdmin();
    const entries = await dayPayments(db, access.schoolId, day);
    if (entries.length === 0) throw new HttpError(400, 'No payments on this day to review.');
    const own = entries.some(e => e.recordedBy === access.userId);
    if (own && !body.ownEntries) {
        throw new HttpError(409, 'You recorded some of this day’s payments. Ask someone else to review it, or confirm you are checking your own entries.');
    }
    const received = totalOf(entries.filter(e => e.status === 'COMPLETED'));
    const { error } = await db.from('fee_day_reviews').upsert({
        school_id: access.schoolId,
        day,
        total: received.amount,
        payments: received.count,
        note: body.note || null,
        reviewed_by: access.userId,
        reviewed_at: new Date().toISOString(),
    }, { onConflict: 'school_id,day' });
    if (error) throw error;
    await audit(access, 'approve', 'fee_day_reviews', null, { day, total: received.amount, payments: received.count, own_entries: own });
    return loadDayBook(db, access, day);
});
