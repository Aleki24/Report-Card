/**
 * Which class a learner was in during a term, and who was in a class then.
 *
 * Report cards, mark sheets and positions read classes as they are now. After
 * a promotion that is the wrong room: Grade 7 East holds next year's learners,
 * and last year's sit in Grade 8 East with their marks on Grade 7 exams, so
 * last year's cards could not be printed. A promotion records where every
 * learner came from (`student_promotions.from_stream_id`): for a term of a
 * year the school has promoted, classes are read from it; for a year not yet
 * promoted (or whose promotion was undone), from learners' current classes,
 * as before. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/postgrest';

/** Keeps each `in (…)` list well inside URL limits. */
const ID_CHUNK = 150;

interface HistoryRow { student_id: string; from_stream_id: string }

/** A query `fetchAllRows` can page through. */
type Pageable<T> = { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> };

/** A term's academic year when that year's promotion has run (and not been undone), else null. */
export async function promotedYearOfTerm(db: SupabaseClient, schoolId: string, termId: string): Promise<string | null> {
    const { data: term, error } = await db.from('terms').select('academic_year_id').eq('id', termId).maybeSingle();
    if (error) throw error;
    const yearId = (term?.academic_year_id as string | null | undefined) ?? null;
    if (!yearId) return null;
    const { data: run, error: runError } = await db
        .from('student_promotion_runs')
        .select('id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearId)
        .is('undone_at', null)
        .limit(1)
        .maybeSingle();
    if (runError) throw runError;
    return run ? yearId : null;
}

/**
 * Learners' classes in a promoted year, from the promotion that closed it:
 * learner id → class id. Looked up by learner or by class.
 */
async function classesInYear(
    db: SupabaseClient,
    schoolId: string,
    yearId: string,
    by: { column: 'student_id' | 'from_stream_id'; values: readonly string[] },
): Promise<Map<string, string>> {
    const classOf = new Map<string, string>();
    for (let i = 0; i < by.values.length; i += ID_CHUNK) {
        const chunk = by.values.slice(i, i + ID_CHUNK);
        const { rows, error } = await fetchAllRows<HistoryRow>(() => db
            .from('student_promotions')
            .select('student_id, from_stream_id, student_promotion_runs!inner ( academic_year_id, undone_at )')
            .eq('school_id', schoolId)
            .eq('student_promotion_runs.academic_year_id', yearId)
            .is('student_promotion_runs.undone_at', null)
            .in(by.column, chunk)
            .order('id'));
        if (error) throw error;
        // A learner left pending and decided later has a row in each step, both from the same class.
        for (const row of rows) classOf.set(row.student_id, row.from_stream_id);
    }
    return classOf;
}

/**
 * Who was in these classes during a term: learner id → their class. Null when
 * the term's year has not been promoted, so the classes are still as they are
 * now and callers read current enrolment.
 */
export async function classMembersInTerm(
    db: SupabaseClient,
    schoolId: string,
    termId: string,
    streamIds: readonly string[],
): Promise<Map<string, string> | null> {
    const yearId = await promotedYearOfTerm(db, schoolId, termId);
    if (!yearId) return null;
    return classesInYear(db, schoolId, yearId, { column: 'from_stream_id', values: streamIds });
}

export interface LearnerClassInTerm {
    streamId: string | null;
    /** Read from a promotion: the class as it was that year, not as it is now. */
    historical: boolean;
}

/** The class a learner was in during a term: from the promotion that closed its year, else their class now. */
export async function learnerClassInTerm(
    db: SupabaseClient,
    schoolId: string,
    termId: string,
    learner: { id: string; current_grade_stream_id: string | null },
): Promise<LearnerClassInTerm> {
    const yearId = await promotedYearOfTerm(db, schoolId, termId);
    if (yearId) {
        const then = (await classesInYear(db, schoolId, yearId, { column: 'student_id', values: [learner.id] })).get(learner.id);
        if (then) return { streamId: then, historical: true };
    }
    return { streamId: learner.current_grade_stream_id, historical: false };
}

/**
 * Each learner's class in each promoted year: learner id → year id → class
 * id, for listing a learner's past report cards under the class they sat them in.
 */
export async function learnerClassesByYear(db: SupabaseClient, schoolId: string, studentIds: readonly string[]): Promise<Map<string, Map<string, string>>> {
    const byLearner = new Map<string, Map<string, string>>();
    for (let i = 0; i < studentIds.length; i += ID_CHUNK) {
        const chunk = studentIds.slice(i, i + ID_CHUNK);
        const { rows, error } = await fetchAllRows<HistoryRow & { student_promotion_runs: { academic_year_id: string } | { academic_year_id: string }[] }>(() => db
            .from('student_promotions')
            .select('student_id, from_stream_id, student_promotion_runs!inner ( academic_year_id, undone_at )')
            .eq('school_id', schoolId)
            .is('student_promotion_runs.undone_at', null)
            .in('student_id', chunk)
            .order('id'));
        if (error) throw error;
        for (const row of rows) {
            const run = Array.isArray(row.student_promotion_runs) ? row.student_promotion_runs[0] : row.student_promotion_runs;
            if (!run) continue;
            const years = byLearner.get(row.student_id) ?? new Map<string, string>();
            years.set(run.academic_year_id, row.from_stream_id);
            byLearner.set(row.student_id, years);
        }
    }
    return byLearner;
}

/**
 * The learners of a class for a term's documents (report cards, mark sheets,
 * comments, the learner picker): who was in it then when the term's year has
 * been promoted, whatever has become of them since; otherwise the learners in
 * it now (`current`), as before. Rows of `students` with `select`.
 */
export async function classLearnersInTerm<T>(
    db: SupabaseClient,
    opts: { schoolId: string; termId: string; streamId: string; select: string; current: 'active' | 'any' },
): Promise<{ rows: T[]; historical: boolean }> {
    // Only this school's class, whatever the caller already checked.
    const { data: stream, error: streamError } = await db.from('grade_streams').select('id').eq('id', opts.streamId).eq('school_id', opts.schoolId).maybeSingle();
    if (streamError) throw streamError;
    if (!stream) return { rows: [], historical: false };
    const then = await classMembersInTerm(db, opts.schoolId, opts.termId, [opts.streamId]);
    if (then) {
        const ids = [...then.keys()];
        const rows: T[] = [];
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const { data, error } = await db.from('students').select(opts.select).in('id', ids.slice(i, i + ID_CHUNK)).order('id');
            if (error) throw error;
            rows.push(...((data ?? []) as unknown as T[]));
        }
        return { rows, historical: true };
    }
    const { rows, error } = await fetchAllRows<T>(() => {
        let query = db.from('students').select(opts.select).eq('current_grade_stream_id', opts.streamId);
        // Learners who left (transferred, graduated) are not printed or ranked.
        if (opts.current === 'active') query = query.eq('status', 'ACTIVE');
        // The columns are the caller's, so the rows are typed by the caller too.
        return query.order('id') as unknown as Pageable<T>;
    });
    if (error) throw error;
    return { rows, historical: false };
}
