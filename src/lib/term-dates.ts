import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The closing and opening days a report card and mark sheet print.
 *
 * A school breaks twice a term, so the admin sets dates on the term for each
 * break: when it closes and reopens around mid-term, and when it reopens after
 * the term ends. A mid-term round prints the mid-term pair; every other round
 * prints the end of term and the reopening after it.
 */
export const TERM_DATE_COLUMNS = 'start_date, end_date, academic_year_id, midterm_closing_date, midterm_reopening_date, reopening_date';

export interface TermDateRow {
    start_date?: string | null;
    end_date?: string | null;
    academic_year_id?: string | null;
    midterm_closing_date?: string | null;
    midterm_reopening_date?: string | null;
    reopening_date?: string | null;
}

/** `YYYY-MM-DD` dates; either may be unknown. */
export interface TermDates {
    closingDate?: string;
    openingDate?: string;
}

/** Whether an exam round ("Mid Term", "MIDTERM", ...) is the mid-term sitting. */
export function isMidTermRound(round: string | null | undefined): boolean {
    return (round ?? '').toUpperCase().includes('MID');
}

export async function resolveTermDates(
    supabase: SupabaseClient,
    term: TermDateRow | null | undefined,
    round: string | null | undefined,
): Promise<TermDates> {
    if (!term) return {};
    const midTerm = isMidTermRound(round);
    const closingDate = (midTerm ? term.midterm_closing_date : term.end_date) || undefined;
    const chosen = (midTerm ? term.midterm_reopening_date || term.reopening_date : term.reopening_date) || undefined;
    return { closingDate, openingDate: chosen ?? await nextTermStart(supabase, term) };
}

/**
 * When neither reopening date is set: the NEXT term's start, never this
 * term's own start_date, which is the day the term began, not the day
 * learners come back.
 */
async function nextTermStart(supabase: SupabaseClient, term: TermDateRow): Promise<string | undefined> {
    if (!term.end_date || !term.academic_year_id) return undefined;
    const { data } = await supabase
        .from('terms')
        .select('start_date')
        .eq('academic_year_id', term.academic_year_id)
        .gt('start_date', term.end_date)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle<{ start_date: string | null }>();
    return data?.start_date || undefined;
}
