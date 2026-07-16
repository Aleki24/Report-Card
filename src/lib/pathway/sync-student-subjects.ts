import type { SupabaseClient } from '@supabase/supabase-js';
import { SENIOR_CORE_SUBJECT_CODES } from '@/lib/pathway-definitions';

/**
 * Keeps `student_subjects` in sync with students' assigned subject
 * combination: the combination's 3 electives plus the compulsory
 * senior-school cores. Idempotent — safe to call again after any
 * combination or subject change. Passing `combinationId: null`
 * clears the students' enrollments entirely, returning them to the
 * default "all subjects at their academic level" behaviour.
 *
 * All students in one call get the same combination, so the
 * combination + core subjects are resolved once and the enrollment
 * writes are batched (2 writes total regardless of student count).
 */
export async function syncStudentsSubjectsBulk(
    supabase: SupabaseClient,
    opts: { studentIds: string[]; schoolId: string; combinationId: string | null }
): Promise<{ enrolledPerStudent: number }> {
    const { studentIds, schoolId, combinationId } = opts;
    if (studentIds.length === 0) return { enrolledPerStudent: 0 };

    if (!combinationId) {
        const { error } = await supabase
            .from('student_subjects')
            .delete()
            .in('student_id', studentIds);
        if (error) throw new Error(`Failed to clear subject enrollments: ${error.message}`);
        return { enrolledPerStudent: 0 };
    }

    const { data: combination, error: comboError } = await supabase
        .from('subject_combinations')
        .select('id, school_id, is_active, subject_combination_subjects ( subject_id )')
        .eq('id', combinationId)
        .maybeSingle();
    if (comboError) throw new Error(`Failed to load combination: ${comboError.message}`);
    if (!combination) throw new Error('Subject combination not found');
    if (combination.school_id !== schoolId) throw new Error('Subject combination belongs to a different school');

    const electiveIds: string[] = (combination.subject_combination_subjects || []).map(
        (row: { subject_id: string }) => row.subject_id
    );

    // Compulsory cores by well-known senior codes, at the same academic
    // level as the electives (NOT the student's level — a mis-set student
    // level must not enroll cores from another curriculum). School-scoped:
    // academic levels are shared across schools, subjects are not.
    let coreLevelIds: string[] = [];
    if (electiveIds.length > 0) {
        const { data: electiveSubjects, error: electiveError } = await supabase
            .from('subjects')
            .select('id, academic_level_id')
            .in('id', electiveIds);
        if (electiveError) throw new Error(`Failed to load elective subjects: ${electiveError.message}`);
        coreLevelIds = [...new Set((electiveSubjects || []).map(s => s.academic_level_id).filter(Boolean))];
    }

    let coreIds: string[] = [];
    if (coreLevelIds.length > 0) {
        const coresQuery = await supabase
            .from('subjects')
            .select('id')
            .eq('school_id', schoolId)
            .in('academic_level_id', coreLevelIds)
            .in('code', SENIOR_CORE_SUBJECT_CODES);
        if (coresQuery.error) throw new Error(`Failed to load core subjects: ${coresQuery.error.message}`);
        coreIds = (coresQuery.data || []).map((s: { id: string }) => s.id);
        if (coreIds.length === 0) {
            // Fallback for schools using custom subject codes
            const fallback = await supabase
                .from('subjects')
                .select('id')
                .eq('school_id', schoolId)
                .in('academic_level_id', coreLevelIds)
                .eq('subject_type', 'CORE');
            if (fallback.error) throw new Error(`Failed to load core subjects: ${fallback.error.message}`);
            coreIds = (fallback.data || []).map((s: { id: string }) => s.id);
        }
    }

    if (electiveIds.length === 0 && coreIds.length === 0) {
        // Nothing to enroll (combination lost its electives) — clear
        // instead of leaving stale rows
        const { error } = await supabase
            .from('student_subjects')
            .delete()
            .in('student_id', studentIds);
        if (error) throw new Error(`Failed to clear subject enrollments: ${error.message}`);
        return { enrolledPerStudent: 0 };
    }

    // Electives win when a subject appears in both sets
    const electiveSet = new Set(electiveIds);
    const desired = [
        ...electiveIds.map((subjectId) => ({ subject_id: subjectId, role: 'ELECTIVE' as const })),
        ...coreIds
            .filter((subjectId) => !electiveSet.has(subjectId))
            .map((subjectId) => ({ subject_id: subjectId, role: 'CORE' as const })),
    ];

    const rows = studentIds.flatMap((studentId) =>
        desired.map((d) => ({
            student_id: studentId,
            subject_id: d.subject_id,
            role: d.role,
            school_id: schoolId,
        }))
    );
    const { error: upsertError } = await supabase
        .from('student_subjects')
        .upsert(rows, { onConflict: 'student_id,subject_id' });
    if (upsertError) throw new Error(`Failed to save subject enrollments: ${upsertError.message}`);

    const desiredIds = desired.map((d) => d.subject_id);
    const { error: pruneError } = await supabase
        .from('student_subjects')
        .delete()
        .in('student_id', studentIds)
        .not('subject_id', 'in', `(${desiredIds.join(',')})`);
    if (pruneError) throw new Error(`Failed to prune stale enrollments: ${pruneError.message}`);

    return { enrolledPerStudent: desired.length };
}

/** Single-student convenience wrapper around the bulk sync. */
export async function syncStudentSubjects(
    supabase: SupabaseClient,
    opts: { studentId: string; schoolId: string; combinationId: string | null }
): Promise<{ enrolled: number }> {
    const result = await syncStudentsSubjectsBulk(supabase, {
        studentIds: [opts.studentId],
        schoolId: opts.schoolId,
        combinationId: opts.combinationId,
    });
    return { enrolled: result.enrolledPerStudent };
}

/**
 * Re-syncs every student currently assigned to a combination — used
 * after the combination's electives change.
 */
export async function syncCombinationStudents(
    supabase: SupabaseClient,
    combinationId: string,
    schoolId: string
): Promise<{ students: number }> {
    const { data: students, error } = await supabase
        .from('students')
        .select('id')
        .eq('subject_combination_id', combinationId);
    if (error) throw new Error(`Failed to load combination students: ${error.message}`);

    const studentIds = (students || []).map((s) => s.id);
    await syncStudentsSubjectsBulk(supabase, { studentIds, schoolId, combinationId });
    return { students: studentIds.length };
}
