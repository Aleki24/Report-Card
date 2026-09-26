/**
 * What hangs off a term or academic year, for refusing deletes that would
 * destroy history. Exams, report cards, fee records and performance history
 * cascade from a term, and from a year through its terms (plus the year's
 * class and subject teacher assignments), so "delete this term" used to take
 * every mark, report card and fee record in it along. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type CalendarKind = 'term' | 'academic_year';

interface Held { label: string; count: number }

async function count(supabase: Db, table: string, column: string, id: string): Promise<number> {
    const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
    if (error) throw error;
    return n ?? 0;
}

/** Why a term or year can't be deleted, or null when nothing depends on it. */
export async function calendarDeleteBlocker(supabase: Db, kind: CalendarKind, id: string): Promise<string | null> {
    const column = kind === 'term' ? 'term_id' : 'academic_year_id';
    const checks: [string, string][] = [
        ['exams', 'exam'],
        ['report_cards', 'report card'],
        ...(kind === 'term' ? [['student_fees', 'fee record'] as [string, string]] : []),
    ];
    const held: Held[] = [];
    for (const [table, label] of checks) {
        const n = await count(supabase, table, column, id);
        if (n > 0) held.push({ label, count: n });
    }
    if (kind === 'academic_year') {
        const terms = await count(supabase, 'terms', 'academic_year_id', id);
        if (terms > 0) held.push({ label: 'term', count: terms });
    }
    if (held.length === 0) return null;

    const parts = held.map(h => `${h.count} ${h.label}${h.count === 1 ? '' : 's'}`);
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    const what = kind === 'term' ? 'term' : 'year';
    return kind === 'academic_year' && held.every(h => h.label === 'term')
        ? `This year still has ${list}. Delete its terms first.`
        : `This ${what} has ${list}. Deleting it would erase them, so it can't be deleted. Rename it or correct its dates instead.`;
}
