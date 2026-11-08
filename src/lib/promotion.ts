/**
 * End-of-year promotion: what happens to each grade's learners, and the rules
 * a plan must keep. Client-safe; the server re-checks every plan with the
 * same functions before applying it (`promotion-server.ts`).
 *
 * Each grade the school teaches takes one of three steps:
 *   PROMOTE     the next grade is taught here, so learners move up a class.
 *   TRANSITION  the next grade starts a new level learners are placed into
 *               nationally (Grade 9 → Senior School). Staying is never
 *               assumed: where the school teaches the next grade, learners
 *               are left pending until placement is out, so the rest of the
 *               school can move up meanwhile.
 *   COMPLETE    candidates of the school's last grade (Grade 12, Form 4), or
 *               a grade whose next grade the school doesn't teach: learners
 *               graduate and are archived. Where that next grade continues
 *               the same level (Grade 10 → 11 at a school still adding Senior
 *               School grades), they are left pending until it is added.
 * Any learner can instead repeat the year or be marked as transferred out.
 *
 * Pending learners keep their class and records but leave the roll (class
 * lists, attendance, fees, SMS). A follow-up step of the same year's
 * promotion decides them when the school is ready.
 */
import { z } from 'zod';
import { bandForGrade, type CurriculumBand, type GradeLike } from './curriculum-bands';
import { isOfferedGrade } from './classes-overview';

export const PROMOTION_URL = '/api/admin/promotion';

export const PROMOTION_OUTCOMES = ['PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER', 'PENDING'] as const;
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
    | { kind: 'COMPLETE'; reason: 'FINAL_GRADE'; nextGradeName: null }
    | {
        kind: 'COMPLETE';
        reason: 'NEXT_NOT_TAUGHT';
        nextGradeName: string;
        /** The next grade continues the same level (Grade 10 → 11), so the school is likely still adding it. */
        sameLevel: boolean;
    };

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
    if (!taught) return { kind: 'COMPLETE', reason: 'NEXT_NOT_TAUGHT', nextGradeName: next.name_display, sameLevel: !!band && band === nextBand };
    return { kind: 'PROMOTE', nextGradeId: next.id, nextGradeName: next.name_display };
}

/** The grade learners move up into, when the step lets them. */
export const nextGradeId = (step: GradeStep): string | null =>
    step.kind === 'PROMOTE' || (step.kind === 'TRANSITION' && step.canStay) ? step.nextGradeId : null;

/** Whether a grade's learners can't simply move up, so leaving them pending is offered. */
const mayWait = (step: GradeStep): boolean => step.kind === 'TRANSITION' || (step.kind === 'COMPLETE' && step.reason === 'NEXT_NOT_TAUGHT');

/**
 * The outcomes a learner of a grade may be given, most usual first.
 * `pending` is for learners already left pending: they may stay so.
 */
export function allowedOutcomes(step: GradeStep, pending = false): readonly PromotionOutcome[] {
    const outcomes: PromotionOutcome[] =
        step.kind === 'PROMOTE' ? ['PROMOTE', 'REPEAT', 'TRANSFER']
            : step.kind === 'TRANSITION' && step.canStay ? ['PROMOTE', 'GRADUATE', 'PENDING', 'REPEAT', 'TRANSFER']
                : mayWait(step) ? ['GRADUATE', 'PENDING', 'REPEAT', 'TRANSFER']
                    : ['GRADUATE', 'REPEAT', 'TRANSFER'];
    return pending && !outcomes.includes('PENDING') ? [...outcomes, 'PENDING'] : outcomes;
}

/** What a learner gets unless the admin says otherwise. */
export function defaultOutcome(step: GradeStep): PromotionOutcome {
    if (step.kind === 'PROMOTE') return 'PROMOTE';
    if (step.kind === 'TRANSITION') return step.canStay ? 'PENDING' : 'GRADUATE';
    return step.reason === 'NEXT_NOT_TAUGHT' && step.sameLevel ? 'PENDING' : 'GRADUATE';
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
        case 'PENDING':
            return step.kind === 'TRANSITION' ? 'Awaits placement'
                : step.kind === 'COMPLETE' && step.reason === 'NEXT_NOT_TAUGHT' ? `Awaits ${step.nextGradeName}`
                    : 'Stays pending';
    }
}

