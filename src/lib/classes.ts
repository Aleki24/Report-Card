/**
 * Classes ("grade streams").
 *
 * Every learner, class teacher, subject teacher, mark sheet and position
 * hangs off a class, so every grade a school teaches needs at least one.
 * A school with several classes per grade names them (Form 3 East, Form 3
 * West); a school with one class per grade has a single class named after
 * the grade itself (Grade 4) — no stream name needed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type ClassNames = { name: string; full_name: string };

/** Name and full name for a class; no stream name means the grade's only class. */
export function classNames(gradeName: string, streamName?: string | null): ClassNames {
    const grade = gradeName.trim();
    const stream = streamName?.trim();
    return stream ? { name: stream, full_name: `${grade} ${stream}` } : { name: grade, full_name: grade };
}

/** "East, West ,  North" → ["East", "West", "North"], without repeats. */
export function parseStreamNames(input: string): string[] {
    const seen = new Set<string>();
    return input
        .split(',')
        .map(s => s.trim())
        .filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/**
 * Create a grade's classes, skipping any that already exist (by name, any
 * case), so running setup twice doesn't duplicate them. No stream names
 * creates the single class named after the grade.
 */
export async function ensureClasses(
    supabase: Db,
    { schoolId, gradeId, gradeName, streamNames }: { schoolId: string; gradeId: string; gradeName: string; streamNames: readonly string[] },
): Promise<{ created: number }> {
    const wanted = (streamNames.length > 0 ? streamNames.map(s => classNames(gradeName, s)) : [classNames(gradeName)]);

    const { data: existing, error } = await supabase
        .from('grade_streams')
        .select('name')
        .eq('school_id', schoolId)
        .eq('grade_id', gradeId);
    if (error) throw error;
    const have = new Set((existing ?? []).map(r => (r.name as string).trim().toLowerCase()));

    const rows = wanted
        .filter(c => !have.has(c.name.toLowerCase()))
        .map(c => ({ ...c, grade_id: gradeId, school_id: schoolId }));
    if (rows.length === 0) return { created: 0 };

    const { error: insertError } = await supabase.from('grade_streams').insert(rows);
    if (insertError) throw insertError;
    return { created: rows.length };
}

/** Whether a class (grade stream) belongs to this school. */
export async function isSchoolClass(supabase: Db, schoolId: string, streamId: string): Promise<boolean> {
    const { data } = await supabase.from('grade_streams').select('id').eq('id', streamId).eq('school_id', schoolId).maybeSingle();
    return Boolean(data);
}

/**
 * A learner outside every class has no mark sheet, report card or position,
 * so an active learner must always sit in one. Only a learner who has left
 * (transferred, graduated, deactivated) may be without a class.
 */
export const CLASS_REQUIRED_MESSAGE = 'Choose a class for this learner — without one they get no mark sheets or report cards.';
