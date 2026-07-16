import type { SeniorPathway } from './subject-definitions';

/**
 * CBC Senior School (Grades 10-12) pathway & track vocabulary.
 *
 * Every senior learner takes 7 subjects: 4 compulsory cores + 3
 * electives picked from the three official pathways below. Learners
 * may take all 3 electives from one pathway or blend 2+1 across
 * pathways. The Ministry publishes "subject combination" codes that
 * pin a track + exact 3 electives; a combination needs a minimum of
 * 15 learners to run as its own class group.
 */

export type CbcPathway = SeniorPathway; // 'STEM' | 'ARTS_SPORTS' | 'SOCIAL_SCIENCES'

export const PATHWAYS: Record<CbcPathway, { label: string; tracks: string[] }> = {
    STEM: {
        label: 'STEM',
        tracks: [
            'Pure Sciences',
            'Applied Sciences',
            'Technology & Engineering',
            'Career & Technical Studies',
        ],
    },
    SOCIAL_SCIENCES: {
        label: 'Social Sciences',
        tracks: [
            'Humanities & Business Studies',
            'Languages & Literature',
        ],
    },
    ARTS_SPORTS: {
        label: 'Arts & Sports Science',
        tracks: [
            'Performing Arts',
            'Visual Arts',
            'Sports Science',
        ],
    },
};

export const PATHWAY_ORDER: CbcPathway[] = ['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS'];

export function pathwayLabel(pathway?: string | null): string {
    if (!pathway) return '';
    return PATHWAYS[pathway as CbcPathway]?.label ?? pathway;
}

/**
 * Compulsory core subjects every senior-school learner takes,
 * matched against `subjects.code` (see PREDEFINED_SUBJECTS senior
 * section). English and Kenya Sign Language are alternatives — the
 * enrollment sync enrolls whichever of the two the school has
 * created (both when both exist; schools running both should create
 * only the one they actually teach per cohort).
 */
export const SENIOR_CORE_SUBJECT_CODES = ['ENG_SS', 'KSL_SS', 'KISW_SS', 'CSL_SS', 'PE_SS'];

export interface MinistryCombinationTemplate {
    code: string;
    name: string;
    pathway: CbcPathway;
    track: string;
    /** Exactly 3 elective subject codes (matched to school subjects by `code`) */
    subjectCodes: [string, string, string];
}

/**
 * Starter templates for common ministry subject combinations. Used
 * only as a prefill in the combinations manager UI — schools can
 * adjust the electives before saving, and codes only resolve when
 * the school has created subjects with matching codes.
 */
export const MINISTRY_COMBINATION_TEMPLATES: MinistryCombinationTemplate[] = [
    // ── STEM ──
    { code: 'PSC-BCM', name: 'Pure Sciences (Bio/Chem/Math)', pathway: 'STEM', track: 'Pure Sciences', subjectCodes: ['BIO_SS', 'CHEM_SS', 'MATH_SS'] },
    { code: 'PSC-PCM', name: 'Pure Sciences (Phy/Chem/Math)', pathway: 'STEM', track: 'Pure Sciences', subjectCodes: ['PHY_SS', 'CHEM_SS', 'MATH_SS'] },
    { code: 'ASC-AGR', name: 'Applied Sciences (Agriculture)', pathway: 'STEM', track: 'Applied Sciences', subjectCodes: ['AGRI_SS', 'BIO_SS', 'GSCI_SS'] },
    { code: 'ASC-HSC', name: 'Applied Sciences (Home Science)', pathway: 'STEM', track: 'Applied Sciences', subjectCodes: ['HOME_SS', 'BIO_SS', 'GSCI_SS'] },
    { code: 'ASC-CSC', name: 'Applied Sciences (Computer Science)', pathway: 'STEM', track: 'Applied Sciences', subjectCodes: ['COMP_SS', 'MATH_SS', 'PHY_SS'] },
    { code: 'TEC-DDM', name: 'Technology & Engineering (Design)', pathway: 'STEM', track: 'Technology & Engineering', subjectCodes: ['DD_SS', 'MATH_SS', 'PHY_SS'] },
    { code: 'TEC-BCN', name: 'Technology & Engineering (Building)', pathway: 'STEM', track: 'Technology & Engineering', subjectCodes: ['BC_SS', 'MATH_SS', 'PHY_SS'] },

    // ── Social Sciences ──
    { code: 'HBS-BGH', name: 'Humanities & Business (Bus/Geo/Hist)', pathway: 'SOCIAL_SCIENCES', track: 'Humanities & Business Studies', subjectCodes: ['BS_SS', 'GEO_SS', 'HC_SS'] },
    { code: 'HBS-BGR', name: 'Humanities & Business (Bus/Geo/RE)', pathway: 'SOCIAL_SCIENCES', track: 'Humanities & Business Studies', subjectCodes: ['BS_SS', 'GEO_SS', 'RE_SS'] },
    { code: 'LLT-LIT', name: 'Languages & Literature', pathway: 'SOCIAL_SCIENCES', track: 'Languages & Literature', subjectCodes: ['LIT_SS', 'AENG_SS', 'KK_SS'] },
    { code: 'LLT-FLL', name: 'Languages & Literature (Foreign)', pathway: 'SOCIAL_SCIENCES', track: 'Languages & Literature', subjectCodes: ['FL_SS', 'LIT_SS', 'HC_SS'] },

    // ── Arts & Sports Science ──
    { code: 'SPORTS', name: 'Sports Science', pathway: 'ARTS_SPORTS', track: 'Sports Science', subjectCodes: ['SR_SS', 'BIO_SS', 'GEO_SS'] },
    { code: 'PFA-MTF', name: 'Performing Arts', pathway: 'ARTS_SPORTS', track: 'Performing Arts', subjectCodes: ['MD_SS', 'TF_SS', 'LIT_SS'] },
    { code: 'VSA-FAD', name: 'Visual Arts', pathway: 'ARTS_SPORTS', track: 'Visual Arts', subjectCodes: ['FA_SS', 'TF_SS', 'BS_SS'] },
];
