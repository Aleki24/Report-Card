/**
 * The bursar's decisions on a statement while reviewing it, as pure state:
 * which learners each line goes to (split between siblings if need be),
 * which wait in the unmatched queue, which are not school fees, and the
 * totals check that has to come out even before anything is saved.
 * Shared by the web page and the phone app; each keeps it in its own hook.
 */
import type { Allocation, CommitBody, LineAction, PreviewLine, ReconcilePreview } from './fee-reconcile';

export interface LineDecision {
    action: LineAction;
    /** For RECORD: who gets what (one learner, or shares that add up to the line). */
    allocations: Allocation[];
}

export type ReconcilePlan = Readonly<Record<number, LineDecision>>;

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Where review starts: lines matched on the admission number are recorded
 * to that learner; everything else waits in the unmatched queue until the
 * bursar picks a learner (a suggestion, a split, or someone else).
 */
export function initialPlan(preview: Pick<ReconcilePreview, 'lines'>): ReconcilePlan {
    const plan: Record<number, LineDecision> = {};
    for (const line of preview.lines) {
        if (line.status === 'RECORDED') continue;
        plan[line.line] = line.status === 'MATCHED'
            ? { action: 'RECORD', allocations: [{ studentId: line.candidates[0].studentId, amount: line.amount }] }
            : { action: 'QUEUE', allocations: [] };
    }
    return plan;
}

/** The whole line to one learner. */
export const recordTo = (plan: ReconcilePlan, line: PreviewLine, studentId: string): ReconcilePlan =>
    ({ ...plan, [line.line]: { action: 'RECORD', allocations: [{ studentId, amount: line.amount }] } });

/** Shared between learners: evenly to start with, the remainder on the first. */
export function splitBetween(plan: ReconcilePlan, line: PreviewLine, studentIds: readonly string[]): ReconcilePlan {
    if (studentIds.length === 0) return plan;
    const share = Math.floor((line.amount / studentIds.length) * 100) / 100;
    const allocations = studentIds.map((studentId, i) => ({
        studentId,
        amount: i === 0 ? money(line.amount - share * (studentIds.length - 1)) : share,
    }));
    return { ...plan, [line.line]: { action: 'RECORD', allocations } };
}

/** One share's amount changed by hand. */
export function withShare(plan: ReconcilePlan, line: PreviewLine, studentId: string, amount: number): ReconcilePlan {
    const current = plan[line.line];
    if (!current) return plan;
    return { ...plan, [line.line]: { ...current, allocations: current.allocations.map(a => (a.studentId === studentId ? { ...a, amount: money(amount) } : a)) } };
}

/** Left to chase in the unmatched queue, or set aside as not school fees. */
export const setAction = (plan: ReconcilePlan, line: PreviewLine, action: Exclude<LineAction, 'RECORD'>): ReconcilePlan =>
    ({ ...plan, [line.line]: { action, allocations: [] } });

/** Why a line's decision can't be saved, or null. */
export function decisionProblem(line: PreviewLine, decision: LineDecision | undefined): string | null {
    if (!decision || decision.action !== 'RECORD') return null;
    if (decision.allocations.length === 0) return 'Choose who it is for.';
    if (decision.allocations.some(a => !(a.amount > 0))) return 'Each share must be more than zero.';
    const sum = money(decision.allocations.reduce((n, a) => n + a.amount, 0));
    if (Math.abs(sum - line.amount) > 0.009) return `The shares come to ${sum.toLocaleString()}, not ${line.amount.toLocaleString()}.`;
    return null;
}

export interface PlanTotals {
    /** Money in on the statement. */
    statement: number;
    /** To be recorded against learners now. */
    record: number;
    /** Already in Skulbase. */
    already: number;
    /** To wait in the unmatched queue. */
    queue: number;
    /** Not school fees. */
    skip: number;
    /** Lines whose decision can't be saved yet. */
    problems: number;
    counts: { record: number; already: number; queue: number; skip: number };
}

/** The totals check: everything on the statement is recorded, already in, queued or set aside. */
export function planTotals(preview: Pick<ReconcilePreview, 'lines'>, plan: ReconcilePlan): PlanTotals {
    const t: PlanTotals = { statement: 0, record: 0, already: 0, queue: 0, skip: 0, problems: 0, counts: { record: 0, already: 0, queue: 0, skip: 0 } };
    for (const line of preview.lines) {
        t.statement += line.amount;
        if (line.status === 'RECORDED') { t.already += line.amount; t.counts.already++; continue; }
        const decision = plan[line.line];
        if (decisionProblem(line, decision)) t.problems++;
        const action = decision?.action ?? 'QUEUE';
        const key = action === 'RECORD' ? 'record' : action === 'SKIP' ? 'skip' : 'queue';
        t[key] += line.amount;
        t.counts[key]++;
    }
    for (const k of ['statement', 'record', 'already', 'queue', 'skip'] as const) t[k] = money(t[k]);
    return t;
}

/** What the server takes: every line not already in Skulbase, with its decision. */
export function commitBody(preview: Pick<ReconcilePreview, 'source' | 'lines'>, plan: ReconcilePlan, fileName: string | null): CommitBody {
    return {
        source: preview.source,
        fileName,
        lines: preview.lines.filter(l => l.status !== 'RECORDED').map(l => {
            const decision = plan[l.line] ?? { action: 'QUEUE' as const, allocations: [] };
            return {
                line: l.line, date: l.date, time: l.time, amount: l.amount, code: l.code, accountRef: l.accountRef,
                payerName: l.payerName, phone: l.phone, details: l.details.slice(0, 400),
                action: decision.action, allocations: decision.action === 'RECORD' ? decision.allocations : [],
            };
        }),
    };
}
