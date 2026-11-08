/**
 * The fees overview: this term's collection against last term's, what is
 * owed by class, and a health check of how the money is kept, scored out of
 * 100 with the three fixes that would lift it most. The checks follow how
 * well-run Kenyan school bursaries work: money matched to learners the same
 * week, statements reconciled weekly, each day's takings signed off by a
 * second person, arrears chased early with promises written down, and a
 * parent's phone on every learner. Client-safe; the scoring is pure.
 */
import type { CollectionBucket } from './fee-reports';

export const OVERVIEW_URL = '/api/school/fees/overview';

export interface TermCollection {
    termId: string;
    termName: string;
    yearName: string | null;
    /** Billed for the term, bursaries taken off. */
    expected: number;
    collected: number;
    /** Collected as a share of expected, 0–100 (whole numbers). */
    rate: number;
    /** Learners billed something this term. */
    learners: number;
    /** Billed learners with nothing paid towards the term. */
    paidNothing: number;
}

/** Where on the Fees page a fix is done. */
export type FixTarget =
    | { kind: 'tab'; tab: 'reconcile' | 'daybook' | 'defaulters'; focus?: 'nothing' | 'broken' }
    | { kind: 'link'; href: string };

export type HealthStatus = 'ok' | 'warn' | 'bad';

export interface HealthItem {
    id: 'collection' | 'unmatched' | 'statement' | 'review' | 'nothing' | 'promises' | 'phones';
    label: string;
    status: HealthStatus;
    /** What was found, in a sentence. */
    detail: string;
    /** What to do about it. */
    fix: string;
    target: FixTarget;
    /** Out of `weight`. */
    points: number;
    weight: number;
}

export interface HealthCheck {
    /** 0–100. */
    score: number;
    grade: 'GOOD' | 'FAIR' | 'POOR';
    items: HealthItem[];
    /** The three items losing the most points, worst first. */
    fixes: HealthItem[];
}

export interface FeesOverview {
    current: TermCollection | null;
    previous: TermCollection | null;
    /** Owed across every term by learners still at the school. */
    totalOwed: number;
    learnersOwing: number;
    /** Owed by class; `count` is learners owing. */
    arrearsByClass: CollectionBucket[];
    health: HealthCheck;
}

