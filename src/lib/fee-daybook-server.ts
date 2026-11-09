/**
 * The day book's recent days, server side: each day's money in and whether
 * it is signed off (and unchanged since). Shared by the day book and the
 * fees health check. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, schoolToday } from '@/lib/dates';
import { loadCollections } from '@/lib/fee-reports-server';
import { DAYBOOK_RECENT_DAYS, moneyDiffers, type DayBookDay } from '@/lib/fee-daybook';

interface ReviewRow { day: string; total: number | string; payments: number }

/** The last `count` days to today, newest first. */
export async function recentDays(db: SupabaseClient, schoolId: string, count = DAYBOOK_RECENT_DAYS): Promise<DayBookDay[]> {
    const today = schoolToday();
    const days = Array.from({ length: count }, (_, i) => addDays(today, -i));
    const [collections, reviews] = await Promise.all([
        loadCollections(db, schoolId, days[days.length - 1], today),
        db.from('fee_day_reviews').select('day, total, payments').eq('school_id', schoolId).in('day', days),
    ]);
    if (reviews.error) throw reviews.error;
    const byDay = new Map(collections.byDay.map(b => [b.key, b] as const));
    const reviewOf = new Map(((reviews.data ?? []) as ReviewRow[]).map(r => [r.day, r] as const));
    return days.map(day => {
        const amount = byDay.get(day)?.amount ?? 0;
        const paid = byDay.get(day)?.count ?? 0;
        const r = reviewOf.get(day);
        return { day, amount, count: paid, reviewed: !!r, changed: !!r && (moneyDiffers(Number(r.total), amount) || r.payments !== paid) };
    });
}
