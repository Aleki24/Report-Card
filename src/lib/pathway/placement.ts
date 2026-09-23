/**
 * Placing learners from the marks already recorded for them.
 *
 * Teachers entered marks only for the learners who actually take each
 * subject, so a learner's marked subjects say what they study. For CBC
 * Senior School that yields a combination and a maths; for 8-4-4 it yields
 * which electives they sit. Pure functions and shared types only — used by
 * the placement API and its screen alike.
 */
import { PREDEFINED_SUBJECTS, type SeniorPathway } from '@/lib/subject-definitions';
import {
    CORE_MATHEMATICS_CODE,
    ESSENTIAL_MATHEMATICS_CODE,
    MINISTRY_COMBINATION_TEMPLATES,
    SENIOR_CORE_SUBJECT_CODES,
    isMathsCode,
    type CbcPathway,
    type MathsCode,
} from '@/lib/pathway-definitions';

export type PlacementMode = 'senior' | '844';

/** Where a senior learner should go — an existing, official or new custom combination. */
export type PlacementTarget =
    | { type: 'existing'; combinationId: string }
    | { type: 'official'; code: string }
    | { type: 'custom'; electiveCodes: string[]; pathway: CbcPathway; name: string };

export type SeniorSuggestion =
    | { kind: 'official'; code: string; name: string; pathway: CbcPathway; track: string; electiveCodes: string[]; maths: MathsCode | null }
    | { kind: 'custom'; name: string; pathway: CbcPathway; electiveCodes: string[]; maths: MathsCode | null }
    | { kind: 'review'; reason: string; electiveCodes: string[]; maths: MathsCode | null }
    | { kind: 'no-marks' };

export type SubjectRef = { id: string; code: string; name: string };

export type SeniorLearnerRow = {
    studentId: string;
    name: string;
    admissionNumber: string;
    markedSubjects: SubjectRef[];
    currentCombinationId: string | null;
    currentMaths: MathsCode | null;
    suggestion: SeniorSuggestion;
    /** The school combination whose electives equal the suggestion, if one exists. */
    matchingCombinationId: string | null;
};

export type SchoolCombinationOption = { id: string; code: string; name: string; pathway: CbcPathway; track: string | null; electiveCodes: string[] };

export type SeniorPlacementResponse = {
    mode: 'senior';
    learners: SeniorLearnerRow[];
    combinations: SchoolCombinationOption[];
};

export type ElectiveLearnerRow = {
    studentId: string;
    name: string;
    admissionNumber: string;
    enrolledSubjectIds: string[];
    /** Electives this learner has marks in. */
    markedSubjectIds: string[];
};

export type ElectivePlacementResponse = {
    mode: '844';
    learners: ElectiveLearnerRow[];
    electives: SubjectRef[];
};

export type PlacementResponse = SeniorPlacementResponse | ElectivePlacementResponse;

const norm = (code: string) => code.trim().toUpperCase();
const COMPULSORY = new Set<string>(SENIOR_CORE_SUBJECT_CODES);

const SENIOR_BY_CODE = new Map(
    PREDEFINED_SUBJECTS.filter(s => s.level === 'CBC_SENIOR_SCHOOL').map(s => [s.code, s]),
);

const OFFICIAL_BY_SET = new Map(
    MINISTRY_COMBINATION_TEMPLATES.map(t => [setKey(t.subjectCodes), t]),
);

/** Order-independent key for a set of subject codes. */
export function setKey(codes: readonly string[]): string {
    return [...new Set(codes.map(norm))].sort().join('|');
}

/** Readable name for a set of electives, e.g. "Biology, Chemistry, Physics". */
export function combinationName(codes: readonly string[]): string {
    return codes.map(c => SENIOR_BY_CODE.get(norm(c))?.name ?? c).sort((a, b) => a.localeCompare(b)).join(', ');
}

/** A school-scoped code for a combination the Ministry doesn't list, e.g. "CUST-BS-COMP-SR" (≤ 20 chars). */
export function customCombinationCode(codes: readonly string[]): string {
    return `CUST-${[...codes].map(c => norm(c).replace(/_SS$/, '')).sort().join('-')}`.slice(0, 20);
}

/** The pathway most of the electives belong to; STEM wins ties (it carries Core Mathematics). */
function majorityPathway(codes: readonly string[]): CbcPathway {
    const counts = new Map<SeniorPathway, number>();
    for (const code of codes) {
        const pathway = SENIOR_BY_CODE.get(norm(code))?.pathway;
        if (pathway) counts.set(pathway, (counts.get(pathway) ?? 0) + 1);
    }
    const order: CbcPathway[] = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];
    return order.reduce((best, p) => ((counts.get(p) ?? 0) > (counts.get(best) ?? 0) ? p : best), order[0]);
}

function officialOrCustom(electives: string[], maths: MathsCode | null): SeniorSuggestion {
    const official = OFFICIAL_BY_SET.get(setKey(electives));
    if (official) {
        return { kind: 'official', code: official.code, name: official.name, pathway: official.pathway, track: official.track, electiveCodes: [...official.subjectCodes], maths };
    }
    return { kind: 'custom', name: combinationName(electives), pathway: majorityPathway(electives), electiveCodes: [...electives].sort(), maths };
}

/**
 * Suggest a senior learner's combination and maths from the subjects they
 * have marks in.
 *
 * Every learner takes one maths. Core Mathematics is usually that maths with
 * three other electives beside it, but it can also be one of the three
 * (e.g. ST1004: Core Mathematics, Biology, Chemistry) — so three non-maths
 * electives are tried first, then two plus Core Mathematics. Anything else is
 * left for a person to decide, with the reason.
 */
export function suggestSeniorPlacement(markedCodes: readonly string[]): SeniorSuggestion {
    const codes = [...new Set(markedCodes.map(norm))];
    if (codes.length === 0) return { kind: 'no-marks' };

    const mathsTaken = codes.filter(isMathsCode);
    const electives = codes.filter(c => !COMPULSORY.has(c) && c !== ESSENTIAL_MATHEMATICS_CODE);
    const nonMaths = electives.filter(c => c !== CORE_MATHEMATICS_CODE);

    if (mathsTaken.length > 1) {
        return { kind: 'review', reason: 'Has marks in both Core and Essential Mathematics', electiveCodes: nonMaths, maths: null };
    }
    const maths = mathsTaken[0] ?? null;

    if (nonMaths.length === 3) return officialOrCustom(nonMaths, maths);
    if (nonMaths.length === 2 && maths === CORE_MATHEMATICS_CODE) return officialOrCustom(electives, null);

    return {
        kind: 'review',
        reason: nonMaths.length > 3
            ? `Has marks in ${nonMaths.length} electives — a combination has 3`
            : `Has marks in only ${nonMaths.length} elective${nonMaths.length === 1 ? '' : 's'} — a combination has 3`,
        electiveCodes: nonMaths,
        maths,
    };
}
