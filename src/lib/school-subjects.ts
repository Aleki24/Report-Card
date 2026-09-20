/**
 * Which subjects a school offers.
 *
 * Subjects used to be physical per-school rows: every school wrote its own
 * "Chemistry" with its own id, and `subjects.school_id` said who owned it.
 * That produced codes matching nothing, one school's rows reachable from
 * another's lookups, and an 8-4-4 class sitting a CBC paper.
 *
 * Now `subjects` is a catalogue every school can see and `school_subjects`
 * says which of them a school offers and how it grades them. Everything that
 * used to filter `subjects` by `school_id` goes through here instead, so the
 * join lives in one place rather than twenty.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reads like the old `subjects` table filtered by school: same columns, plus
 * `grading_system_id` from the offering. Callers keep their select strings.
 */
export const SCHOOL_SUBJECT_VIEW = 'school_subject_catalogue';

/** Columns the view carries beyond the catalogue's own. */
export const OFFERING_COLUMNS = 'school_id, grading_system_id, offering_id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface OfferedSubject {
    id: string;
    code: string;
    name: string;
    academic_level_id: string;
    subject_type: string;
    display_order: number;
    category: string | null;
    band: string | null;
    origin_school_id: string | null;
    grading_system_id: string | null;
    created_at: string;
}

/**
 * Every subject a school offers, in display order.
 *
 * `select` takes the same column list the old `.from('subjects')` call used;
 * the view exposes those names unchanged.
 */
export async function listOfferedSubjects(
    supabase: Db,
    schoolId: string,
    select = '*',
): Promise<{ data: OfferedSubject[]; error: unknown }> {
    const { data, error } = await supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select(select)
        .eq('school_id', schoolId)
        .order('display_order');
    return { data: (data ?? []) as unknown as OfferedSubject[], error };
}

/**
 * True when every id is a subject this school offers.
 *
 * Replaces the `.eq('school_id', schoolId).in('id', ids)` ownership checks.
 * Those asked "does this school own the row"; the question now is "does this
 * school offer this catalogue subject", which is the thing actually worth
 * enforcing — a subject nobody offers should not be gradeable or examinable.
 */
export async function allOffered(
    supabase: Db,
    schoolId: string,
    subjectIds: string[],
): Promise<boolean> {
    if (subjectIds.length === 0) return true;
    const unique = [...new Set(subjectIds)];
    const { data, error } = await supabase
        .from('school_subjects')
        .select('subject_id')
        .eq('school_id', schoolId)
        .in('subject_id', unique);
    if (error) return false;
    return (data ?? []).length === unique.length;
}

/** One subject, only if this school offers it. */
export async function findOfferedSubject(
    supabase: Db,
    schoolId: string,
    subjectId: string,
    select = '*',
): Promise<OfferedSubject | null> {
    const { data } = await supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select(select)
        .eq('school_id', schoolId)
        .eq('id', subjectId)
        .maybeSingle();
    return (data as unknown as OfferedSubject) ?? null;
}

/**
 * Start offering catalogue subjects. Idempotent: a subject already offered is
 * left alone rather than duplicated, so "add all standard subjects" can be
 * pressed twice without consequence.
 */
export async function offerSubjects(
    supabase: Db,
    schoolId: string,
    subjectIds: string[],
): Promise<{ created: number; error: unknown }> {
    if (subjectIds.length === 0) return { created: 0, error: null };
    const rows = [...new Set(subjectIds)].map(subject_id => ({ school_id: schoolId, subject_id }));
    const { data, error } = await supabase
        .from('school_subjects')
        .upsert(rows, { onConflict: 'school_id,subject_id', ignoreDuplicates: true })
        .select('id');
    return { created: (data ?? []).length, error };
}

/**
 * Stop offering a subject.
 *
 * Deliberately does NOT delete the catalogue row. Deleting a subject used to
 * cascade its exams and every mark under them out of existence; unlisting
 * leaves the history intact and simply takes the subject off the school's
 * list. Callers still refuse when exams exist, so a school cannot silently
 * orphan a term's results.
 */
export async function stopOffering(
    supabase: Db,
    schoolId: string,
    subjectId: string,
): Promise<{ error: unknown }> {
    const { error } = await supabase
        .from('school_subjects')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', subjectId);
    return { error };
}

/** Set (or clear) how one school grades one subject. */
export async function setGradingSystem(
    supabase: Db,
    schoolId: string,
    subjectIds: string[],
    gradingSystemId: string | null,
): Promise<{ error: unknown }> {
    if (subjectIds.length === 0) return { error: null };
    const { error } = await supabase
        .from('school_subjects')
        .update({ grading_system_id: gradingSystemId })
        .eq('school_id', schoolId)
        .in('subject_id', subjectIds);
    return { error };
}

/**
 * Clear a grading system from every subject of a school except the ones given.
 * Used when a grading group's membership is rewritten wholesale.
 */
export async function clearGradingSystemExcept(
    supabase: Db,
    schoolId: string,
    gradingSystemId: string,
    keepSubjectIds: string[],
): Promise<{ error: unknown }> {
    let query = supabase
        .from('school_subjects')
        .update({ grading_system_id: null })
        .eq('school_id', schoolId)
        .eq('grading_system_id', gradingSystemId);
    if (keepSubjectIds.length > 0) {
        query = query.not('subject_id', 'in', `(${[...new Set(keepSubjectIds)].join(',')})`);
    }
    const { error } = await query;
    return { error };
}

/**
 * How each school grades each subject, as a subject_id -> grading_system_id map.
 *
 * The grading system used to be a column on the subject, so routes could embed
 * `subjects(grading_system_id)` off an exam and be done. It is per-school now,
 * and PostgREST cannot reach across to a join table from inside an embed — so
 * routes look it up here and put the value back under the same JSON key their
 * clients already read.
 */
export async function gradingSystemBySubject(
    supabase: Db,
    schoolId: string,
): Promise<Map<string, string | null>> {
    const { data } = await supabase
        .from('school_subjects')
        .select('subject_id, grading_system_id')
        .eq('school_id', schoolId);
    return new Map((data ?? []).map(r => [r.subject_id as string, (r.grading_system_id as string | null) ?? null]));
}
