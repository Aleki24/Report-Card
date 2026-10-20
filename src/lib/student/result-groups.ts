/**
 * A learner's released marks by term, then by exam round (Opener, Mid-term,
 * End-term…), newest round first: the web results page and the app.
 *
 * Listing a term's marks together showed each subject once per round with
 * nothing to tell the rounds apart, and averaged every round into one figure.
 *
 * Client-safe: relative imports only, so the app can share it.
 */
import { getExamType } from '../exam-types';

/** What grouping reads from a released mark. */
export interface GroupableResult {
    percentage: number | string;
    exams: {
        exam_type?: string | null;
        exam_date?: string | null;
        subjects?: { name: string } | null;
        terms?: { id: string; name: string } | null;
        academic_years?: { id: string; name: string } | null;
    } | null;
}

export interface ResultRound<T> {
    key: string;
    /** The round's name, e.g. "Mid-term". */
    label: string;
    /** Its latest exam date. */
    date: string | null;
    /** Subject by subject, alphabetically. */
    items: T[];
    /** Mean percentage of the round's marks, to one decimal. */
    average: number;
}

export interface ResultTerm<T> {
    key: string;
    term: string;
    year: string;
    rounds: ResultRound<T>[];
}

/** Terms in the order their first mark arrives (the API sends newest first). */
export function groupResultsByRound<T extends GroupableResult>(results: readonly T[]): ResultTerm<T>[] {
    const terms = new Map<string, { key: string; term: string; year: string; rounds: Map<string, { label: string; date: string | null; items: T[] }> }>();
    for (const r of results) {
        const ex = r.exams;
        const termKey = `${ex?.academic_years?.id ?? 'x'}_${ex?.terms?.id ?? 'x'}`;
        let t = terms.get(termKey);
        if (!t) {
            t = { key: termKey, term: ex?.terms?.name ?? 'Term', year: ex?.academic_years?.name ?? '', rounds: new Map() };
            terms.set(termKey, t);
        }
        const roundKey = ex?.exam_type ?? 'OTHER';
        let round = t.rounds.get(roundKey);
        if (!round) {
            round = { label: (ex?.exam_type && getExamType(ex.exam_type)?.name) || ex?.exam_type || 'Exam', date: ex?.exam_date ?? null, items: [] };
            t.rounds.set(roundKey, round);
        }
        round.items.push(r);
        if (ex?.exam_date && (!round.date || ex.exam_date > round.date)) round.date = ex.exam_date;
    }
    return [...terms.values()].map(t => ({
        key: t.key,
        term: t.term,
        year: t.year,
        rounds: [...t.rounds.entries()]
            .map(([key, rd]) => ({
                key,
                label: rd.label,
                date: rd.date,
                items: [...rd.items].sort((a, b) => (a.exams?.subjects?.name ?? '').localeCompare(b.exams?.subjects?.name ?? '')),
                average: Math.round((rd.items.reduce((n, i) => n + Number(i.percentage), 0) / rd.items.length) * 10) / 10,
            }))
            .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }));
}
