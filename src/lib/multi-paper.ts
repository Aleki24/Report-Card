/**
 * multi-paper.ts
 * Reusable logic for OPTIONAL multi-paper (multi-component) subjects.
 *
 * A subject in an exam is either:
 *  - single_paper (default) — one raw mark, exactly the existing flow; or
 *  - multi_paper — the teacher enters one mark per paper (P1/P2/P3…) and
 *    the papers are resolved into ONE final subject percentage using a
 *    configurable aggregation method.
 *
 * The resolved result is stored in exam_marks normalised to the exam's
 * max_score (raw_score = finalPct/100 × max_score, percentage = finalPct),
 * so grading, analytics, ranking, report cards and PDFs keep consuming a
 * single resolved subject score with no special-casing.
 */

import type {
    AggregationMethod,
    AssessmentMode,
    ExamSubjectComponentScheme,
    GradingScale,
} from '@/types';
import { getGradeFromScales } from '@/lib/analytics';

/* ── Aggregation method catalogue ───────────────────────── */

export const AGGREGATION_METHODS: {
    value: AggregationMethod;
    label: string;
    description: string;
}[] = [
    {
        value: 'sum_then_percentage',
        label: 'Sum of papers ÷ total max',
        description: 'Final % = (P1 + P2 + …) ÷ (max1 + max2 + …) × 100. Typical for Mathematics (P1 + P2).',
    },
    {
        value: 'languages_average_percentages',
        label: 'Average of paper percentages',
        description: 'Each paper is converted to a % first, then averaged. Typical for English / Kiswahili (P1 + P2 + P3).',
    },
    {
        value: 'science_70_plus_practical',
        label: 'Theory 70% + practical 30%',
        description: 'All papers except the last count as theory scaled to 70; the last paper is the practical scaled to 30. Typical for Biology / Chemistry / Physics.',
    },
];

export function getAggregationMethodLabel(method: AggregationMethod): string {
    return AGGREGATION_METHODS.find(m => m.value === method)?.label || method;
}

/* ── Composite score calculation ────────────────────────── */

export interface ComponentScoreInput {
    /** DB id when available (used to key mark rows) */
    componentId?: string;
    code: string;
    name?: string;
    maxScore: number;
    /** Raw score for this paper; null/undefined = not entered yet */
    score: number | null | undefined;
    displayOrder?: number;
}

export interface ComponentBreakdownEntry {
    componentId?: string;
    code: string;
    name?: string;
    score: number;
    maxScore: number;
    percentage: number;
    entered: boolean;
}

export interface CompositeScoreResult {
    /** Final resolved subject percentage (0–100, 2 dp) */
    finalPercentage: number;
    /** Sum of entered paper raw scores */
    totalRawScore: number;
    /** Sum of all paper max scores */
    totalPossible: number;
    breakdown: ComponentBreakdownEntry[];
    enteredCount: number;
    /** True when every defined paper has a score */
    isComplete: boolean;
    /** Grade symbol when grading scales were provided */
    gradeSymbol?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve per-paper marks into one final subject percentage.
 * Missing papers count as 0 (the result is flagged incomplete).
 */
export function calculateCompositeSubjectScore(
    components: ComponentScoreInput[],
    method: AggregationMethod,
    scales?: GradingScale[]
): CompositeScoreResult {
    const ordered = [...components].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );

    const breakdown: ComponentBreakdownEntry[] = ordered.map(c => {
        const entered = c.score !== null && c.score !== undefined && !isNaN(Number(c.score));
        const score = entered ? Number(c.score) : 0;
        const maxScore = Number(c.maxScore) || 0;
        return {
            componentId: c.componentId,
            code: c.code,
            name: c.name,
            score,
            maxScore,
            percentage: maxScore > 0 ? round2((score / maxScore) * 100) : 0,
            entered,
        };
    });

    const totalRawScore = round2(breakdown.reduce((s, c) => s + c.score, 0));
    const totalPossible = round2(breakdown.reduce((s, c) => s + c.maxScore, 0));
    const enteredCount = breakdown.filter(c => c.entered).length;

