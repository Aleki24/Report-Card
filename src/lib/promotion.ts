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
import { isOfferedGrade } from './classes-overview';

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

// ── The plan being drawn up ─────────────────────────────────────────────
// Pure state functions shared by the web page and the phone app; each wraps
// them in its own small hook.

export interface LearnerChoice {
    outcome: PromotionOutcome | null;
    /** The class a promoted learner moves into. */
    to: string | null;
}

export interface PromotionPlanState {
    choices: Readonly<Record<string, LearnerChoice>>;
    /** Each class's default class to move into, set from the class row. */
    classTargets: Readonly<Record<string, string | null>>;
}

const toFor = (outcome: PromotionOutcome | null, target: string | null): string | null => (outcome === 'PROMOTE' ? target : null);

/** Every learner on their grade's usual step, each class moving to its matching class. */
export function initialPlan(grades: readonly PromotionGrade[]): PromotionPlanState {
    const choices: Record<string, LearnerChoice> = {};
    const classTargets: Record<string, string | null> = {};
    for (const grade of grades) {
        const outcome = defaultOutcome(grade.step);
        const canMove = nextGradeId(grade.step) !== null;
        for (const cls of grade.classes) {
            const target = canMove ? defaultTargetStream(cls, grade.nextClasses) : null;
            classTargets[cls.id] = target;
            for (const l of cls.learners) choices[l.id] = { outcome, to: toFor(outcome, target) };
        }
    }
    return { choices, classTargets };
}

/** Changes one learner's outcome or class; a newly promoted learner takes their class's target. */
export function withLearnerChoice(plan: PromotionPlanState, learnerId: string, classId: string, patch: Partial<LearnerChoice>): PromotionPlanState {
    const current = plan.choices[learnerId];
    const outcome = patch.outcome !== undefined ? patch.outcome : current.outcome;
    const to = patch.to !== undefined ? patch.to : current.to ?? plan.classTargets[classId] ?? null;
    return { ...plan, choices: { ...plan.choices, [learnerId]: { outcome, to: toFor(outcome, to) } } };
}

const learnersOf = (grades: readonly PromotionGrade[], classId: string): readonly PromotionLearner[] =>
    grades.flatMap(g => g.classes).find(c => c.id === classId)?.learners ?? [];

/** Gives every learner of these classes the same outcome. */
export function withClassesOutcome(plan: PromotionPlanState, grades: readonly PromotionGrade[], classIds: readonly string[], outcome: PromotionOutcome): PromotionPlanState {
    const choices = { ...plan.choices };
    for (const classId of classIds) {
        for (const l of learnersOf(grades, classId)) {
            choices[l.id] = { outcome, to: toFor(outcome, choices[l.id]?.to ?? plan.classTargets[classId] ?? null) };
        }
    }
    return { ...plan, choices };
}

/** Sets where a class moves to, for its learners being promoted. */
export function withClassTarget(plan: PromotionPlanState, grades: readonly PromotionGrade[], classId: string, target: string | null): PromotionPlanState {
    const choices = { ...plan.choices };
    for (const l of learnersOf(grades, classId)) choices[l.id] = { ...choices[l.id], to: toFor(choices[l.id].outcome, target) };
    return { choices, classTargets: { ...plan.classTargets, [classId]: target } };
}

/** Why a learner's choice can't be applied yet, or null. */
export function choiceProblem(grade: PromotionGrade, choice: LearnerChoice): string | null {
    if (!choice.outcome) return 'needs a decision';
    return decisionProblem(grade.step, { outcome: choice.outcome, to_stream_id: choice.to }, new Set(grade.nextClasses.map(c => c.id)));
}

export interface PromotionPlanSummary {
    counts: PromotionCounts;
    /** Learners still needing something: a decision (Grade 9s) or a class to move into. */
    blocked: number;
    total: number;
}

export function planSummary(grades: readonly PromotionGrade[], plan: PromotionPlanState): PromotionPlanSummary {
    let blocked = 0;
    for (const grade of grades) {
        for (const cls of grade.classes) for (const l of cls.learners) if (choiceProblem(grade, plan.choices[l.id])) blocked++;
    }
    const outcomes = Object.values(plan.choices).map(c => c.outcome);
    return { counts: countOutcomes(outcomes), blocked, total: outcomes.length };
}

/** The plan as the server takes it: one decision per decided learner. */
export function planDecisions(grades: readonly PromotionGrade[], plan: PromotionPlanState): PromotionDecision[] {
    return grades.flatMap(g => g.classes.flatMap(cls => cls.learners.flatMap(l => {
        const { outcome, to } = plan.choices[l.id];
        return outcome ? [{ student_id: l.id, from_stream_id: cls.id, outcome, to_stream_id: to }] : [];
    })));
}