/** What the health check is scored from, all counted on the server. */
export interface HealthInputs {
    current: TermCollection | null;
    /** Days since the current term began (0 on its first day). */
    termDay: number;
    unmatchedCount: number;
    unmatchedAmount: number;
    /** Days the oldest unmatched payment has waited. */
    unmatchedOldestDays: number;
    /** Days since a statement was last reconciled; null for never. */
    daysSinceStatement: number | null;
    /** M-Pesa, bank and cheque payments in the last 30 days (nothing to reconcile without them). */
    traceablePayments30d: number;
    /** Of the last 7 days that had payments: how many, and how many are signed off and unchanged. */
    daysWithPayments: number;
    daysReviewed: number;
    learnersOwing: number;
    owingWithoutPhone: number;
    brokenPromises: number;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
const statusOf = (points: number, weight: number): HealthStatus => (points >= weight * 0.85 ? 'ok' : points >= weight * 0.45 ? 'warn' : 'bad');

/** A collection rate this term that counts as healthy. */
export const TARGET_RATE = 80;
/** Early in a term parents are still paying: no alarm before this many days. */
const GRACE_DAYS = 21;

/** Scores how the school's fees are kept, out of 100, with the items behind the score. */
export function healthCheck(h: HealthInputs): HealthCheck {
    const items: HealthItem[] = [];
    const add = (item: Omit<HealthItem, 'status'> & { status?: HealthStatus }) =>
        items.push({ ...item, points: Math.round(item.points * 10) / 10, status: item.status ?? statusOf(item.points, item.weight) });

    // Collection rate this term (30), against a target that grows over the first weeks of term.
    {
        const weight = 30;
        const rate = h.current?.rate ?? 0;
        const early = h.termDay < GRACE_DAYS;
        const target = early ? TARGET_RATE * clamp(h.termDay / GRACE_DAYS, 0.15) : TARGET_RATE;
        const points = h.current && h.current.expected > 0 ? weight * clamp(rate / target) : weight;
        add({
            id: 'collection', label: 'Collection rate this term', weight, points,
            detail: !h.current || h.current.expected === 0 ? 'Nothing billed this term yet.' : `${rate}% of what was billed is in${early ? `, ${h.termDay} days into the term` : ''}.`,
            fix: `Text reminders to families who owe, and call those who have not paid. Aim for ${TARGET_RATE}%.`,
            target: { kind: 'tab', tab: 'defaulters' },
        });
    }

    // Unmatched money (15): none waiting, or none older than a week.
    {
        const weight = 15;
        const points = h.unmatchedCount === 0 ? weight : h.unmatchedOldestDays <= 3 ? weight * 0.7 : h.unmatchedOldestDays <= 7 ? weight * 0.4 : 0;
        add({
            id: 'unmatched', label: 'Payments matched to learners', weight, points,
            detail: h.unmatchedCount === 0 ? 'Every payment is on a learner.' : `${plural(h.unmatchedCount, 'payment')} (KSh ${h.unmatchedAmount.toLocaleString()}) waiting, the oldest ${plural(h.unmatchedOldestDays, 'day')}.`,
            fix: 'Match them on Reconcile: each shows who it most likely belongs to.',
            target: { kind: 'tab', tab: 'reconcile' },
        });
    }

    // Statement reconciled within a week (15).
    {
        const weight = 15;
        const none = h.traceablePayments30d === 0;
        const days = h.daysSinceStatement;
        const points = none ? weight : days === null ? 0 : days <= 7 ? weight : days <= 14 ? weight * 0.5 : 0;
        add({
            id: 'statement', label: 'Statement checked this week', weight, points,
            detail: none ? 'No M-Pesa or bank payments in the last 30 days to check.'
                : days === null ? 'No M-Pesa or bank statement has been checked yet.'
                : days === 0 ? 'A statement was checked today.' : `The last statement was checked ${plural(days, 'day')} ago.`,
            fix: 'Download this week’s M-Pesa (or bank) statement and upload it on Reconcile: the totals must agree.',
            target: { kind: 'tab', tab: 'reconcile' },
        });
    }

    // Days signed off (15): of the last week's days with payments.
    {
        const weight = 15;
        const share = h.daysWithPayments === 0 ? 1 : h.daysReviewed / h.daysWithPayments;
        const left = h.daysWithPayments - h.daysReviewed;
        add({
            id: 'review', label: 'Each day’s takings signed off', weight, points: weight * share,
            detail: h.daysWithPayments === 0 ? 'No payments in the last 7 days.' : left === 0 ? 'Every day of the last week is signed off.' : `${plural(left, 'day')} of the last week not signed off (or changed since).`,
            fix: 'Have someone other than the person who recorded the money sign each day off in the Day book.',
            target: { kind: 'tab', tab: 'daybook' },
        });
    }

    // Families who have paid nothing this term (10): none, up to a quarter of those billed.
    {
        const weight = 10;
        const billed = h.current?.learners ?? 0;
        const nothing = h.current?.paidNothing ?? 0;
        const share = billed > 0 ? nothing / billed : 0;
        // Families pay over the first weeks of term: no penalty until then.
        const early = h.termDay < GRACE_DAYS;
        const points = early ? weight : weight * clamp(1 - share / 0.25);
        add({
            id: 'nothing', label: 'Families who have paid something', weight, points,
            detail: billed === 0 ? 'Nobody billed this term yet.'
                : nothing === 0 ? 'Every family billed this term has paid something.'
                : `${plural(nothing, 'learner')} of ${billed.toLocaleString()} billed this term ${nothing === 1 ? 'has' : 'have'} paid nothing${early ? ', early in the term' : ''}.`,
            fix: 'Call these families first, and write down what they promise.',
            target: { kind: 'tab', tab: 'defaulters', focus: 'nothing' },
        });
    }

    // Promises kept (5).
    {
        const weight = 5;
        const points = h.brokenPromises === 0 ? weight : h.brokenPromises <= 2 ? weight * 0.5 : 0;
        add({
            id: 'promises', label: 'Promises to pay kept', weight, points,
            detail: h.brokenPromises === 0 ? 'No broken promises.' : `${plural(h.brokenPromises, 'family', 'families')} missed the date they promised.`,
            fix: 'Follow up the broken promises: call, agree a new date, and write it down.',
            target: { kind: 'tab', tab: 'defaulters', focus: 'broken' },
        });
    }

    // A parent's phone for everyone who owes (10).
    {
        const weight = 10;
        const share = h.learnersOwing > 0 ? h.owingWithoutPhone / h.learnersOwing : 0;
        add({
            id: 'phones', label: 'Parents reachable', weight, points: weight * clamp(1 - share / 0.2),
            detail: h.owingWithoutPhone === 0 ? 'Every learner who owes has a parent’s phone.'
                : h.owingWithoutPhone === 1 ? '1 learner who owes has no parent phone, so no reminder reaches them.'
                : `${plural(h.owingWithoutPhone, 'learner')} who owe have no parent phone, so no reminder reaches them.`,
            fix: 'Add parents’ phones (Parent accounts › Link parents for a class).',
            target: { kind: 'link', href: '/dashboard/parent-accounts?tab=class' },
        });
    }

    const score = Math.round(items.reduce((n, i) => n + i.points, 0));
    const fixes = items
        .filter(i => i.status !== 'ok')
        .sort((a, b) => (b.weight - b.points) - (a.weight - a.points))
        .slice(0, 3);
    return { score, grade: score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : 'POOR', items, fixes };
}

export const GRADE_COPY: Record<HealthCheck['grade'], { label: string; hue: 'emerald' | 'amber' | 'rose' }> = {
    GOOD: { label: 'In good shape', hue: 'emerald' },
    FAIR: { label: 'Needs attention', hue: 'amber' },
    POOR: { label: 'At risk', hue: 'rose' },
};