    // A student may have only some of the papers entered (e.g. Paper 1 sat,
    // Paper 2 still to come). Rather than counting the missing papers as 0 —
    // which unfairly tanks the score — the final percentage is computed over
    // ONLY the entered papers, re-normalised to their configured ratio. When
    // every paper is entered this is identical to the full calculation, so
    // complete results are unaffected; partial results read as clear,
    // proportional marks. `isComplete` still flags whether all papers are in.
    const enteredEntries = breakdown.filter(c => c.entered);

    let finalPercentage = 0;

    if (enteredEntries.length > 0) {
        switch (method) {
            case 'languages_average_percentages': {
                finalPercentage = enteredEntries.reduce((s, c) => s + c.percentage, 0) / enteredEntries.length;
                break;
            }
            case 'science_70_plus_practical': {
                if (breakdown.length < 2) {
                    // Can't split theory/practical with one paper — plain percentage
                    const max = enteredEntries.reduce((s, c) => s + c.maxScore, 0);
                    const raw = enteredEntries.reduce((s, c) => s + c.score, 0);
                    finalPercentage = max > 0 ? (raw / max) * 100 : 0;
                    break;
                }
                // Last paper is the practical (30), the rest are theory (70).
                // Missing side drops out and the remaining side is re-normalised
                // to 100 so a theory-only or practical-only entry stays fair.
                const practical = breakdown[breakdown.length - 1];
                const theory = breakdown.slice(0, -1).filter(c => c.entered);
                const theoryMax = theory.reduce((s, c) => s + c.maxScore, 0);
                const theoryRaw = theory.reduce((s, c) => s + c.score, 0);
                const theoryWeight = theory.length > 0 && theoryMax > 0 ? 70 : 0;
                const practicalWeight = practical.entered && practical.maxScore > 0 ? 30 : 0;
                const totalWeight = theoryWeight + practicalWeight;
                if (totalWeight > 0) {
                    const theoryContribution = theoryWeight > 0 ? (theoryRaw / theoryMax) * theoryWeight : 0;
                    const practicalContribution = practicalWeight > 0 ? (practical.score / practical.maxScore) * practicalWeight : 0;
                    finalPercentage = ((theoryContribution + practicalContribution) / totalWeight) * 100;
                }
                break;
            }
            case 'sum_then_percentage':
            default: {
                const max = enteredEntries.reduce((s, c) => s + c.maxScore, 0);
                const raw = enteredEntries.reduce((s, c) => s + c.score, 0);
                finalPercentage = max > 0 ? (raw / max) * 100 : 0;
                break;
            }
        }
    }

    finalPercentage = round2(Math.min(100, Math.max(0, finalPercentage)));

    return {
        finalPercentage,
        totalRawScore,
        totalPossible,
        breakdown,
        enteredCount,
        isComplete: enteredCount === breakdown.length && breakdown.length > 0,
        gradeSymbol: scales && scales.length > 0 ? getGradeFromScales(finalPercentage, scales) : undefined,
    };
}

/**
 * Convert a resolved final percentage into the raw_score stored in
 * exam_marks (normalised to the exam's max_score) so every existing
 * raw/max consumer stays correct.
 */
export function normalizeResolvedRawScore(finalPercentage: number, examMaxScore: number): number {
    return round2((finalPercentage / 100) * (Number(examMaxScore) || 100));
}

/* ── Assessment mode resolution ─────────────────────────── */

/**
 * Decide the effective assessment mode for an exam subject.
 * Anything without a valid, enabled multi-paper scheme (≥2 papers)
 * behaves exactly like the legacy single-paper flow.
 */
export function resolveAssessmentMode(
    scheme?: Pick<ExamSubjectComponentScheme, 'assessment_mode' | 'is_enabled' | 'components'> | null
): AssessmentMode {
    if (
        scheme &&
        scheme.is_enabled &&
        scheme.assessment_mode === 'multi_paper' &&
        (scheme.components?.length ?? 0) >= 2
    ) {
        return 'multi_paper';
    }
    return 'single_paper';
}

export function isMultiPaper(
    scheme?: Pick<ExamSubjectComponentScheme, 'assessment_mode' | 'is_enabled' | 'components'> | null
): boolean {
    return resolveAssessmentMode(scheme) === 'multi_paper';
}

/* ── Subject presets (editable convenience defaults) ────── */

export interface SubjectPaperPreset {
    presetKey: string;
    label: string;
    aggregation_method: AggregationMethod;
    components: { component_code: string; component_name: string; max_score: number }[];
}

