import type { SupabaseClient } from '@supabase/supabase-js';
import { isSeniorSchoolGrade, type GradeLike } from '@/lib/curriculum-bands';
import { SENIOR_CORE_SUBJECT_CODES, isMathsCode } from '@/lib/pathway-definitions';
import { embedOne, fetchAllRows } from '@/lib/postgrest';

/**
 * Which electives a Senior School (Grade 10–12) class actually takes.
 *
 * A school switches on the whole Senior School catalogue so every pathway is
 * available, but each class only sits the electives its learners chose.
 * Seeding an exam slot for every offered subject put thirty-odd papers into
 * every Grade 10 class, most of which nobody teaches there.
 *
 * An elective counts as taught in a class when any of these say so:
 *  - a learner in the class is enrolled in it (`student_subjects`; giving a
 *    learner a subject combination enrols them in its subjects),
 *  - a teacher is assigned to teach it in that class,
 *  - it already has marks there (never hide work that was entered).
 * Core subjects and mathematics are always taught. A combination nobody in
 * the class has chosen doesn't count: the class lists what its learners take.
 *
 * A class with no enrolment or assignment at all has not been set up for
 * pathways yet; it keeps every offered subject rather than showing none.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface SubjectRef {
    id: string;
    code: string;
    subject_type?: string | null;
}

export interface SeniorGrade extends GradeLike {
    id: string;
}

/** A many-to-one embed; supabase-js infers an array, PostgREST returns one row. */
type StreamEmbed = { current_grade_stream_id: string };
type EnrolmentRow = { subject_id: string; students: StreamEmbed | StreamEmbed[] };

/** Elective subject ids per restricted grade; grades not in the map are not restricted. */
export type SeniorTaughtMap = ReadonlyMap<string, ReadonlySet<string>>;

export async function seniorSubjectsTaught(supabase: Db, schoolId: string, grades: readonly SeniorGrade[]): Promise<SeniorTaughtMap> {
    const gradeIds = grades.filter(g => isSeniorSchoolGrade(g)).map(g => g.id);
    if (gradeIds.length === 0) return new Map();

    const { data: streams, error: streamError } = await supabase
        .from('grade_streams')
        .select('id, grade_id')
        .eq('school_id', schoolId)
        .in('grade_id', gradeIds)
        .returns<{ id: string; grade_id: string }[]>();
    if (streamError) throw new Error(`Failed to load classes: ${streamError.message}`);
    const gradeOfStream = new Map((streams ?? []).map(s => [s.id, s.grade_id]));

    const [enrolled, assigned, marked] = await Promise.all([
        gradeOfStream.size === 0
            ? Promise.resolve([] as EnrolmentRow[])
            : fetchAllRows<EnrolmentRow>(() => supabase
                .from('student_subjects')
                .select('subject_id, students!inner(current_grade_stream_id)')
                .in('students.current_grade_stream_id', [...gradeOfStream.keys()])
                .order('id')).then(throwOr('subject enrolments')),
        fetchAllRows<{ subject_id: string; grade_id: string }>(() => supabase
            .from('subject_teacher_assignments')
            // grades are shared between schools, so scope through the school's academic years
            .select('subject_id, grade_id, academic_years!inner(school_id)')
            .eq('academic_years.school_id', schoolId)
            .in('grade_id', gradeIds)
            .order('id')).then(throwOr('teacher assignments')),
        fetchAllRows<{ subject_id: string; grade_id: string }>(() => supabase
            .from('exams')
            .select('subject_id, grade_id, exam_marks!inner(id)')
            .eq('school_id', schoolId)
            .in('grade_id', gradeIds)
            .limit(1, { referencedTable: 'exam_marks' })
            .order('id')).then(throwOr('marked exams')),
    ]);

    const signalled = new Map<string, Set<string>>();
    const add = (gradeId: string | undefined, subjectId: string) => {
        if (!gradeId) return;
        const set = signalled.get(gradeId) ?? new Set<string>();
        set.add(subjectId);
        signalled.set(gradeId, set);
    };
    for (const e of enrolled) {
        const streamId = embedOne(e.students)?.current_grade_stream_id;
        if (streamId) add(gradeOfStream.get(streamId), e.subject_id);
    }
    for (const a of assigned) add(a.grade_id, a.subject_id);

    // Marks only widen a grade that is already restricted; on their own they
    // would hide every unmarked subject of a school that hasn't set up pathways.
    for (const m of marked) signalled.get(m.grade_id)?.add(m.subject_id);
    return signalled;
}

/** Whether a class takes this subject. */
export function isTaughtInGrade(taught: SeniorTaughtMap, gradeId: string, subject: SubjectRef): boolean {
    const electives = taught.get(gradeId);
    if (!electives) return true;
    const code = subject.code.trim().toUpperCase();
    return subject.subject_type === 'CORE'
        || (SENIOR_CORE_SUBJECT_CODES as readonly string[]).includes(code)
        || isMathsCode(code)
        || electives.has(subject.id);
}

function throwOr(what: string) {
    return <T>({ rows, error }: { rows: T[]; error: unknown }): T[] => {
        if (error) throw new Error(`Failed to load ${what}: ${(error as { message?: string }).message ?? 'unknown error'}`);
        return rows;
    };
}
