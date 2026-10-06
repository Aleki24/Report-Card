/**
 * A class broadsheet: every learner against every subject for one exam (or
 * the best mark across a term's exams), with average and position. Shared by
 * the web's All subjects view and the app's, so both show the same numbers.
 */
import { getExamType, getExamTypeName } from './exam-types';

/** One row of GET /api/school/exam-marks/stream (the parts used here). */
export interface BroadsheetMark {
    student_id: string;
    percentage: number | string | null;
    grade_symbol: string | null;
    students: { admission_number: string | null; users: { first_name: string | null; last_name: string | null } | null } | null;
    exams: {
        exam_type: string | null;
        term_id: string | null;
        subjects: { code?: string | null; name: string | null } | null;
    } | null;
}

export interface BroadsheetCell {
    score: number;
    grade: string;
    /** The subject's full name, for a tooltip under its short code. */
    name: string;
}

export interface BroadsheetRow {
    studentId: string;
    name: string;
    admNo: string;
    subjects: Record<string, BroadsheetCell>;
    total: number;
    average: number;
    rank: number;
}

/** Which marks to show: a term, and one exam type in it or (null) the best of them all. */
export interface BroadsheetFilter {
    termId: string | null;
    examType: string | null;
}

/** "All exams" in a term: each subject's best mark across them. */
export const ALL_EXAMS = '';

/** The exam types with marks in a term, in the school year's order (Opener, Mid-Term, End-Term…). */
export function broadsheetExamTypes(marks: readonly BroadsheetMark[], termId: string | null): string[] {
    const types = new Set<string>();
    for (const m of marks) {
        if (m.exams?.exam_type && (!termId || m.exams.term_id === termId)) types.add(m.exams.exam_type);
    }
    return [...types].sort((a, b) => (getExamType(a)?.order ?? 99) - (getExamType(b)?.order ?? 99) || a.localeCompare(b));
}

/** Term ids with any marks for the class. */
export const broadsheetTermIds = (marks: readonly BroadsheetMark[]): Set<string> =>
    new Set(marks.map((m) => m.exams?.term_id).filter((t): t is string => !!t));

/**
 * The term and exam to open on: the given term if it has marks, else the
 * latest term in `termOrder` that does; and that term's latest exam.
 */
export function defaultBroadsheetFilter(marks: readonly BroadsheetMark[], termOrder: readonly string[], preferredTermId: string | null): BroadsheetFilter {
    const withMarks = broadsheetTermIds(marks);
    const termId = preferredTermId && withMarks.has(preferredTermId)
        ? preferredTermId
        : [...termOrder].reverse().find((t) => withMarks.has(t)) ?? [...withMarks][0] ?? null;
    const types = broadsheetExamTypes(marks, termId);
    return { termId, examType: types[types.length - 1] ?? null };
}

/** "Mid-Term Exam", or "All exams (best mark)". */
export const broadsheetExamName = (examType: string | null) => (examType ? getExamTypeName(examType) : 'All exams (best mark)');

/** The rows for a filter: each learner's mark per subject, average over the subjects entered, and position. */
export function buildBroadsheet(marks: readonly BroadsheetMark[], filter: BroadsheetFilter): { rows: BroadsheetRow[]; subjects: string[]; subjectNames: Record<string, string> } {
    const byStudent = new Map<string, Omit<BroadsheetRow, 'total' | 'average' | 'rank' | 'studentId'>>();
    const subjectNames: Record<string, string> = {};
    for (const m of marks) {
        const exam = m.exams;
        if (!m.students || !exam?.subjects) continue;
        if (filter.termId && exam.term_id !== filter.termId) continue;
        if (filter.examType && exam.exam_type !== filter.examType) continue;
        const code = exam.subjects.code || exam.subjects.name;
        const pct = Number(m.percentage);
        if (!code || m.percentage === null || !Number.isFinite(pct)) continue;
        subjectNames[code] = exam.subjects.name || code;
        const entry = byStudent.get(m.student_id) ?? {
            name: `${m.students.users?.first_name ?? ''} ${m.students.users?.last_name ?? ''}`.trim() || 'Unknown',
            admNo: m.students.admission_number ?? '',
            subjects: {},
        };
        const existing = entry.subjects[code];
        if (!existing || pct > existing.score) entry.subjects[code] = { score: pct, grade: m.grade_symbol || '–', name: subjectNames[code] };
        byStudent.set(m.student_id, entry);
    }
    const subjects = Object.keys(subjectNames).sort();
    const rows: BroadsheetRow[] = [...byStudent.entries()].map(([studentId, s]) => {
        const scores = Object.values(s.subjects).map((x) => x.score);
        const total = scores.reduce((a, b) => a + b, 0);
        return { studentId, ...s, total: Math.round(total), average: scores.length ? Math.round(total / scores.length) : 0, rank: 0 };
    });
    rows.sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
    rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1].average === row.average ? rows[i - 1].rank : i + 1; });
    return { rows, subjects, subjectNames };
}
