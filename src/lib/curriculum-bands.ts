import { PREDEFINED_SUBJECTS, type EducationLevel } from './subject-definitions';

/**
 * curriculum-bands.ts
 *
 * `academic_levels` only distinguishes CBC from 8-4-4, so every CBC
 * subject — Lower Primary through Senior School — shares one
 * `academic_level_id`. Anything that filtered subjects by that column
 * alone therefore offered all of CBC to every CBC class: "Science and
 * Technology" (a Grade 4–6 learning area) showed up when picking
 * subjects for Grade 11, and Junior School learning areas showed up in
 * Grade 3.
 *
 * This module adds the missing axis — the band a class sits in, and the
 * bands a subject is actually taught in — so the two can be matched.
 *
 * Subjects we don't recognise (a school's own custom subject) are
 * offered everywhere; a school that invents a subject knows better than
 * we do where it belongs, and hiding it would be the worse failure.
 */

export type CurriculumBand =
    | 'CBC_PRE_PRIMARY'
    | 'CBC_LOWER_PRIMARY'
    | 'CBC_UPPER_PRIMARY'
    | 'CBC_JUNIOR_SCHOOL'
    | 'CBC_SENIOR_SCHOOL'
    | '844_PRIMARY'
    | '844_SECONDARY';

export const BAND_LABELS: Record<CurriculumBand, string> = {
    CBC_PRE_PRIMARY: 'Pre-Primary',
    CBC_LOWER_PRIMARY: 'Lower Primary',
    CBC_UPPER_PRIMARY: 'Upper Primary',
    CBC_JUNIOR_SCHOOL: 'Junior School',
    CBC_SENIOR_SCHOOL: 'Senior School',
    '844_PRIMARY': '8-4-4 Primary',
    '844_SECONDARY': '8-4-4 Secondary',
};

/** Pre-primary runs on the Lower Primary learning areas — no separate seeded set. */
const CBC_PRIMARY_BANDS: CurriculumBand[] = ['CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY'];

const CBC_ALL_BANDS: CurriculumBand[] = [
    'CBC_PRE_PRIMARY',
    'CBC_LOWER_PRIMARY',
    'CBC_UPPER_PRIMARY',
    'CBC_JUNIOR_SCHOOL',
    'CBC_SENIOR_SCHOOL',
];

const ALL_844_BANDS: CurriculumBand[] = ['844_PRIMARY', '844_SECONDARY'];

/** How the four CBC sub-levels in `subject-definitions` map onto bands. */
const BANDS_BY_EDUCATION_LEVEL: Record<EducationLevel, CurriculumBand[]> = {
    CBC_LOWER_PRIMARY: CBC_PRIMARY_BANDS,
    CBC_UPPER_PRIMARY: ['CBC_UPPER_PRIMARY'],
    CBC_JUNIOR_SCHOOL: ['CBC_JUNIOR_SCHOOL'],
    CBC_SENIOR_SCHOOL: ['CBC_SENIOR_SCHOOL'],
    '844_SECONDARY': ['844_SECONDARY'],
};

// ─────────────────────────────────────────────────────────────
// Grade → band
// ─────────────────────────────────────────────────────────────

function cbcBandForGradeNumber(n: number): CurriculumBand | null {
    if (n === 0) return 'CBC_PRE_PRIMARY';
    if (n >= 1 && n <= 3) return 'CBC_LOWER_PRIMARY';
    if (n >= 4 && n <= 6) return 'CBC_UPPER_PRIMARY';
    if (n >= 7 && n <= 9) return 'CBC_JUNIOR_SCHOOL';
    if (n >= 10 && n <= 12) return 'CBC_SENIOR_SCHOOL';
    return null;
}

export interface GradeLike {
    code?: string | null;
    name_display?: string | null;
}

/**
 * The band a class belongs to, read from its seeded code (`PP1`, `G7`,
 * `S4`, `F2`) and falling back to its display name. Returns null for a
 * grade we can't place — a school's own naming — which callers treat as
 * "don't filter".
 */
