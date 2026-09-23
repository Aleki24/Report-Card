import type { SupabaseClient } from '@supabase/supabase-js';
import {
    MATHS_CODES,
    SENIOR_CORE_SUBJECT_CODES,
    defaultMathsCode,
    isMathsCode,
    type CbcPathway,
    type MathsCode,
} from '@/lib/pathway-definitions';
import { isSubjectOfferedInBand } from '@/lib/curriculum-bands';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';

type SyncOptions = {
    studentIds: string[];
    schoolId: string;
    combinationId: string | null;
    /**
     * A maths choice per learner, e.g. from the placement tool. Learners not
     * in the map keep the maths they are already enrolled in, or get the
     * default for their combination (see defaultMathsCode).
     */
    mathsByStudent?: ReadonlyMap<string, MathsCode>;
};

/**
 * Keeps `student_subjects` in sync with students' assigned subject
 * combination: the combination's 3 electives, the compulsory senior-school
 * subjects (English, Kiswahili, Community Service Learning), and each
 * learner's own mathematics. Idempotent — safe to call again after any
 * combination or subject change. Passing `combinationId: null` clears the
 * students' enrollments entirely, returning them to the default "all
 * subjects at their academic level" behaviour.
 *
 * Learners in one call share a combination but not necessarily a maths, so
 * they are grouped by their final subject set and each group is written with
 * one upsert and one prune.
 */
export async function syncStudentsSubjectsBulk(
    supabase: SupabaseClient,
    { studentIds, schoolId, combinationId, mathsByStudent }: SyncOptions
): Promise<{ enrolledPerStudent: number }> {
    if (studentIds.length === 0) return { enrolledPerStudent: 0 };

    if (!combinationId) {
        await clearEnrollments(supabase, studentIds);
        return { enrolledPerStudent: 0 };
    }

    const { data: combination, error: comboError } = await supabase
        .from('subject_combinations')
        .select('id, school_id, pathway, is_active, subject_combination_subjects ( subject_id )')
        .eq('id', combinationId)
        .maybeSingle();
    if (comboError) throw new Error(`Failed to load combination: ${comboError.message}`);
    if (!combination) throw new Error('Subject combination not found');
    if (combination.school_id !== schoolId) throw new Error('Subject combination belongs to a different school');

    const electiveIds: string[] = (combination.subject_combination_subjects || []).map(
        (row: { subject_id: string }) => row.subject_id
    );

    // Compulsory subjects are matched at the same academic level as the
    // electives (NOT the student's level — a mis-set student level must not
    // enroll cores from another curriculum). Read by id straight from the
    // catalogue: these ids came from a combination whose electives were
    // checked as offered when it was saved.
    let coreLevelIds: string[] = [];
    let electiveCodes: string[] = [];
    if (electiveIds.length > 0) {
        const { data: electiveSubjects, error: electiveError } = await supabase
            .from('subjects')
            .select('id, code, academic_level_id')
            .in('id', electiveIds);
        if (electiveError) throw new Error(`Failed to load elective subjects: ${electiveError.message}`);
        coreLevelIds = [...new Set((electiveSubjects || []).map(s => s.academic_level_id).filter(Boolean))];
        electiveCodes = (electiveSubjects || []).map(s => (s.code as string).trim().toUpperCase());
    }

    const { coreIds, mathsIdByCode } = await loadSeniorCompulsory(supabase, schoolId, coreLevelIds);

    if (electiveIds.length === 0 && coreIds.length === 0) {
        // Nothing to enroll (combination lost its electives) — clear
        // instead of leaving stale rows
        await clearEnrollments(supabase, studentIds);
        return { enrolledPerStudent: 0 };
    }

    // Each learner's maths: explicit choice, else what they already take,
    // else the default. Null when Core Maths is one of the electives.
    const combinationDefault = defaultMathsCode(electiveCodes, combination.pathway as CbcPathway | null);
    const currentMaths = combinationDefault === null ? new Map<string, MathsCode>() : await loadCurrentMaths(supabase, studentIds);
    const mathsFor = (studentId: string): MathsCode | null =>
        combinationDefault === null ? null : mathsByStudent?.get(studentId) ?? currentMaths.get(studentId) ?? combinationDefault;

    // Electives win when a subject appears in both sets
    const electiveSet = new Set(electiveIds);
    const baseRows = [
        ...electiveIds.map(subjectId => ({ subject_id: subjectId, role: 'ELECTIVE' as const })),
        ...coreIds.filter(id => !electiveSet.has(id)).map(subjectId => ({ subject_id: subjectId, role: 'CORE' as const })),
    ];

    // Group learners by their maths so each distinct subject set is one write.
    const groups = new Map<MathsCode | 'none', string[]>();
    for (const studentId of studentIds) {
        const maths = mathsFor(studentId);
        const key = maths && mathsIdByCode.has(maths) ? maths : 'none';
        groups.set(key, [...(groups.get(key) ?? []), studentId]);
    }

    let enrolledPerStudent = baseRows.length;
    for (const [maths, ids] of groups) {
        const mathsId = maths === 'none' ? null : mathsIdByCode.get(maths) ?? null;
        const desired = mathsId && !electiveSet.has(mathsId)
            ? [...baseRows, { subject_id: mathsId, role: 'CORE' as const }]
            : baseRows;
        enrolledPerStudent = Math.max(enrolledPerStudent, desired.length);

        const { error: upsertError } = await supabase
            .from('student_subjects')
            .upsert(
                ids.flatMap(studentId => desired.map(d => ({ student_id: studentId, subject_id: d.subject_id, role: d.role, school_id: schoolId }))),
                { onConflict: 'student_id,subject_id' }
            );
        if (upsertError) throw new Error(`Failed to save subject enrollments: ${upsertError.message}`);

        const { error: pruneError } = await supabase
            .from('student_subjects')
            .delete()
            .in('student_id', ids)
            .not('subject_id', 'in', `(${desired.map(d => d.subject_id).join(',')})`);
        if (pruneError) throw new Error(`Failed to prune stale enrollments: ${pruneError.message}`);
    }

    return { enrolledPerStudent };
}

