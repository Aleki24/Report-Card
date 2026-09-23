import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Who sits a subject's exam.
 *
 * - `whole-class`: a CORE subject — every learner in the class takes it (all
 *   of CBC primary and junior school; English, Kiswahili and CSL in senior
 *   school; the 8-4-4 compulsory subjects).
 * - `enrolled`: anything else — senior-school electives, Essential or Core
 *   Mathematics, 8-4-4 electives like CRE or Physics. Only learners enrolled
 *   in the subject (`student_subjects`) are listed.
 *
 * There is deliberately no "nobody is enrolled, so list everyone" fallback:
 * that is what put an entire class on every elective's mark sheet.
 */
export type RosterMode = 'whole-class' | 'enrolled';

export async function rosterModeFor(supabase: SupabaseClient, subjectId: string): Promise<RosterMode> {
    const { data } = await supabase.from('subjects').select('subject_type').eq('id', subjectId).maybeSingle();
    return data?.subject_type === 'CORE' ? 'whole-class' : 'enrolled';
}

/** Narrow a class list to the learners who take this subject. */
export async function subjectTakers<T extends { id: string }>(
    supabase: SupabaseClient,
    subjectId: string,
    students: T[]
): Promise<{ students: T[]; mode: RosterMode }> {
    const mode = await rosterModeFor(supabase, subjectId);
    if (mode === 'whole-class' || students.length === 0) return { students, mode };

    const { data: enrollments, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', subjectId)
        .in('student_id', students.map(s => s.id));
    if (error) throw new Error(`Failed to load subject enrolments: ${error.message}`);

    const enrolled = new Set((enrollments ?? []).map(e => e.student_id as string));
    return { students: students.filter(s => enrolled.has(s.id)), mode };
}