export function bandForGrade(grade: GradeLike | null | undefined): CurriculumBand | null {
    if (!grade) return null;

    const code = (grade.code || '').trim().toUpperCase();
    if (/^PP\d*$/.test(code)) return 'CBC_PRE_PRIMARY';
    const byCode = code.match(/^([GSF])(\d{1,2})$/);
    if (byCode) {
        const n = parseInt(byCode[2], 10);
        if (byCode[1] === 'G') return cbcBandForGradeNumber(n);
        if (byCode[1] === 'S') return '844_PRIMARY';
        return '844_SECONDARY';
    }

    const name = (grade.name_display || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (/^pre[\s-]?primary/.test(name) || /^pp\s*\d*$/.test(name)) return 'CBC_PRE_PRIMARY';
    const byGrade = name.match(/^grade\s*(\d{1,2})\b/);
    if (byGrade) return cbcBandForGradeNumber(parseInt(byGrade[1], 10));
    if (/^(standard|std|class)\s*\d{1,2}\b/.test(name)) return '844_PRIMARY';
    if (/^form\s*\d{1,2}\b/.test(name)) return '844_SECONDARY';

    return null;
}

// ─────────────────────────────────────────────────────────────
// Subject → bands
// ─────────────────────────────────────────────────────────────

/**
 * Bands for the subject codes seeded into the database (`supabase_seed.sql`),
 * which predate the per-band codes in `subject-definitions`.
 *
 * The seed creates a single row for each subject that runs the length of
 * the curriculum — English, Kiswahili, Mathematics, Religious Education —
 * so those stay open across their whole system. Only the band-specific
 * learning areas are pinned down.
 */
const BANDS_BY_SEED_CODE: Record<string, CurriculumBand[]> = {
    // ── CBC through-line subjects: one row covers every band ──
    'CBC-ENG': CBC_ALL_BANDS,
    'CBC-KSW': CBC_ALL_BANDS,
    'CBC-MAT': CBC_ALL_BANDS,
    'CBC-RE': CBC_ALL_BANDS,

    // ── CBC Lower Primary (Grades 1–3) ──
    'CBC-IND': CBC_PRIMARY_BANDS,
    'CBC-ENV': CBC_PRIMARY_BANDS,
    'CBC-HYG': CBC_PRIMARY_BANDS,
    'CBC-CRA': CBC_PRIMARY_BANDS,
    'CBC-PPI': ['CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY'],

    // ── CBC Upper Primary (Grades 4–6) ──
    'CBC-SCI': ['CBC_UPPER_PRIMARY'],
    'CBC-SS': ['CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL'],
    'CBC-AGN': ['CBC_UPPER_PRIMARY'],
    'CBC-CART': ['CBC_UPPER_PRIMARY'],

    // ── CBC Junior School (Grades 7–9) ──
    'CBC-IS': ['CBC_JUNIOR_SCHOOL'],
    'CBC-HE': ['CBC_JUNIOR_SCHOOL'],
    'CBC-SSL': ['CBC_JUNIOR_SCHOOL'],
    'CBC-PTC': ['CBC_JUNIOR_SCHOOL'],
    'CBC-CAS': ['CBC_JUNIOR_SCHOOL'],

    // ── CBC Senior School (Grades 10–12): cores ──
    'CBC-CSL': ['CBC_SENIOR_SCHOOL'],
    'CBC-PE': ['CBC_SENIOR_SCHOOL'],
    'CBC-ICT': ['CBC_SENIOR_SCHOOL'],

    // ── CBC Senior School: pathway electives ──
    'CBC-BIO': ['CBC_SENIOR_SCHOOL'],
    'CBC-CHE': ['CBC_SENIOR_SCHOOL'],
    'CBC-PHY': ['CBC_SENIOR_SCHOOL'],
    'CBC-CS': ['CBC_SENIOR_SCHOOL'],
    'CBC-AGR': ['CBC_SENIOR_SCHOOL'],
    'CBC-ET': ['CBC_SENIOR_SCHOOL'],
    'CBC-AVI': ['CBC_SENIOR_SCHOOL'],
    'CBC-PM': ['CBC_SENIOR_SCHOOL'],
    'CBC-LIT': ['CBC_SENIOR_SCHOOL'],
    'CBC-AENG': ['CBC_SENIOR_SCHOOL'],
    'CBC-ARB': ['CBC_SENIOR_SCHOOL'],
    'CBC-FRE': ['CBC_SENIOR_SCHOOL'],
    'CBC-GER': ['CBC_SENIOR_SCHOOL'],
    'CBC-MAN': ['CBC_SENIOR_SCHOOL'],
    'CBC-HC': ['CBC_SENIOR_SCHOOL'],
    'CBC-GEO': ['CBC_SENIOR_SCHOOL'],
    'CBC-BE': ['CBC_SENIOR_SCHOOL'],
    'CBC-VA': ['CBC_SENIOR_SCHOOL'],
    'CBC-PA': ['CBC_SENIOR_SCHOOL'],
    'CBC-MUS': ['CBC_SENIOR_SCHOOL'],
    'CBC-MT': ['CBC_SENIOR_SCHOOL'],
    'CBC-SPS': ['CBC_SENIOR_SCHOOL'],

    // ── 8-4-4 subjects taught in both primary and secondary ──
    '844-MAT': ALL_844_BANDS,
    '844-ENG': ALL_844_BANDS,
    '844-KSW': ALL_844_BANDS,
    '844-CRE': ALL_844_BANDS,
    '844-IRE': ALL_844_BANDS,
    '844-HRE': ALL_844_BANDS,
    '844-PE': ALL_844_BANDS,
    '844-AGR': ALL_844_BANDS,

    // ── 8-4-4 Primary only (Standard 1–8) ──
    '844-SCI': ['844_PRIMARY'],
    '844-SS': ['844_PRIMARY'],
    '844-CART': ['844_PRIMARY'],
    '844-LS': ['844_PRIMARY'],

    // ── 8-4-4 Secondary only (Forms 1–4) ──
    '844-ARB': ['844_SECONDARY'],
    '844-GER': ['844_SECONDARY'],
    '844-FRE': ['844_SECONDARY'],
    '844-BIO': ['844_SECONDARY'],
    '844-CHE': ['844_SECONDARY'],
    '844-PHY': ['844_SECONDARY'],
    '844-HS': ['844_SECONDARY'],
    '844-CS': ['844_SECONDARY'],
    '844-HIS': ['844_SECONDARY'],
    '844-GEO': ['844_SECONDARY'],
    '844-BS': ['844_SECONDARY'],
    '844-MUS': ['844_SECONDARY'],
    '844-AD': ['844_SECONDARY'],
    '844-WW': ['844_SECONDARY'],
    '844-MW': ['844_SECONDARY'],
    '844-BC': ['844_SECONDARY'],
    '844-PM': ['844_SECONDARY'],
    '844-AVI': ['844_SECONDARY'],
};

/**
 * Last resort for subjects whose code we don't know — a school that
 * created "Science and Technology" under its own code still shouldn't
 * see it offered to Grade 11. Only band-specific learning areas belong
 * here; anything taught across a whole system is deliberately absent so
 * it stays available everywhere.
 */
const BANDS_BY_SUBJECT_NAME: Record<string, CurriculumBand[]> = {
    // Lower Primary
    'indigenous language': CBC_PRIMARY_BANDS,
    'environmental activities': CBC_PRIMARY_BANDS,
    'hygiene and nutrition': CBC_PRIMARY_BANDS,
    'creative activities': CBC_PRIMARY_BANDS,
    'movement and creative activities': CBC_PRIMARY_BANDS,
    'pastoral programme of instruction': ['CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY'],

    // Upper Primary
    'science and technology': ['CBC_UPPER_PRIMARY'],
    'agriculture and nutrition': ['CBC_UPPER_PRIMARY'],
    'creative and movement activities': ['CBC_UPPER_PRIMARY'],

    // Upper Primary + Junior School
    'integrated science': ['CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL'],
    'social studies': ['CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL', '844_PRIMARY'],

    // Junior School
    'health education': ['CBC_JUNIOR_SCHOOL'],
    'social studies and life skills': ['CBC_JUNIOR_SCHOOL'],
    'pre-technical and pre-career education': ['CBC_JUNIOR_SCHOOL'],
    'pre-technical studies': ['CBC_JUNIOR_SCHOOL'],
    'creative arts and sports': ['CBC_JUNIOR_SCHOOL'],

    // Senior School
    'community service learning': ['CBC_SENIOR_SCHOOL'],
    'ict skills': ['CBC_SENIOR_SCHOOL'],
    'kiswahili kipevu': ['CBC_SENIOR_SCHOOL'],
    'advanced english': ['CBC_SENIOR_SCHOOL'],
    'history and citizenship': ['CBC_SENIOR_SCHOOL'],
    'sports and recreation': ['CBC_SENIOR_SCHOOL'],
    'music and dance': ['CBC_SENIOR_SCHOOL'],
    'theatre and film': ['CBC_SENIOR_SCHOOL'],
};

/** Codes from `subject-definitions`, which already carry a sub-level. */
const BANDS_BY_PREDEFINED_CODE: Record<string, CurriculumBand[]> = (() => {
    const map: Record<string, CurriculumBand[]> = {};
    for (const subject of PREDEFINED_SUBJECTS) {
        const bands = BANDS_BY_EDUCATION_LEVEL[subject.level];
        if (!bands) continue;
        const key = subject.code.trim().toUpperCase();
        map[key] = [...new Set([...(map[key] || []), ...bands])];
    }
    return map;
})();

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface SubjectLike {
    name?: string | null;
    code?: string | null;
}

/**
 * The bands a subject is taught in, or null when we don't recognise it
 * (a school's own subject) and it should be offered everywhere.
 *
 * The seeded codes win over `subject-definitions` because a couple of
 * short codes collide across the two vocabularies, and the row in the
 * database is the one the school is actually using.
 */
export function bandsForSubject(subject: SubjectLike | null | undefined): CurriculumBand[] | null {
    if (!subject) return null;

    const code = (subject.code || '').trim().toUpperCase();
    if (code) {
        const seeded = BANDS_BY_SEED_CODE[code];
        if (seeded) return seeded;
        const predefined = BANDS_BY_PREDEFINED_CODE[code];
        if (predefined) return predefined;
    }

    const name = subject.name ? normalizeName(subject.name) : '';
    if (name) {
        const byName = BANDS_BY_SUBJECT_NAME[name];
        if (byName) return byName;
    }

    return null;
}

/** Whether a subject is taught in a given band. Unknown subjects pass. */
export function isSubjectOfferedInBand(
    subject: SubjectLike | null | undefined,
    band: CurriculumBand | null | undefined
): boolean {
    if (!band) return true;
    const bands = bandsForSubject(subject);
    if (!bands) return true;
    return bands.includes(band);
}

/** Whether a subject is taught in a given class's band. */
export function isSubjectOfferedAtGrade(
    subject: SubjectLike | null | undefined,
    grade: GradeLike | null | undefined
): boolean {
    return isSubjectOfferedInBand(subject, bandForGrade(grade));
}

/**
 * Narrow a subject list to what the class actually takes. Returns the
 * list untouched when the class's band can't be determined.
 */
export function filterSubjectsForGrade<T extends SubjectLike>(
    subjects: T[],
    grade: GradeLike | null | undefined
): T[] {
    const band = bandForGrade(grade);
    if (!band) return subjects;
    return subjects.filter(s => isSubjectOfferedInBand(s, band));
}

/**
 * Short band label for a subject, e.g. "Upper Primary" — or "" when the
 * subject isn't pinned to any band.
 */
export function subjectBandLabel(subject: SubjectLike | null | undefined): string {
    const bands = bandsForSubject(subject);
    if (!bands || bands.length === 0) return '';

    const cbc = bands.filter(b => b.startsWith('CBC_'));
    const legacy = bands.filter(b => b.startsWith('844_'));
    const spansAllCbc = cbc.length === CBC_ALL_BANDS.length;
    const spansAll844 = legacy.length === ALL_844_BANDS.length;

    const parts: string[] = [];
    if (spansAllCbc) parts.push('All CBC levels');
    else parts.push(...cbc.map(b => BAND_LABELS[b]));
    if (spansAll844) parts.push('All 8-4-4 levels');
    else parts.push(...legacy.map(b => BAND_LABELS[b]));

    return parts.join(', ');
}
