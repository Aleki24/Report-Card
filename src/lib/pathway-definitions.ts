import { PREDEFINED_SUBJECTS, type SeniorPathway } from './subject-definitions';
import {
    MINISTRY_COMBINATION_ROWS,
    type CombinationCodePrefix,
    type MinistryCombinationCode,
    type SeniorElectiveCode,
} from './ministry-combinations';

/**
 * CBC Senior School (Grades 10-12) pathways, tracks and combinations, per the
 * Ministry of Education's Grade 10 selection documents (KEMIS, 11 Aug 2026).
 *
 * Every learner takes English, Kiswahili, Community Service Learning and
 * Mathematics, plus the 3 electives of one official subject combination. A
 * combination sits in one of 7 tracks, and each track in one of 3 pathways.
 * A combination needs a minimum of 15 learners to run as its own class group.
 */

export type CbcPathway = SeniorPathway; // 'STEM' | 'ARTS_SPORTS' | 'SOCIAL_SCIENCES'

export const PATHWAYS: Record<CbcPathway, { label: string; tracks: string[] }> = {
    STEM: {
        label: 'STEM',
        tracks: ['Pure Sciences', 'Applied Sciences', 'Technical Studies'],
    },
    SOCIAL_SCIENCES: {
        label: 'Social Sciences',
        tracks: ['Languages & Literature', 'Humanities & Business Studies'],
    },
    ARTS_SPORTS: {
        label: 'Arts & Sports Science',
        tracks: ['Arts', 'Sports'],
    },
};

export const PATHWAY_ORDER: CbcPathway[] = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];

/** The Ministry's combination codes encode the track in their first three characters. */
export const TRACK_BY_CODE_PREFIX: Record<CombinationCodePrefix, { pathway: CbcPathway; track: string }> = {
    ST1: { pathway: 'STEM', track: 'Pure Sciences' },
    ST2: { pathway: 'STEM', track: 'Applied Sciences' },
    ST3: { pathway: 'STEM', track: 'Technical Studies' },
    SS1: { pathway: 'SOCIAL_SCIENCES', track: 'Languages & Literature' },
    SS2: { pathway: 'SOCIAL_SCIENCES', track: 'Humanities & Business Studies' },
    AS1: { pathway: 'ARTS_SPORTS', track: 'Arts' },
    AS2: { pathway: 'ARTS_SPORTS', track: 'Sports' },
};

export function pathwayLabel(pathway?: string | null): string {
    if (!pathway) return '';
    return PATHWAYS[pathway as CbcPathway]?.label ?? pathway;
}

/**
 * Compulsory subjects every senior learner is enrolled in, matched against
 * `subjects.code`. Mathematics is handled separately (see seniorCoreCodes).
 *
 * Kenya Sign Language is deliberately absent: it is an elective in its own
 * right (e.g. SS1059) and the alternative to Kiswahili only for learners who
 * need it, which no rule can infer — enrolling it automatically put every
 * learner at a school offering it into KSL.
 */
export const SENIOR_CORE_SUBJECT_CODES = ['ENG_SS', 'KISW_SS', 'CSL_SS'] as const;

export const CORE_MATHEMATICS_CODE: SeniorElectiveCode = 'MATH_SS';
export const ESSENTIAL_MATHEMATICS_CODE = 'MATH_ESS_SS';

/**
 * The compulsory codes for a learner whose combination has these electives.
 * Core Mathematics is one of the official electives; a learner who does not
 * take it takes Essential Mathematics, never both.
 */
export function seniorCoreCodes(electiveCodes: readonly string[]): string[] {
    const takesCoreMaths = electiveCodes.some(c => c.trim().toUpperCase() === CORE_MATHEMATICS_CODE);
    return takesCoreMaths
        ? [...SENIOR_CORE_SUBJECT_CODES]
        : [...SENIOR_CORE_SUBJECT_CODES, ESSENTIAL_MATHEMATICS_CODE];
}

export interface MinistryCombinationTemplate {
    code: MinistryCombinationCode;
    /** The three subject names, e.g. "Biology, Chemistry, Core Mathematics". */
    name: string;
    pathway: CbcPathway;
    track: string;
    /** Exactly 3 elective subject codes (matched to school subjects by `code`) */
    subjectCodes: readonly [SeniorElectiveCode, SeniorElectiveCode, SeniorElectiveCode];
}

const SUBJECT_NAME_BY_CODE = new Map(
    PREDEFINED_SUBJECTS.filter(s => s.level === 'CBC_SENIOR_SCHOOL').map(s => [s.code, s.name]),
);

/** Every official combination, with its track, pathway and a readable name. */
export const MINISTRY_COMBINATION_TEMPLATES: MinistryCombinationTemplate[] = MINISTRY_COMBINATION_ROWS.map(
    ([code, ...subjectCodes]) => {
        const { pathway, track } = TRACK_BY_CODE_PREFIX[code.slice(0, 3) as CombinationCodePrefix];
        const name = subjectCodes
            .map(c => SUBJECT_NAME_BY_CODE.get(c) ?? c)
            .sort((a, b) => a.localeCompare(b))
            .join(', ');
        return { code, name, pathway, track, subjectCodes };
    },
);
