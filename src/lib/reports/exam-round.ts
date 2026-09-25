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
 * the most recent one that is substantially entered — and drops everything
 * else, so subject rows, the mean and the ranking all describe the same sitting.
 *
 * "Substantially entered" matters because a round's exams are set up ahead of
 * time with future dates: one subject's marks keyed into the End Term by
 * mistake (or the first subject of a round still being entered) made that
 * round the most recent, and the default download printed a one-subject sheet
 * while the Midterm with every subject sat behind it.
 */

import { getExamType } from '@/lib/exam-types';

/**
 * supabase-js types an embedded relation as an array in some selects and an
 * object in others, so the exam is read defensively rather than typed.
 */
interface ExamStamp {
    id?: string | null;
    exam_type?: string | null;
    exam_date?: string | null;
    created_at?: string | null;
    subjects?: { id?: string | null } | { id?: string | null }[] | null;
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
 * A round counts as substantially entered when it covers at least this share
 * of the subjects in the fullest round of the term.
 */
const MIN_SUBJECT_SHARE = 0.5;

/** The subject a mark is for — the subject id, else the exam (one per subject). */
function subjectKey(exam: ExamStamp | null): string | null {
    const subject = Array.isArray(exam?.subjects) ? exam?.subjects[0] : exam?.subjects;
    return subject?.id || exam?.id || null;
}

/**
 * Narrow a term's marks to the most recent round that is substantially entered.
 * Marks whose exam has no `exam_type` are left alone (nothing to group on).
 */
export function selectExamRound<T>(marks: T[]): ExamRoundSelection<T> {
    const rounds = new Map<string, { latest: number; subjects: Set<string> }>();
    for (const m of marks) {
        const exam = examOf(m);
        const type = exam?.exam_type;
        if (!type) continue;
        const round = rounds.get(type) ?? { latest: -Infinity, subjects: new Set<string>() };
        round.latest = Math.max(round.latest, sittingTime(exam));
        const subject = subjectKey(exam);
        if (subject) round.subjects.add(subject);
        rounds.set(type, round);
    }
    if (rounds.size === 0) return { round: null, marks };

    const fullest = Math.max(...[...rounds.values()].map(r => r.subjects.size));
    const needed = Math.max(1, Math.ceil(fullest * MIN_SUBJECT_SHARE));

    let round: string | null = null;
    let latest = -Infinity;
    for (const [type, stats] of rounds) {
        // Without subject information every round counts, as before.
        if (fullest > 0 && stats.subjects.size < needed) continue;
        // A genuine tie still needs an answer that does not depend on row order.
        if (stats.latest > latest || (stats.latest === latest && laterInTerm(type, round))) {
            latest = stats.latest;
            round = type;
        }
    }

    if (!round) return { round: null, marks };
    return { round, marks: marks.filter(m => examOf(m)?.exam_type === round) };
}

/**
 * A report's title naming the sitting it shows — "Term 3 · Midterm" — so a
 * card or mark sheet says which exam it is based on. The title used to be the
 * term alone, and a report built on the default round gave no hint of which
 * round had been picked. A custom title is left exactly as typed.
 */
export function titleWithRound(title: string, round: string | null, customTitle?: string | null): string {
    if (customTitle || !round) return title;
    const label = getExamType(round)?.shortName ?? round;
    return `${title} · ${label}`;
}

/** One sitting a class can be reported on, as /api/reports/rounds lists it. */
export interface ReportRound {
    exam_type: string;
    /** "Midterm", "Endterm", … */
    label: string;
    /** Subjects the class has an exam for in this round. */
    subjects_total: number;
    /** Of those, subjects with at least one mark entered. */
    subjects_with_marks: number;
    marks: number;
    /** The round's sitting date (YYYY-MM-DD), when known. */
    date: string | null;
}

export interface ReportRoundsResponse {
    rounds: ReportRound[];
    /** What "most recent" resolves to — the same rule the report routes apply. */
    suggested: string | null;
}