/** Whether the outcome archives the learner (they leave the school). */
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
 * classes of the grade they would move into; `pending` says the learner is
 * already pending.
 */
export function decisionProblem(
    step: GradeStep,
    decision: Pick<PromotionDecision, 'outcome' | 'to_stream_id'>,
    nextStreamIds: ReadonlySet<string>,
    pending = false,
): string | null {
    if (!allowedOutcomes(step, pending).includes(decision.outcome)) return 'that choice is not open to this grade';
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
    /** Its learners were left pending by an earlier step of this year's promotion. */
    pending: boolean;
    classes: PromotionClass[];
    /** Classes of the grade learners move into; empty when nobody can. */
    nextClasses: Pick<PromotionClass, 'id' | 'name' | 'full_name'>[];
}

export interface PromotionCounts {
    promoted: number;
    repeated: number;
    graduated: number;
    transferred: number;
    pending: number;
}

export interface PromotionRunSummary extends PromotionCounts {
    id: string;
    created_at: string;
    run_by: string | null;
    /** It decided learners left pending by an earlier step, so undoing it puts them back to pending. */
    decidesPending: boolean;
}

export interface PromotionYear {
    id: string;
    name: string;
}

/**
 * OPEN     nothing has been run for the year; the plan covers every enrolled learner.
 * PENDING  it has run, and some learners are still pending; `grades` holds only them.
 * DONE     it has run and nobody is pending.
 */
export type PromotionStage = 'OPEN' | 'PENDING' | 'DONE';

export interface PromotionOverview {
    /** The year being closed. */
    academicYear: PromotionYear | null;
    /** Every year on record, newest first, so another can be chosen. */
    years: PromotionYear[];
    stage: PromotionStage;
    /** The year's latest step, the one undo reverses. */
    run: PromotionRunSummary | null;
    /** What the year's promotion has done so far; `pending` is how many learners are still pending. */
    totals: PromotionCounts | null;
    grades: PromotionGrade[];
}

const COUNT_KEY: Record<PromotionOutcome, keyof PromotionCounts> = {
    PROMOTE: 'promoted',
    REPEAT: 'repeated',
    GRADUATE: 'graduated',
    TRANSFER: 'transferred',
    PENDING: 'pending',
};

export const emptyCounts = (): PromotionCounts => ({ promoted: 0, repeated: 0, graduated: 0, transferred: 0, pending: 0 });

/** How many learners get each outcome. */
export function countOutcomes(outcomes: Iterable<PromotionOutcome>): PromotionCounts {
    const counts = emptyCounts();
    for (const o of outcomes) counts[COUNT_KEY[o]]++;
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
    outcome: PromotionOutcome;
    /** The class a promoted learner moves into. */
    to: string | null;
}

export interface PromotionPlanState {
    choices: Readonly<Record<string, LearnerChoice>>;
    /** Each class's default class to move into, set from the class row. */
    classTargets: Readonly<Record<string, string | null>>;
}

const toFor = (outcome: PromotionOutcome, target: string | null): string | null => (outcome === 'PROMOTE' ? target : null);

/**
 * Every learner on their grade's usual step, each class moving to its
 * matching class. Learners already pending stay so until the admin decides.
 */
