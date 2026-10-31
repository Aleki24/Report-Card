/**
 * End-of-year promotion: what happens to each grade's learners, and the rules
 * a plan must keep. Client-safe; the server re-checks every plan with the
 * same functions before applying it (`promotion-server.ts`).
 *
 * Each grade the school teaches takes one of three steps:
 *   PROMOTE     the next grade is taught here, so learners move up a class.
 *   TRANSITION  the next grade starts a new level learners are placed into
 *               nationally (Grade 9 → Senior School). Staying is never
 *               assumed: the school decides learner by learner, and only a
 *               school that teaches the next grade can keep anyone.
 *   COMPLETE    candidates of the school's last grade (Grade 12, Form 4), or
 *               a grade whose next grade the school doesn't teach: learners
 *               are archived as graduated.
 * Any learner can instead repeat the year or be marked as transferred out.
 */
import { z } from 'zod';
import { bandForGrade, type CurriculumBand, type GradeLike } from './curriculum-bands';

export const PROMOTION_URL = '/api/admin/promotion';

export const PROMOTION_OUTCOMES = ['PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER'] as const;
export type PromotionOutcome = (typeof PROMOTION_OUTCOMES)[number];

/**
 * Level changes where learners are placed in a new school by the ministry,
 * so a school that teaches both levels still can't assume they stay.
 */
const TRANSITIONS: Partial<Record<CurriculumBand, CurriculumBand>> = {
    CBC_JUNIOR_SCHOOL: 'CBC_SENIOR_SCHOOL',
    '844_PRIMARY': '844_SECONDARY',
};

const TRANSITION_LEVEL_NAMES: Partial<Record<CurriculumBand, string>> = {
    CBC_SENIOR_SCHOOL: 'Senior School',
    '844_SECONDARY': 'secondary school',
};

export type GradeStep =
    | { kind: 'PROMOTE'; nextGradeId: string; nextGradeName: string }
    | {
        kind: 'TRANSITION';
        nextGradeId: string;
        nextGradeName: string;
        /** "Senior School": the level the next grade starts. */
        nextLevelName: string;
        /** Whether the school teaches the next grade, so learners can stay. */
        canStay: boolean;
    }
    | { kind: 'COMPLETE'; reason: 'FINAL_GRADE' | 'NEXT_NOT_TAUGHT'; nextGradeName: string | null };

export interface StepGrade extends GradeLike {
    id: string;
    name_display: string;
    numeric_order: number;
    academic_level_id: string;
}

/**
 * The step a grade takes, given every grade of the national list and the ids
 * of those the school teaches. The next grade is the one right after it in
 * the same curriculum; one the school doesn't teach (or that no longer runs)
 * can't take learners.
 */
export function gradeStep(grade: StepGrade, allGrades: readonly StepGrade[], taughtGradeIds: ReadonlySet<string>): GradeStep {
    const next = allGrades
        .filter(g => g.academic_level_id === grade.academic_level_id && g.numeric_order > grade.numeric_order)
        .sort((a, b) => a.numeric_order - b.numeric_order)[0];
    if (!next) return { kind: 'COMPLETE', reason: 'FINAL_GRADE', nextGradeName: null };

    const taught = taughtGradeIds.has(next.id);
    const band = bandForGrade(grade);
    const nextBand = bandForGrade(next);
    if (band && nextBand && TRANSITIONS[band] === nextBand) {
        return {
            kind: 'TRANSITION',
            nextGradeId: next.id,
            nextGradeName: next.name_display,
            nextLevelName: TRANSITION_LEVEL_NAMES[nextBand] ?? next.name_display,
            canStay: taught,
        };
    }
    if (!taught) return { kind: 'COMPLETE', reason: 'NEXT_NOT_TAUGHT', nextGradeName: next.name_display };
    return { kind: 'PROMOTE', nextGradeId: next.id, nextGradeName: next.name_display };
}

/** The grade learners move up into, when the step lets them. */
export const nextGradeId = (step: GradeStep): string | null =>
    step.kind === 'PROMOTE' || (step.kind === 'TRANSITION' && step.canStay) ? step.nextGradeId : null;

/** The outcomes a learner of a grade may be given, most usual first. */
export function allowedOutcomes(step: GradeStep): readonly PromotionOutcome[] {
    if (step.kind === 'PROMOTE') return ['PROMOTE', 'REPEAT', 'TRANSFER'];
    if (step.kind === 'TRANSITION' && step.canStay) return ['PROMOTE', 'GRADUATE', 'REPEAT', 'TRANSFER'];
    return ['GRADUATE', 'REPEAT', 'TRANSFER'];
}

/** What a learner gets unless the admin says otherwise; null must be decided. */
export function defaultOutcome(step: GradeStep): PromotionOutcome | null {
    if (step.kind === 'PROMOTE') return 'PROMOTE';
    if (step.kind === 'TRANSITION' && step.canStay) return null;
    return 'GRADUATE';
}

