/**
 * Subjects taught at the same time: an option group whose learners each take
 * one of its subjects, so the timetable gives them one slot.
 *
 * Some groups hold in every Kenyan school, because no learner can take two of
 * the subjects (built in). Others are a school's own choice of option groups,
 * set in the timetable studio. The planner puts each group's subjects in one
 * block before it works out the rest.
 */
import { BAND_LABELS, type CurriculumBand } from '../curriculum-bands';

export interface TogetherRule {
    /** Null for a built-in rule. */
    id: string | null;
    name: string;
    /** The levels it applies to; empty means every level. */
    bands: CurriculumBand[];
    /** School rules name subjects by id. */
    subjectIds: string[];
    builtIn: boolean;
    /** Built-in rules match subjects by name, since schools rename them. */
    patterns?: readonly RegExp[];
}

/** One rule as the studio shows it. */
export interface TogetherRuleView {
    id: string | null;
    name: string;
    bands: CurriculumBand[];
    /** A school rule's subjects; empty for a built-in one, which matches by name. */
    subjects: string[];
    builtIn: boolean;
}

/** A subject the school timetables, and the levels it is taught at, to pick rules from. */
export interface TogetherSubject { id: string; name: string; bands: CurriculumBand[] }

/** GET /api/academics/timetable/together */
export interface TogetherRules { rules: TogetherRuleView[]; subjects: TogetherSubject[] }

export const TOGETHER_URL = '/api/academics/timetable/together';

/** Subjects no learner takes two of, so any school can teach them at once. */
export const BUILT_IN_TOGETHER: readonly TogetherRule[] = [
    {
        id: null, builtIn: true, name: 'Core / Essential Mathematics', bands: ['CBC_SENIOR_SCHOOL'], subjectIds: [],
        patterns: [/\bcore math|^mathematics\b/i, /essential math/i],
    },
    {
        id: null, builtIn: true, name: 'Religious Education (CRE / IRE / HRE)', bands: [], subjectIds: [],
        patterns: [/\bcre\b|christian relig/i, /\bire\b|islamic relig/i, /\bhre\b|hindu relig/i],
    },
    {
        id: null, builtIn: true, name: 'Kiswahili / Kenyan Sign Language', bands: [], subjectIds: [],
        patterns: [/kiswahili/i, /sign language|\bksl\b/i],
    },
];

const appliesTo = (rule: TogetherRule, band: CurriculumBand | null) => rule.bands.length === 0 || (!!band && rule.bands.includes(band));

/** The subjects of a class a rule takes in: by id for a school rule, by name for a built-in one. */
function membersOf<L extends { subjectId: string; subjectName: string }>(rule: TogetherRule, loads: readonly L[]): L[] {
    if (!rule.patterns) return loads.filter(l => rule.subjectIds.includes(l.subjectId));
    // One subject per pattern, so "Mathematics" and "Essential Mathematics" do not both match the first.
    const taken = new Set<L>();
    for (const re of rule.patterns) {
        const hit = loads.find(l => !taken.has(l) && re.test(l.subjectName));
        if (hit) taken.add(hit);
    }
    return [...taken];
}

/**
 * A class's taught-together groups: each applicable rule's subjects the class
 * has (two or more), rules that share a subject merged into one group.
 */
export function togetherGroups<L extends { subjectId: string; subjectName: string }>(
    loads: readonly L[],
    band: CurriculumBand | null,
    rules: readonly TogetherRule[],
): { name: string; loads: L[] }[] {
    const groups: { names: string[]; loads: Set<L> }[] = [];
    for (const rule of rules) {
        if (!appliesTo(rule, band)) continue;
        const members = membersOf(rule, loads);
        if (members.length < 2) continue;
        const overlapping = groups.filter(g => members.some(m => g.loads.has(m)));
        const merged = { names: [rule.name, ...overlapping.flatMap(g => g.names)], loads: new Set([...members, ...overlapping.flatMap(g => [...g.loads])]) };
        overlapping.forEach(g => groups.splice(groups.indexOf(g), 1));
        groups.push(merged);
    }
    return groups.map(g => ({ name: g.names.length === 1 ? g.names[0] : 'Taught together', loads: [...g.loads] }));
}

/** "Every level", or the levels a rule is for ("8-4-4 Secondary · Senior School"). */
export const ruleScope = (bands: readonly CurriculumBand[]) => (bands.length === 0 ? 'Every level' : bands.map(b => BAND_LABELS[b]).join(' · '));

/** The levels the school timetables, in curriculum order, to scope a new rule. */
export const levelsOf = (subjects: readonly TogetherSubject[]): CurriculumBand[] =>
    (Object.keys(BAND_LABELS) as CurriculumBand[]).filter(b => subjects.some(s => s.bands.includes(b)));

/** Subjects taught at any of these levels (all of them for "every level"). */
export const subjectsAt = (subjects: readonly TogetherSubject[], bands: readonly CurriculumBand[]) =>
    bands.length === 0 ? subjects : subjects.filter(s => s.bands.some(b => bands.includes(b)));

/** One toggled value in a picked list. */
export const toggled = <T>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