async function clearEnrollments(supabase: SupabaseClient, studentIds: string[]): Promise<void> {
    const { error } = await supabase.from('student_subjects').delete().in('student_id', studentIds);
    if (error) throw new Error(`Failed to clear subject enrollments: ${error.message}`);
}

/** English, Kiswahili, CSL and the two maths options, as this school offers them. */
async function loadSeniorCompulsory(
    supabase: SupabaseClient,
    schoolId: string,
    levelIds: string[]
): Promise<{ coreIds: string[]; mathsIdByCode: Map<MathsCode, string> }> {
    const mathsIdByCode = new Map<MathsCode, string>();
    if (levelIds.length === 0) return { coreIds: [], mathsIdByCode };

    const { data, error } = await supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, code')
        .eq('school_id', schoolId)
        .in('academic_level_id', levelIds)
        .in('code', [...SENIOR_CORE_SUBJECT_CODES, ...MATHS_CODES]);
    if (error) throw new Error(`Failed to load core subjects: ${error.message}`);

    const coreIds: string[] = [];
    for (const row of data ?? []) {
        const code = (row.code as string).trim().toUpperCase();
        if (isMathsCode(code)) mathsIdByCode.set(code, row.id as string);
        else coreIds.push(row.id as string);
    }
    if (coreIds.length > 0 || mathsIdByCode.size > 0) return { coreIds, mathsIdByCode };

    // Fallback for schools using custom subject codes. Every CBC band shares
    // one academic level, so this has to drop the cores that belong to
    // another band — otherwise a senior learner is enrolled in Lower Primary
    // and Junior School learning areas as well.
    const fallback = await supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, name, code, band')
        .eq('school_id', schoolId)
        .in('academic_level_id', levelIds)
        .eq('subject_type', 'CORE');
    if (fallback.error) throw new Error(`Failed to load core subjects: ${fallback.error.message}`);
    return {
        coreIds: (fallback.data || [])
            .filter((s: { name: string; code: string }) => isSubjectOfferedInBand(s, 'CBC_SENIOR_SCHOOL'))
            .map((s: { id: string }) => s.id),
        mathsIdByCode,
    };
}

/** The maths each learner is currently enrolled in, if any. */
async function loadCurrentMaths(supabase: SupabaseClient, studentIds: string[]): Promise<Map<string, MathsCode>> {
    const { data, error } = await supabase
        .from('student_subjects')
        .select('student_id, subjects!inner ( code )')
        .in('student_id', studentIds)
        .in('subjects.code', [...MATHS_CODES]);
    if (error) throw new Error(`Failed to load current maths: ${error.message}`);

    const result = new Map<string, MathsCode>();
    for (const row of data ?? []) {
        const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
        const code = (subject?.code as string | undefined)?.trim().toUpperCase();
        if (code && isMathsCode(code)) result.set(row.student_id as string, code);
    }
    return result;
}

/** Single-student convenience wrapper around the bulk sync. */
export async function syncStudentSubjects(
    supabase: SupabaseClient,
    opts: { studentId: string; schoolId: string; combinationId: string | null; maths?: MathsCode }
): Promise<{ enrolled: number }> {
    const result = await syncStudentsSubjectsBulk(supabase, {
        studentIds: [opts.studentId],
        schoolId: opts.schoolId,
        combinationId: opts.combinationId,
        mathsByStudent: opts.maths ? new Map([[opts.studentId, opts.maths]]) : undefined,
    });
    return { enrolled: result.enrolledPerStudent };
}

/**
 * Re-syncs every student currently assigned to a combination — used
 * after the combination's electives change. Each learner keeps their maths.
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