/** An outcome's name for a learner of this grade. */
export function outcomeLabel(outcome: PromotionOutcome, step: GradeStep): string {
    switch (outcome) {
        case 'PROMOTE':
            return step.kind === 'TRANSITION' ? `Stays for ${step.nextGradeName}` : step.kind === 'PROMOTE' ? `Moves to ${step.nextGradeName}` : 'Promote';
        case 'GRADUATE':
            return step.kind === 'TRANSITION' ? `Leaves for ${step.nextLevelName}` : 'Graduates';
        case 'REPEAT':
            return 'Repeats';
        case 'TRANSFER':
            return 'Transfers out';
    }
}

/** Whether the outcome archives the learner (they leave the active roll). */
export const archivesLearner = (outcome: PromotionOutcome): boolean => outcome === 'GRADUATE' || outcome === 'TRANSFER';

interface StreamLike {
    id: string;
    name: string;
}

/**
 * The class a learner of `from` moves into by default: the next grade's class
 * of the same stream name (7 East → 8 East), or its only class. Null when the
 * admin has to choose.
 */
export function defaultTargetStream(from: StreamLike, nextStreams: readonly StreamLike[]): string | null {
    const key = from.name.trim().toLowerCase();
    const same = nextStreams.find(s => s.name.trim().toLowerCase() === key);
    if (same) return same.id;
    return nextStreams.length === 1 ? nextStreams[0].id : null;
}

// ── The plan ────────────────────────────────────────────────────────────

export const decisionSchema = z.object({
    // Clerk ids (user_…) as well as uuids.
    student_id: z.string().trim().min(1).max(64),
    from_stream_id: z.guid(),
    outcome: z.enum(PROMOTION_OUTCOMES),
    to_stream_id: z.guid().nullable(),
});
export type PromotionDecision = z.infer<typeof decisionSchema>;

export const promotionPlanSchema = z.object({
    academic_year_id: z.guid(),
    decisions: z.array(decisionSchema).min(1, 'There are no learners to promote.').max(20000),
});
export type PromotionPlan = z.infer<typeof promotionPlanSchema>;

/**
 * Why a learner's decision can't be applied, or null. `nextStreamIds` are the
 * classes of the grade they would move into.
 */
export function decisionProblem(
    step: GradeStep,
    decision: Pick<PromotionDecision, 'outcome' | 'to_stream_id'>,
    nextStreamIds: ReadonlySet<string>,
): string | null {
    if (!allowedOutcomes(step).includes(decision.outcome)) return 'that choice is not open to this grade';
    if (decision.outcome !== 'PROMOTE') return decision.to_stream_id ? 'only a promoted learner changes class' : null;
    if (!decision.to_stream_id) return 'choose the class they move into';
    return nextStreamIds.has(decision.to_stream_id) ? null : 'that class is not in the next grade';
}

// ── What the page reads ─────────────────────────────────────────────────

export interface PromotionLearner {
    id: string;
    name: string;
    admission_number: string | null;
}

export interface PromotionClass {
    id: string;
    name: string;
    full_name: string;
    learners: PromotionLearner[];
}

export interface PromotionGrade {
    id: string;
    name: string;
    curriculum: string;
    step: GradeStep;
    classes: PromotionClass[];
    /** Classes of the grade learners move into; empty when nobody can. */
    nextClasses: Pick<PromotionClass, 'id' | 'name' | 'full_name'>[];
}

export interface PromotionCounts {
    promoted: number;
    repeated: number;
    graduated: number;
    transferred: number;
}

export interface PromotionRunSummary extends PromotionCounts {
    id: string;
    created_at: string;
    run_by: string | null;
}

export interface PromotionOverview {
    /** The year being closed; promotion runs once per academic year. */
    academicYear: { id: string; name: string } | null;
    /** This year's promotion, when it has been run (and not undone). */
    run: PromotionRunSummary | null;
    grades: PromotionGrade[];
}

const COUNT_KEY: Record<PromotionOutcome, keyof PromotionCounts> = {
    PROMOTE: 'promoted',
    REPEAT: 'repeated',
    GRADUATE: 'graduated',
    TRANSFER: 'transferred',
};

/** How many learners get each outcome; undecided ones are not counted. */
export function countOutcomes(outcomes: Iterable<PromotionOutcome | null>): PromotionCounts {
    const counts: PromotionCounts = { promoted: 0, repeated: 0, graduated: 0, transferred: 0 };
    for (const o of outcomes) if (o) counts[COUNT_KEY[o]]++;
    return counts;
}

/** What undoing a promotion did: learners put back, and those left alone. */
export interface PromotionUndoResult {
    restored: number;
    skipped: number;
}
