/**
 * Academic helpers mirrored from the web app: exam type labels
 * (`src/lib/exam-types.ts`), active-term detection (`src/lib/term-calendar.ts`)
 * and grade resolution from a school's grading scales (as done in the web's
 * ManualEntryGrid). Kept small and pure so both role trees can share them.
 */

import type { ExamPaperScheme, GradingScale, GradingSystem, Term } from './types';

interface ExamTypeMeta {
    name: string;
    shortName: string;
    icon: string;
    order: number;
}

const EXAM_TYPES: Record<string, ExamTypeMeta> = {
    OPENER: { name: 'Opening Exam', shortName: 'Opener', icon: '📝', order: 1 },
    MIDTERM: { name: 'Mid-Term Exam', shortName: 'Midterm', icon: '📋', order: 2 },
    ENDTERM: { name: 'End-Term Exam', shortName: 'Endterm', icon: '📊', order: 3 },
    CAT: { name: 'Continuous Assessment Test', shortName: 'CAT', icon: '📌', order: 4 },
    TOPICAL: { name: 'Topical Test', shortName: 'Topical', icon: '🏷️', order: 5 },
    CBC: { name: 'CBC Assessment', shortName: 'CBC', icon: '📗', order: 6 },
    '844': { name: '8-4-4 Exam', shortName: '844', icon: '📘', order: 7 },
    'END TERM': { name: 'End Term (Legacy)', shortName: 'End Term', icon: '📊', order: 8 },
    ZONE: { name: 'Zone Exam', shortName: 'Zone', icon: '🔶', order: 9 },
    SUB_COUNTY: { name: 'Sub-County Exam', shortName: 'Sub-County', icon: '🔷', order: 10 },
    COUNTY: { name: 'County Exam', shortName: 'County', icon: '🟣', order: 11 },
    REGIONAL: { name: 'Regional Exam', shortName: 'Regional', icon: '🟡', order: 12 },
    PRE_MOCK: { name: 'Pre-Mock Exam', shortName: 'Pre-Mock', icon: '🔸', order: 13 },
    MOCK: { name: 'Mock Exam', shortName: 'Mock', icon: '🎯', order: 14 },
    POST_MOCK: { name: 'Post-Mock Exam', shortName: 'Post-Mock', icon: '🔹', order: 15 },
};

export function examTypeLabel(code: string): string {
    const meta = EXAM_TYPES[code];
    return meta ? `${meta.icon} ${meta.shortName}` : code;
}

export function examTypeName(code: string): string {
    return EXAM_TYPES[code]?.name ?? code;
}

export function sortExamTypes(codes: Iterable<string>): string[] {
    return [...new Set(codes)].sort((a, b) => (EXAM_TYPES[a]?.order ?? 99) - (EXAM_TYPES[b]?.order ?? 99) || a.localeCompare(b));
}

/** Kenyan calendar: Jan–Apr = Term 1, May–Jul = Term 2, Aug–Dec = Term 3. */
export function currentTermNumber(date: Date = new Date()): number {
    const month = date.getMonth();
    if (month <= 3) return 1;
    if (month <= 6) return 2;
    return 3;
}

/** Same resolution order as the web's findActiveTermId: name, dates, flag, first. */
export function findActiveTermId(terms: readonly Term[], date: Date = new Date()): string | null {
    if (terms.length === 0) return null;
    const n = currentTermNumber(date);
    const byName = terms.find((t) => {
        const lower = t.name.toLowerCase().trim();
        return lower === `term ${n}` || lower === `term${n}` || lower.includes(`term ${n}`) || lower === `${n}`;
    });
    if (byName) return byName.id;
    const now = date.getTime();
    const byDate = terms.find((t) => t.start_date && t.end_date && now >= new Date(t.start_date).getTime() && now <= new Date(t.end_date).getTime());
    if (byDate) return byDate.id;
    return terms.find((t) => t.is_current)?.id ?? terms[0].id;
}

/**
 * The scales a subject's marks are graded on: the subject's own grading
 * system when set, otherwise every SUBJECT-kind system at the exam's
 * academic level (OVERALL systems use point bands and would mis-grade).
 */
export function scalesForSubject(
    systems: readonly GradingSystem[],
    scales: readonly GradingScale[],
    academicLevelId: string | null,
    subjectGradingSystemId: string | null,
): GradingScale[] {
    const subjectSystems = systems.filter((s) => s.system_kind !== 'OVERALL');
    const assigned = subjectGradingSystemId ? subjectSystems.find((s) => s.id === subjectGradingSystemId) : undefined;
    const relevant = assigned
        ? [assigned]
        : academicLevelId
            ? subjectSystems.filter((s) => s.academic_level_id === academicLevelId)
            : subjectSystems;
    const ids = new Set(relevant.map((s) => s.id));
    return scales.filter((sc) => ids.has(sc.grading_system_id));
}

/** Rounded before matching, like the web, so gaps between integer bands resolve the same. */
export function gradeFromPercentage(pct: number, scales: readonly GradingScale[]): string {
    const rounded = Math.round(pct);
    return scales.find((sc) => rounded >= Number(sc.min_percentage) && rounded <= Number(sc.max_percentage))?.symbol ?? '';
}

// ── Multi-paper subjects (mirrors src/lib/multi-paper.ts) ────────


/** Multi-paper only when the scheme is enabled and has at least two papers. */
export function isMultiPaper(scheme: ExamPaperScheme | null | undefined): scheme is ExamPaperScheme {
    return !!scheme && scheme.is_enabled && scheme.assessment_mode === 'multi_paper' && (scheme.components?.length ?? 0) >= 2;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Live preview of the final subject percentage from per-paper scores. The
 * server recomputes this on save; missing papers count as 0, as on the web.
 */
export function compositePercentage(scheme: ExamPaperScheme, scores: Readonly<Record<string, string>>): { percentage: number; entered: number } {
    const papers = [...(scheme.components ?? [])]
        .sort((a, b) => a.display_order - b.display_order)
        .map((c) => {
            const raw = scores[c.id];
            const entered = raw !== undefined && raw.trim() !== '' && !Number.isNaN(Number(raw));
            const max = Number(c.max_score) || 0;
            const score = entered ? Number(raw) : 0;
            return { entered, score, max, pct: max > 0 ? (score / max) * 100 : 0 };
        });
    const entered = papers.filter((p) => p.entered).length;
    if (papers.length === 0) return { percentage: 0, entered };

    const total = papers.reduce((s, p) => s + p.score, 0);
    const possible = papers.reduce((s, p) => s + p.max, 0);
    let pct: number;
    switch (scheme.aggregation_method) {
        case 'languages_average_percentages':
            pct = papers.reduce((s, p) => s + p.pct, 0) / papers.length;
            break;
        case 'science_70_plus_practical': {
            const practical = papers[papers.length - 1];
            const theory = papers.slice(0, -1);
            const theoryMax = theory.reduce((s, p) => s + p.max, 0);
            pct = (theoryMax > 0 ? (theory.reduce((s, p) => s + p.score, 0) / theoryMax) * 70 : 0)
                + (practical.max > 0 ? (practical.score / practical.max) * 30 : 0);
            break;
        }
        default:
            pct = possible > 0 ? (total / possible) * 100 : 0;
    }
    return { percentage: round2(Math.min(100, Math.max(0, pct))), entered };
}
