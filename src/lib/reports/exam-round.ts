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
interface ExamStamp {
    exam_type?: string | null;
    exam_date?: string | null;
    created_at?: string | null;
}

function examOf(mark: unknown): ExamStamp | null {
    const exams = (mark as { exams?: unknown } | null)?.exams;
    if (!exams) return null;
    return (Array.isArray(exams) ? exams[0] : exams) as ExamStamp;
}

/**
 * When the sitting happened, not when the row was typed in.
 *
 * created_at is a record-keeping timestamp, and exams are routinely created in
 * one batch: every Form 3 exam for a term — Opener, Mid Term, Mock, End Term —
 * shares a single created_at to the microsecond. Ordering by it then says
 * nothing, and the old "first seen wins" tie-break handed the choice to
 * whatever order the database returned rows in, which no query here fixes. Two
 * documents for the same class could describe different sittings.
 */
function sittingTime(exam: ExamStamp | null): number {
    const when = exam?.exam_date || exam?.created_at;
    return when ? new Date(when).getTime() : 0;
}

/**
 * Where a round falls within a term, for the rare tie dates cannot settle.
 *
 * Only the sequence nobody disputes is ranked. CAT, zonal, county and mock
 * sittings land wherever a school puts them, so they get no invented place and
 * fall back to their name — deterministic, which is all a tie-break owes.
 */
const TERM_SEQUENCE: Record<string, number> = { OPENER: 1, MIDTERM: 2, ENDTERM: 3 };

/** True when round `a` should be preferred over round `b` at the same time. */
function laterInTerm(a: string, b: string | null): boolean {
    if (b === null) return true;
    const byPlace = (TERM_SEQUENCE[a] ?? 0) - (TERM_SEQUENCE[b] ?? 0);
    return byPlace !== 0 ? byPlace > 0 : a > b;
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
        const exam = examOf(m);
        const when = sittingTime(exam);
        const type = exam?.exam_type ?? null;
        // A genuine tie still needs an answer that does not depend on row order.
        if (when > latest || (when === latest && type !== null && laterInTerm(type, round))) {
            latest = when;
            round = type;
        }
    }

    if (!round) return { round: null, marks };
    return { round, marks: marks.filter(m => examOf(m)?.exam_type === round) };
}