// KCSE-style default paper structures. These are ONLY presets — the
// saved per-exam configuration is what drives behaviour, and every
// field remains editable in the UI.
export const SUBJECT_PAPER_PRESETS: SubjectPaperPreset[] = [
    {
        presetKey: 'mathematics',
        label: 'Mathematics — 2 papers, sum ÷ total',
        aggregation_method: 'sum_then_percentage',
        components: [
            { component_code: 'P1', component_name: 'Paper 1', max_score: 100 },
            { component_code: 'P2', component_name: 'Paper 2', max_score: 100 },
        ],
    },
    {
        presetKey: 'english',
        label: 'English — 3 papers, average of %',
        aggregation_method: 'languages_average_percentages',
        components: [
            { component_code: 'P1', component_name: 'Paper 1 (Functional Skills)', max_score: 60 },
            { component_code: 'P2', component_name: 'Paper 2 (Comprehension & Grammar)', max_score: 80 },
            { component_code: 'P3', component_name: 'Paper 3 (Creative Composition)', max_score: 60 },
        ],
    },
    {
        presetKey: 'kiswahili',
        label: 'Kiswahili — 3 papers, average of %',
        aggregation_method: 'languages_average_percentages',
        components: [
            { component_code: 'P1', component_name: 'Karatasi 1 (Insha)', max_score: 40 },
            { component_code: 'P2', component_name: 'Karatasi 2 (Lugha)', max_score: 80 },
            { component_code: 'P3', component_name: 'Karatasi 3 (Fasihi)', max_score: 80 },
        ],
    },
    {
        presetKey: 'biology',
        label: 'Biology — theory 70% + practical 30%',
        aggregation_method: 'science_70_plus_practical',
        components: [
            { component_code: 'P1', component_name: 'Paper 1 (Theory)', max_score: 80 },
            { component_code: 'P2', component_name: 'Paper 2 (Theory)', max_score: 80 },
            { component_code: 'P3', component_name: 'Paper 3 (Practical)', max_score: 40 },
        ],
    },
    {
        presetKey: 'chemistry',
        label: 'Chemistry — theory 70% + practical 30%',
        aggregation_method: 'science_70_plus_practical',
        components: [
            { component_code: 'P1', component_name: 'Paper 1 (Theory)', max_score: 80 },
            { component_code: 'P2', component_name: 'Paper 2 (Theory)', max_score: 80 },
            { component_code: 'P3', component_name: 'Paper 3 (Practical)', max_score: 40 },
        ],
    },
    {
        presetKey: 'physics',
        label: 'Physics — theory 70% + practical 30%',
        aggregation_method: 'science_70_plus_practical',
        components: [
            { component_code: 'P1', component_name: 'Paper 1 (Theory)', max_score: 80 },
            { component_code: 'P2', component_name: 'Paper 2 (Theory)', max_score: 80 },
            { component_code: 'P3', component_name: 'Paper 3 (Practical)', max_score: 40 },
        ],
    },
];

/**
 * Suggest a paper preset from a subject name. Matches across levels —
 * e.g. 8-4-4 'English' (101), CBC Senior 'English' (ENG_SS),
 * 'Mathematics Alternative A' (121), 'Mathematics (STEM)' (MATH_SS),
 * 'Kiswahili Kipevu' (KK_SS), 'Biology'/'Chemistry'/'Physics' in both
 * Form 3–4 and Grades 10–12. Returns null when no preset applies —
 * the subject can still be configured manually.
 */
export function getSubjectPresetForPapers(subjectName: string): SubjectPaperPreset | null {
    const n = (subjectName || '').trim().toLowerCase();
    if (!n) return null;

    const find = (key: string) => SUBJECT_PAPER_PRESETS.find(p => p.presetKey === key) || null;

    if (n.includes('math')) return find('mathematics');
    if (n.includes('kiswahili')) return find('kiswahili');
    // 'Literature in English' is a distinct subject — don't force the English preset on it
    if (n.includes('english') && !n.includes('literature')) return find('english');
    if (n.includes('biology')) return find('biology');
    if (n.includes('chemistry')) return find('chemistry');
    if (n.includes('physics')) return find('physics');

    return null;
}
