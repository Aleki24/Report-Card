/**
 * Picking ONE round of exams for a report card.
 *
 * A term normally holds several rounds per subject — Opener, Mid Term, End
 * Term, Mock. A report card must show a single round, otherwise it is not a
 * report of anything: previously, when no round was chosen explicitly, the
 * single-student route let every subject pick its own most-recent exam (so a
 * card could show End Term Maths beside Mid Term English) and the class route
 * averaged every round together into one mean.
 *
 * When the caller names a round the routes filter by it directly and this is
 * not used. When they don't, this resolves the round the report should show —
 * the one containing the most recently created exam — and drops everything
 * else, so subject rows, the mean and the ranking all describe the same sitting.
 */

/**
 * supabase-js types an embedded relation as an array in some selects and an
 * object in others, so the exam is read defensively rather than typed.
 */
function examOf(mark: unknown): { exam_type?: string | null; created_at?: string | null } | null {
    const exams = (mark as { exams?: unknown } | null)?.exams;
    if (!exams) return null;
    return (Array.isArray(exams) ? exams[0] : exams) as { exam_type?: string | null; created_at?: string | null };
}

export interface ExamRoundSelection<T> {
    /** The exam_type every returned mark belongs to, or null when unknown. */
    round: string | null;
    marks: T[];
}

/**
 * Narrow a term's marks to the single most recent round.
 * Marks whose exam has no `exam_type` are left alone (nothing to group on).
 */
export function selectExamRound<T>(marks: T[]): ExamRoundSelection<T> {
    const typed = marks.filter(m => examOf(m)?.exam_type);
    if (typed.length === 0) return { round: null, marks };

    let round: string | null = null;
    let latest = -Infinity;
    for (const m of typed) {
        // Exams created in the same batch can share a timestamp; ties keep the
        // first seen, which is stable because the caller's ordering is stable.
        const exam = examOf(m);
        const created = new Date(exam?.created_at || 0).getTime();
        if (created > latest) {
            latest = created;
            round = exam?.exam_type ?? null;
        }
    }

    if (!round) return { round: null, marks };
    return { round, marks: marks.filter(m => examOf(m)?.exam_type === round) };
}