export function initialPlan(grades: readonly PromotionGrade[]): PromotionPlanState {
    const choices: Record<string, LearnerChoice> = {};
    const classTargets: Record<string, string | null> = {};
    for (const grade of grades) {
        const outcome = grade.pending ? 'PENDING' : defaultOutcome(grade.step);
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
    const outcome = patch.outcome ?? current.outcome;
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

/** The outcomes open to a grade's learners on this page. */
export const gradeOutcomes = (grade: PromotionGrade): readonly PromotionOutcome[] => allowedOutcomes(grade.step, grade.pending);

/** Why a learner's choice can't be applied yet, or null. */
export function choiceProblem(grade: PromotionGrade, choice: LearnerChoice): string | null {
    return decisionProblem(grade.step, { outcome: choice.outcome, to_stream_id: choice.to }, new Set(grade.nextClasses.map(c => c.id)), grade.pending);
}

/** Whether a choice changes nothing: a pending learner left pending. */
const keepsPending = (grade: PromotionGrade, choice: LearnerChoice): boolean => grade.pending && choice.outcome === 'PENDING';

export interface PromotionPlanSummary {
    counts: PromotionCounts;
    /** Learners still needing something before the plan can run: a class to move into. */
    blocked: number;
    /** Learners on the page. */
    total: number;
    /** Learners the plan changes: everyone, except pending learners left pending. */
    changing: number;
}

export function planSummary(grades: readonly PromotionGrade[], plan: PromotionPlanState): PromotionPlanSummary {
    let blocked = 0;
    let total = 0;
    let changing = 0;
    const outcomes: PromotionOutcome[] = [];
    for (const grade of grades) {
        for (const cls of grade.classes) {
            for (const l of cls.learners) {
                const choice = plan.choices[l.id];
                total++;
                outcomes.push(choice.outcome);
                if (choiceProblem(grade, choice)) blocked++;
                if (!keepsPending(grade, choice)) changing++;
            }
        }
    }
    return { counts: countOutcomes(outcomes), blocked, total, changing };
}

/** The plan as the server takes it: one decision per learner it changes. */
export function planDecisions(grades: readonly PromotionGrade[], plan: PromotionPlanState): PromotionDecision[] {
    return grades.flatMap(g => g.classes.flatMap(cls => cls.learners.flatMap(l => {
        const choice = plan.choices[l.id];
        return keepsPending(g, choice) ? [] : [{ student_id: l.id, from_stream_id: cls.id, outcome: choice.outcome, to_stream_id: choice.to }];
    })));
}

// ── Wording and colour, the same on the web and the phone ───────────────

/** Hues both apps' palettes define. */
export type PromotionHue = 'emerald' | 'amber' | 'violet' | 'sky' | 'slate';

export const OUTCOME_ORDER: readonly PromotionOutcome[] = ['PROMOTE', 'PENDING', 'GRADUATE', 'REPEAT', 'TRANSFER'];

export const OUTCOME_COPY: Record<PromotionOutcome, { hue: PromotionHue; count: keyof PromotionCounts; tally: string; hint: string }> = {
    PROMOTE: { hue: 'emerald', count: 'promoted', tally: 'Move up', hint: 'stay active' },
    PENDING: { hue: 'amber', count: 'pending', tally: 'Pending', hint: 'off class lists' },
    GRADUATE: { hue: 'violet', count: 'graduated', tally: 'Graduate / leave', hint: 'archived' },
    REPEAT: { hue: 'sky', count: 'repeated', tally: 'Repeat', hint: 'stay active' },
    TRANSFER: { hue: 'slate', count: 'transferred', tally: 'Transfer out', hint: 'archived' },
};

/**
 * The outcome tallies worth showing: those some grade on the page can take,
 * and any already counted. A school with no Grade 9 never sees "Pending".
 */
export function tallyOutcomes(grades: readonly PromotionGrade[], counts: PromotionCounts): PromotionOutcome[] {
    return OUTCOME_ORDER.filter(o => counts[OUTCOME_COPY[o].count] > 0 || grades.some(g => gradeOutcomes(g).includes(o)));
}

export type StepTone = 'MOVES_UP' | 'DECIDE' | 'WAITS' | 'LEAVES';

interface StepCopy {
    tone: StepTone;
    hue: PromotionHue;
    badge: string;
    target: string;
    explain: string;
}

/** How the card of a grade whose learners are already pending reads. */
function pendingStepCopy(step: GradeStep, gradeName: string): StepCopy {
    const base = { tone: 'WAITS' as const, hue: 'amber' as const, badge: 'Pending' };
    switch (step.kind) {
        case 'PROMOTE':
            return { ...base, target: step.nextGradeName, explain: `${step.nextGradeName} has classes now, so these learners can move up. Anyone you are not sure of stays pending.` };
        case 'TRANSITION':
            return step.canStay
                ? { ...base, target: `${step.nextGradeName} or leave`, explain: `Once Senior School placement is out, mark who joins your ${step.nextGradeName} and who leaves for ${step.nextLevelName}; leavers are archived as having completed ${gradeName}. Anyone not yet known stays pending.` }
                : { ...base, target: 'Leave', explain: `Your school has no ${step.nextGradeName} class, so these learners leave for ${step.nextLevelName}. Mark them as leaving, or add ${step.nextGradeName} on the Classes page if some stay.` };
        case 'COMPLETE':
            return step.reason === 'NEXT_NOT_TAUGHT'
                ? { ...base, target: `Awaits ${step.nextGradeName}`, explain: `Your school still has no ${step.nextGradeName} class. Add it on the Classes page to move these learners up, or mark who leaves.` }
                : { ...base, target: 'Graduate', explain: `Mark these learners as graduated, repeating or leaving, or leave them pending.` };
    }
}

/** How a grade's card reads: its badge, where it goes, and a one-line explanation. */
export function stepCopy(grade: Pick<PromotionGrade, 'step' | 'name' | 'pending'>): StepCopy {
    const { step, name: gradeName } = grade;
    if (grade.pending) return pendingStepCopy(step, gradeName);
    switch (step.kind) {
        case 'PROMOTE':
            return { tone: 'MOVES_UP', hue: 'emerald', badge: 'Moves up', target: step.nextGradeName, explain: `Learners move up to ${step.nextGradeName}.` };
        case 'TRANSITION':
            return step.canStay
                ? {
                    tone: 'DECIDE', hue: 'amber', badge: 'Pending placement', target: `${step.nextGradeName} or leave`,
                    explain: `${gradeName} learners are placed into ${step.nextLevelName} nationally, so not all of them stay. They are left pending while the rest of the school moves up: off class lists, records kept. Once placement is out, come back here to mark who joins your ${step.nextGradeName} and who leaves. You can mark anyone you already know now.`,
                }
                : {
                    tone: 'LEAVES', hue: 'violet', badge: 'Completes here', target: 'Archived',
                    explain: `Your school has no ${step.nextGradeName} class, so ${gradeName} learners complete here and leave for ${step.nextLevelName}. They are archived as having completed ${gradeName}.`,
                };
        case 'COMPLETE':
            if (step.reason === 'FINAL_GRADE') {
                return { tone: 'LEAVES', hue: 'violet', badge: 'Candidates', target: 'Graduated', explain: `${gradeName} is the last grade, so candidates graduate and are archived.` };
            }
            return step.sameLevel
                ? {
                    tone: 'WAITS', hue: 'amber', badge: `Awaits ${step.nextGradeName}`, target: 'Pending',
                    explain: `Your school has no ${step.nextGradeName} class yet, so ${gradeName} learners are left pending: off class lists, records kept. Add ${step.nextGradeName} on the Classes page, then come back here to move them up.`,
                }
                : {
                    tone: 'LEAVES', hue: 'violet', badge: 'Candidates', target: 'Graduated',
                    explain: `Your school has no ${step.nextGradeName} class, so ${gradeName} learners graduate and are archived. Add ${step.nextGradeName} on the Classes page if they should move up instead.`,
                };
    }
}

const n = (v: number) => v.toLocaleString();
const learners = (v: number) => `${n(v)} learner${v === 1 ? '' : 's'}`;

/** The confirmation before applying a plan, in plain sentences. */
export function confirmCopy(summary: PromotionPlanSummary, stage: PromotionStage): { title: string; lines: string[] } {
    const { promoted, repeated, graduated, transferred, pending } = summary.counts;
    const leave = `${n(graduated + transferred)} leave the school and are archived; any unused sign-in codes stop working.`;
    const undo = 'You can undo this afterwards if something is wrong.';
    if (stage === 'PENDING') {
        return {
            title: `Decide ${learners(summary.changing)}?`,
            lines: [
                `${n(promoted)} join their new class and ${n(repeated)} repeat.`,
                leave,
                ...(pending > 0 ? [`${learners(pending)} ${pending === 1 ? 'stays' : 'stay'} pending.`] : []),
                undo,
            ],
        };
    }
    return {
        title: `Promote ${learners(summary.total)}?`,
        lines: [
            `${n(promoted)} move up a class and ${n(repeated)} repeat.`,
            ...(pending > 0 ? [`${learners(pending)} ${pending === 1 ? 'is' : 'are'} left pending: off class lists until you decide them on this page.`] : []),
            leave,
            undo,
        ],
    };
}

/** The page's one-line description, the same on the web and the phone. */
export function pageDescription(overview: Pick<PromotionOverview, 'academicYear' | 'stage'> | null): string {
    if (!overview?.academicYear) return 'Move learners up a class at the end of the year, and archive those who leave.';
    const year = overview.academicYear.name;
    switch (overview.stage) {
        case 'OPEN':
            return `Close ${year}: learners move up a class, candidates graduate and are archived, and Grade 9s are left pending until Senior School placement is out.`;
        case 'PENDING':
            return `${year} is promoted. Decide the pending learners when you are ready; everyone else has already moved up.`;
        case 'DONE':
            return `${year} is promoted: learners have moved up a class and those who left are archived.`;
    }
}

/** The undo button and its confirmation, for the year's latest step. */
export function undoCopy(run: PromotionRunSummary): { button: string; title: string; message: string; done: string } {
    if (run.decidesPending) {
        const decided = run.promoted + run.repeated + run.graduated + run.transferred;
        return {
            button: 'Undo last decisions',
            title: 'Undo these decisions?',
            message: `The ${learners(decided)} decided in this step go back to pending, including any archived. Anyone you have moved or edited by hand since is left as they are.`,
            done: 'Decisions undone',
        };
    }
    return {
        button: 'Undo promotion',
        title: 'Undo this promotion?',
        message: 'Every learner goes back to the class and status they had before it, including those archived or left pending. Anyone you have moved or edited by hand since is left as they are.',
        done: 'Promotion undone',
    };
}

/** The button that applies the plan. */
export const runLabel = (summary: PromotionPlanSummary, stage: PromotionStage): string =>
    stage === 'PENDING' ? `Decide ${learners(summary.changing)}` : `Promote ${learners(summary.total)}`;

/** Why the plan can't be applied yet, or the reassurance that it can. */
export function planStatus(summary: PromotionPlanSummary, stage: PromotionStage): { ready: boolean; text: string } {
    if (summary.blocked > 0) return { ready: false, text: `${learners(summary.blocked)} still need${summary.blocked === 1 ? 's' : ''} a class to move into.` };
    if (stage === 'PENDING' && summary.changing === 0) return { ready: false, text: 'Mark what happens to a learner to decide them. Nothing changes until you do.' };
    if (summary.total === 0) return { ready: false, text: 'There are no learners to promote.' };
    return { ready: true, text: 'Every learner is decided. Nothing changes until you press the button.' };
}

/**
 * A grade whose learners could move up if the school added the next grade's
 * class (Grade 10 for Grade 9s who stay, Grade 11 for a school still adding
 * Senior School), worth offering to add.
 */
export function nextGradeToAdd(grades: readonly PromotionGrade[]): { nextGradeName: string; title: string; body: string } | null {
    for (const g of grades) {
        const step = g.step;
        if (step.kind === 'TRANSITION' && !step.canStay && isOfferedGrade(step.nextGradeName)) {
            return {
                nextGradeName: step.nextGradeName,
                title: `Do some ${g.name} learners stay for ${step.nextLevelName}?`,
                body: `Only a school with a ${step.nextGradeName} class can keep them. Add one first, then come back.`,
            };
        }
        if (step.kind === 'COMPLETE' && step.reason === 'NEXT_NOT_TAUGHT' && step.sameLevel && isOfferedGrade(step.nextGradeName)) {
            return {
                nextGradeName: step.nextGradeName,
                title: `Moving ${g.name} up to ${step.nextGradeName}?`,
                body: `Add a ${step.nextGradeName} class first. Until then ${g.name} learners can be left pending, and moved up here once it exists.`,
            };
        }
    }
    return null;
}

/** Whether anyone could stay for Senior School, so they will need placing in a pathway. */
export const hasSeniorStayers = (grades: readonly PromotionGrade[]): boolean =>
    grades.some(g => g.step.kind === 'TRANSITION' && g.step.canStay);

/** Whether a learner matches a search by name or admission number; `query` is lowercased, empty matches all. */
export const learnerMatches = (l: PromotionLearner, query: string): boolean =>
    !query || l.name.toLowerCase().includes(query) || (l.admission_number ?? '').toLowerCase().includes(query);
