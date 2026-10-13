/**
 * The admin dashboard's results card, shared by the web and the app: each
 * exam's marks totalled in Postgres (`GET /api/school/analytics?summary=exams`),
 * grouped back into sittings and averaged per subject.
 *
 * The card used to download every mark of the term and add them up in the
 * browser — tens of thousands of rows for a large school, past what one
 * response may carry. A subject's average is the same sum over the same
 * count either way, so totals per exam give exactly the figures the marks did.
 *
 * Client-safe: relative imports only, so the app can share it.
 */
import { gradeSymbolFromScales } from './analytics';
import { shortCurriculumLabel } from './curriculum-labels';
import type { GradeBand } from '../types';

/** One exam's marks, totalled. */
export interface ExamTotal {
    exam_id: string;
    exam_name: string;
    exam_date: string | null;
    subject_id: string | null;
    subject_name: string | null;
    /** Every mark entered, scored or not. */
    mark_count: number;
    /** Marks with a percentage: the ones an average counts. */
    scored_count: number;
    percentage_sum: number;
}

/** A subject as the card groups it: its curriculum and its grading system. */
export interface ResultSubjectMeta {
    id: string;
    name: string;
    academic_level_id: string | null;
    level_code: string | null;
    level_name: string | null;
    grading_system_id: string | null;
}

/** GET /api/school/analytics?summary=exams */
export interface ExamTotalsResponse {
    exams: ExamTotal[];
    subjects: ResultSubjectMeta[];
    gradingScales: Record<string, GradeBand[]>;
}

/** One sitting, e.g. "Term 2 Midterm": the per-subject exams grouped back together. */
export interface ResultSeries {
    key: string;
    name: string;
    /** Latest exam date in the sitting, as a timestamp (0 when undated). */
    date: number;
    examIds: ReadonlySet<string>;
}

export interface SubjectResult {
    /** Subject id where the exam has one; the name is only a fallback key. */
    key: string;
    subject: string;
    levelId: string;
    levelLabel: string;
    avg: number;
    count: number;
    /** Null when the subject has no grading system — never a guess. */
    grade: string | null;
}

export const UNKNOWN_LEVEL = '__unknown__';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The sitting an exam belongs to: its name with the subject taken out
 * ("Term 2 Midterm - English", "Term 2 Midterm (English)"), tolerant of
 * separators and ordering, with leftover punctuation cleaned up.
 */
export function seriesNameOf(examName: string, subjectName: string): string {
    const subj = subjectName.trim();
    const n = (subj ? examName.replace(new RegExp(escapeRe(subj), 'gi'), '') : examName)
        .replace(/\(\s*\)/g, ' ')
        .replace(/\s*[-–—:/]\s*(?=$)/g, '')
        .replace(/^\s*[-–—:/]\s*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    return n || examName;
}

/** Sittings, newest first. Keyed by year too, so a recurring name doesn't merge across years. */
export function resultSeries(exams: readonly ExamTotal[]): ResultSeries[] {
    const byKey = new Map<string, { key: string; name: string; date: number; examIds: Set<string> }>();
    for (const e of exams) {
        const name = seriesNameOf(e.exam_name || 'Exam', e.subject_name || '');
        const time = e.exam_date ? new Date(e.exam_date).getTime() : 0;
        const key = `${name.toLowerCase()}|${time ? new Date(time).getFullYear() : 0}`;
        const cur = byKey.get(key) ?? { key, name, date: 0, examIds: new Set<string>() };
        cur.date = Math.max(cur.date, time);
        cur.examIds.add(e.exam_id);
        byKey.set(key, cur);
    }
    return [...byKey.values()].sort((a, b) => b.date - a.date);
}

/**
 * Subject averages over the given exams, strongest first.
 *
 * Grouped by subject id, not name: a school running both curricula has two
 * subjects called "Agriculture", each on its own scale. The grade is the
 * school's scale applied to the average, not the most common mark's symbol.
 */
export function subjectResults(
    exams: readonly ExamTotal[],
    subjects: ReadonlyMap<string, ResultSubjectMeta>,
    scales: Readonly<Record<string, readonly GradeBand[]>>,
): SubjectResult[] {
    const by = new Map<string, { name: string; meta?: ResultSubjectMeta; sum: number; n: number }>();
    for (const e of exams) {
        if (e.scored_count === 0) continue;
        const meta = e.subject_id ? subjects.get(e.subject_id) : undefined;
        const key = e.subject_id ?? `name:${e.subject_name ?? ''}`;
        const bucket = by.get(key) ?? { name: (meta?.name || e.subject_name || '').trim(), meta, sum: 0, n: 0 };
        bucket.sum += e.percentage_sum;
        bucket.n += e.scored_count;
        by.set(key, bucket);
    }
    return [...by.entries()].map(([key, v]) => {
        const avg = Math.round(v.sum / v.n);
        const system = v.meta?.grading_system_id;
        return {
            key,
            subject: v.name || 'Unknown',
            levelId: v.meta?.academic_level_id ?? UNKNOWN_LEVEL,
            levelLabel: (v.meta && shortCurriculumLabel(v.meta.level_code, v.meta.level_name)) ?? 'Other',
            avg,
            count: v.n,
            grade: system ? gradeSymbolFromScales(avg, scales[system]) : null,
        };
    }).sort((a, b) => b.avg - a.avg);
}
