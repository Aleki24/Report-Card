import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/postgrest';

/**
 * Who sits a subject's exam.
 *
 * - `whole-class`: a CORE subject — every learner in the class takes it (all
 *   of CBC primary and junior school; English, Kiswahili and CSL in senior
 *   school; the 8-4-4 compulsory subjects).
 * - `enrolled`: anything else — senior-school electives, Essential or Core
 *   Mathematics, 8-4-4 electives like CRE or Physics. Learners enrolled in
 *   the subject (`student_subjects`) are listed, and so is anyone who already
 *   has a mark in it: classes marked before enrolment was recorded (8-4-4
 *   Form 3 sat its electives with no `student_subjects` rows) otherwise lost
 *   their whole sheet, and their saved marks with it.
 *
 * There is deliberately no "nobody is enrolled, so list everyone" fallback:
 * that is what put an entire class on every elective's mark sheet.
 */
export type RosterMode = 'whole-class' | 'enrolled';

export async function rosterModeFor(supabase: SupabaseClient, subjectId: string): Promise<RosterMode> {
    const { data } = await supabase.from('subjects').select('subject_type').eq('id', subjectId).maybeSingle();
    return data?.subject_type === 'CORE' ? 'whole-class' : 'enrolled';
}

/** Learner ids per enrolment lookup, so the request URL stays short. */
const ID_CHUNK = 150;

/** Narrow a class list to the learners who take this subject. */
export async function subjectTakers<T extends { id: string }>(
    supabase: SupabaseClient,
    subjectId: string,
    students: T[]
): Promise<{ students: T[]; mode: RosterMode }> {
    const mode = await rosterModeFor(supabase, subjectId);
    if (mode === 'whole-class' || students.length === 0) return { students, mode };

    // The ids go in the request URL: a whole school's (an admin's mark sheet)
    // overflowed it, so they are looked up a chunk at a time.
    const ids = students.map(s => s.id);
    const takers = new Set<string>();
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
        const chunk = ids.slice(i, i + ID_CHUNK);
        const [enrolled, marked] = await Promise.all([
            enrolledIn(supabase, subjectId, chunk),
            markedIn(supabase, subjectId, chunk),
        ]);
        for (const id of enrolled) takers.add(id);
        for (const id of marked) takers.add(id);
    }
    return { students: students.filter(s => takers.has(s.id)), mode };
}

interface StudentRef {
    student_id: string;
}

/** Of these learners, the ones enrolled in the subject. */
async function enrolledIn(supabase: SupabaseClient, subjectId: string, studentIds: string[]): Promise<string[]> {
    const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('subject_id', subjectId)
        .in('student_id', studentIds)
        .returns<StudentRef[]>();
    if (error) throw new Error(`Failed to load subject enrolments: ${error.message}`);
    return (data ?? []).map(e => e.student_id);
}

/**
 * Of these learners, the ones with a mark on any of the subject's exams.
 * Paged: a chunk of learners across a year of exams passes 1,000 marks.
 */
async function markedIn(supabase: SupabaseClient, subjectId: string, studentIds: string[]): Promise<string[]> {
    const { rows, error } = await fetchAllRows<StudentRef>(() => supabase
        .from('exam_marks')
        .select('student_id, exams!inner(subject_id)')
        .eq('exams.subject_id', subjectId)
        .in('student_id', studentIds)
        .order('id')
        .returns<StudentRef[]>());
    if (error) throw new Error(`Failed to load subject marks: ${error instanceof Error ? error.message : String(error)}`);
    return rows.map(m => m.student_id);
}