// ── Wording and colour, the same on the web and the phone ───────────────

/** Hues both apps' palettes define. */
export type PromotionHue = 'emerald' | 'amber' | 'violet' | 'sky' | 'slate';

export const OUTCOME_ORDER: readonly PromotionOutcome[] = ['PROMOTE', 'GRADUATE', 'REPEAT', 'TRANSFER'];

export const OUTCOME_COPY: Record<PromotionOutcome, { hue: PromotionHue; count: keyof PromotionCounts; tally: string }> = {
    PROMOTE: { hue: 'emerald', count: 'promoted', tally: 'Move up' },
    GRADUATE: { hue: 'violet', count: 'graduated', tally: 'Graduate / leave' },
    REPEAT: { hue: 'sky', count: 'repeated', tally: 'Repeat' },
    TRANSFER: { hue: 'slate', count: 'transferred', tally: 'Transfer out' },
};

export type StepTone = 'MOVES_UP' | 'DECIDE' | 'LEAVES';

/** How a grade's card reads: its badge, where it goes, and a one-line explanation. */
export function stepCopy(step: GradeStep, gradeName: string): { tone: StepTone; hue: PromotionHue; badge: string; target: string; explain: string } {
    switch (step.kind) {
        case 'PROMOTE':
            return { tone: 'MOVES_UP', hue: 'emerald', badge: 'Moves up', target: step.nextGradeName, explain: `Learners move up to ${step.nextGradeName}.` };
        case 'TRANSITION':
            return step.canStay
                ? {
                    tone: 'DECIDE', hue: 'amber', badge: 'Decide each learner', target: `${step.nextGradeName} or leave`,
                    explain: `${gradeName} learners are placed into ${step.nextLevelName} nationally, so not all of them stay. Mark who joins your ${step.nextGradeName} and who leaves; leavers are archived as having completed ${gradeName}.`,
                }
                : {
                    tone: 'LEAVES', hue: 'violet', badge: 'Completes here', target: 'Archived',
                    explain: `Your school has no ${step.nextGradeName} class, so ${gradeName} learners complete here and leave for ${step.nextLevelName}. They are archived as having completed ${gradeName}.`,
                };
        case 'COMPLETE':
            return {
                tone: 'LEAVES', hue: 'violet', badge: 'Candidates', target: 'Graduated',
                explain: step.reason === 'FINAL_GRADE'
                    ? `${gradeName} is the last grade, so candidates graduate and are archived.`
                    : `Your school has no ${step.nextGradeName} class, so ${gradeName} learners graduate and are archived. Add ${step.nextGradeName} on the Classes page if they should move up instead.`,
            };
    }
}

/** The confirmation before applying a plan, in plain sentences. */
export function confirmCopy(summary: PromotionPlanSummary): { title: string; lines: string[] } {
    const { promoted, repeated, graduated, transferred } = summary.counts;
    const n = (v: number) => v.toLocaleString();
    return {
        title: `Promote ${n(summary.total)} learner${summary.total === 1 ? '' : 's'}?`,
        lines: [
            `${n(promoted)} move up a class and ${n(repeated)} repeat.`,
            `${n(graduated + transferred)} leave the school and are archived; any unused sign-in codes stop working.`,
            'You can undo this afterwards if something is wrong.',
        ],
    };
}

/** A grade whose Grade 9s can't stay because the next grade has no class yet, worth offering to add. */
export function missingSeniorGrade(grades: readonly PromotionGrade[]): (PromotionGrade & { step: Extract<GradeStep, { kind: 'TRANSITION' }> }) | undefined {
    return grades.find((g): g is PromotionGrade & { step: Extract<GradeStep, { kind: 'TRANSITION' }> } =>
        g.step.kind === 'TRANSITION' && !g.step.canStay && isOfferedGrade(g.step.nextGradeName));
}

/** Whether anyone could stay for Senior School, so they will need placing in a pathway. */
export const hasSeniorStayers = (grades: readonly PromotionGrade[]): boolean =>
    grades.some(g => g.step.kind === 'TRANSITION' && g.step.canStay);

/** Whether a learner matches a search by name or admission number; `query` is lowercased, empty matches all. */
export const learnerMatches = (l: PromotionLearner, query: string): boolean =>
    !query || l.name.toLowerCase().includes(query) || (l.admission_number ?? '').toLowerCase().includes(query);
