/**
 * KCSE (8-4-4) subject groups, as KNEC sets them, and the rule every
 * candidate's choice follows: at least seven subjects — all of Group I
 * (English, Kiswahili, Mathematics), at least two sciences (Group II), at
 * least one humanity (Group III), the rest from any group. A candidate takes
 * one Religious Education only.
 *
 * Subjects are matched by name, since schools rename them.
 */
export type KcseGroup = 'compulsory' | 'sciences' | 'humanities' | 'technical' | 'languages';

export const KCSE_GROUP_LABEL: Record<KcseGroup, string> = {
    compulsory: 'Compulsory',
    sciences: 'Sciences',
    humanities: 'Humanities',
    technical: 'Technical',
    languages: 'Languages & Business',
};

const RULES: readonly [RegExp, KcseGroup][] = [
    [/english|kiswahili|sign language|^math|mathematics/i, 'compulsory'],
    [/biology|physics|chemistry|general science/i, 'sciences'],
    [/history|geography|religio|\b[chi]re\b/i, 'humanities'],
    [/home science|art|agricultur|wood|metal|building|power mechanic|electric|drawing|aviation|computer/i, 'technical'],
    [/french|german|arabic|music|business|sign/i, 'languages'],
];

export function kcseGroup(subjectName: string): KcseGroup | null {
    return RULES.find(([re]) => re.test(subjectName))?.[1] ?? null;
}

/** Subjects no candidate takes together (one Religious Education only). */
export const kcseExclusive = (a: string, b: string): boolean =>
    /religio|\b[chi]re\b/i.test(a) && /religio|\b[chi]re\b/i.test(b);

/** KCSE's minimum number of subjects a candidate sits. */
export const KCSE_MIN_SUBJECTS = 7;
