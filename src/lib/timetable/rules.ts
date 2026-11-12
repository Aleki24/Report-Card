/**
 * A school's own timetable rules, as aSc's card relationships: two subjects
 * never on the same day, never one straight after the other, a subject never
 * on two days in a row. Each is a must or a preference. Plus switches for
 * the built-in rules on doubles, and the subjects whose doubles may run
 * across a short break. Client-safe: the studio (web and phone) and the
 * generator share these.
 */
import { z } from 'zod';

export const RULE_KINDS = ['not_same_day', 'not_after', 'no_days_in_row'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_STRENGTHS = ['must', 'prefer'] as const;
export type RuleStrength = (typeof RULE_STRENGTHS)[number];

/** How each kind reads, and how many subjects it takes. */
export const RULE_KIND_COPY: Readonly<Record<RuleKind, { label: string; hint: string; subjects: 1 | 2 }>> = {
    not_same_day: { label: 'Not on the same day', hint: 'e.g. Music and Art on different days', subjects: 2 },
    not_after: { label: 'Never one straight after the other', hint: 'e.g. Mathematics never next to Physics', subjects: 2 },
    no_days_in_row: { label: 'Not on two days in a row', hint: 'e.g. Biology on Mon, Wed, Fri rather than Mon, Tue, Wed', subjects: 1 },
};

export const RULE_STRENGTH_COPY: Readonly<Record<RuleStrength, { label: string; hint: string }>> = {
    must: { label: 'Must', hint: 'Broken only when nothing else fits' },
    prefer: { label: 'Prefer', hint: 'Kept when it costs little else' },
};

const id = z.string().trim().min(1).max(64);

/** One subject as the school names it, with its id at every level that teaches it (each level has its own Mathematics). */
const subjectIds = z.array(id).min(1).max(20);

export const timetableRuleSchema = z.object({
    id,
    kind: z.enum(RULE_KINDS),
    /** The rule's one or two subjects, each as its ids across levels. */
    subject_ids: z.array(subjectIds).min(1).max(2),
    /** The classes it holds for; empty, every class. */
    stream_ids: z.array(id).max(100).default([]),
    strength: z.enum(RULE_STRENGTHS).default('prefer'),
}).refine(r => r.subject_ids.length === RULE_KIND_COPY[r.kind].subjects, { message: 'Pick the subjects this rule needs', path: ['subject_ids'] })
    .refine(r => r.subject_ids.length < 2 || !r.subject_ids[0].some(x => r.subject_ids[1].includes(x)), { message: 'Pick two different subjects', path: ['subject_ids'] });

export type TimetableRule = z.infer<typeof timetableRuleSchema>;

/** The built-in rules on doubles, each on unless the school turns it off. */
export const doubleRulesSchema = z.object({
    /** At most one double a day for a class, while the week allows. */
    one_a_day: z.boolean().default(true),
    /** Never a double straight after another; only lunch parts them. */
    not_after_double: z.boolean().default(true),
    /** A class's doubles at different times of day, not every one first thing. */
    vary_times: z.boolean().default(true),
});
export type DoubleRules = z.infer<typeof doubleRulesSchema>;
export const DEFAULT_DOUBLE_RULES: DoubleRules = { one_a_day: true, not_after_double: true, vary_times: true };

export const DOUBLE_RULE_COPY: readonly { key: keyof DoubleRules; label: string; hint: string }[] = [
    { key: 'one_a_day', label: 'One double a day', hint: 'A class gets at most one double each day, while its week allows.' },
    { key: 'not_after_double', label: 'No double after a double', hint: 'Two doubles never run on end; a short break does not part them, lunch does.' },
    { key: 'vary_times', label: 'Doubles at different times', hint: 'A class’s doubles start at different times of day, not all first thing.' },
];

export const MAX_RULES = 100;

/** Reads a rule as a sentence: "Chemistry and Physics not on the same day". `nameOf` names a subject by any of its ids. */
export function ruleSentence(rule: Pick<TimetableRule, 'kind' | 'subject_ids'>, nameOf: (subjectIds: readonly string[]) => string): string {
    const [a, b] = rule.subject_ids.map(nameOf);
    switch (rule.kind) {
        case 'not_same_day': return `${a} and ${b} not on the same day`;
        case 'not_after': return `${a} never straight after ${b}, or ${b} after ${a}`;
        case 'no_days_in_row': return `${a} not on two days in a row`;
    }
}

/** A new rule's id: short, unique enough within a school's hundred rules. */
export const newRuleId = (): string => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** What a rule needs of a class: the subject's lessons there, by the ids it covers. */
interface RuleLoad { subjectId: string; lessons: number; doubles: number }
interface RuleClass { streamId: string; name: string; core: readonly RuleLoad[]; blocks: readonly { lessons: number; loads: readonly RuleLoad[] }[] }

/**
 * Days a subject needs in a class: one per lesson, a double one day; 0 when
 * the class does not take it. An elective in an option block is on every day
 * its block is, since the block's slots are shared.
 */
function daysNeeded(c: RuleClass, ids: readonly string[], schoolDays: number): number {
    const own = c.core.filter(l => ids.includes(l.subjectId)).map(l => l.lessons - l.doubles);
    const inBlocks = c.blocks.filter(b => b.loads.some(l => ids.includes(l.subjectId))).map(b => b.lessons - Math.min(...b.loads.map(l => l.doubles)));
    return Math.min(schoolDays, Math.max(0, ...own, ...inBlocks));
}

/**
 * Classes where a rule cannot be kept whatever the timetable, and why: two
 * subjects needing more days between them than the week has, or a subject on
 * more than every other day. The generator still tries; the studio says so.
 */
export function ruleConflicts(rule: Pick<TimetableRule, 'kind' | 'subject_ids' | 'stream_ids'>, classes: readonly RuleClass[], schoolDays: number): string[] {
    const out: string[] = [];
    for (const c of classes) {
        if (rule.stream_ids.length > 0 && !rule.stream_ids.includes(c.streamId)) continue;
        const [a, b] = rule.subject_ids.map(ids => daysNeeded(c, ids, schoolDays));
        if (rule.kind === 'not_same_day' && a > 0 && b > 0 && a + b > schoolDays) {
            out.push(`${c.name}: they need ${a} and ${b} days of a ${schoolDays}-day week, so they must share some days.`);
        }
        if (rule.kind === 'no_days_in_row' && a > Math.ceil(schoolDays / 2)) {
            out.push(`${c.name}: it is on ${a} days of ${schoolDays}, so some of them must be next to each other.`);
        }
    }
    return out;
}

/** The studio's one-line summary: "2 rules · doubles as standard". */
export function rulesSummary(config: { rules: { relations: readonly unknown[]; doubles: DoubleRules } }): string {
    const n = config.rules.relations.length;
    const off = DOUBLE_RULE_COPY.filter(r => !config.rules.doubles[r.key]).length;
    return [n > 0 ? `${n} rule${n === 1 ? '' : 's'} of your own` : 'No rules of your own', off > 0 ? `${off} double rule${off === 1 ? '' : 's'} off` : 'Doubles as standard'].join(' · ');
}
