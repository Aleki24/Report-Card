/**
 * Offering subjects from the standard catalogue.
 *
 * Shared by the Subjects page ("add the standard subjects for this level")
 * and onboarding, so a school that finishes setup can create exams straight
 * away instead of discovering later that it offers nothing.
 *
 * Matching is by code, never by name: `MATH_LP` and `MATH_UP` are both called
 * "Mathematics" and a school running both bands needs both rows.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { bandForGrade, type CurriculumBand, type GradeLike } from '@/lib/curriculum-bands';
import { offerSubjects } from '@/lib/school-subjects';
import { PREDEFINED_SUBJECTS, type EducationLevel } from '@/lib/subject-definitions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/**
 * The curriculum band each catalogue level belongs to. `academic_levels` has a
 * single CBC row covering Grade 1 to Grade 12, so the level alone cannot say
 * whether a subject is Lower Primary or Senior School; this can.
 */
export const BAND_BY_LEVEL: Record<EducationLevel, string> = {
    CBC_LOWER_PRIMARY: 'LP',
    CBC_UPPER_PRIMARY: 'UP',
    CBC_JUNIOR_SCHOOL: 'JS',
    CBC_SENIOR_SCHOOL: 'SS',
    '844_SECONDARY': 'SEC',
};

/** Which catalogue level a class's subjects come from. 8-4-4 primary has no catalogue. */
const LEVEL_BY_BAND: Partial<Record<CurriculumBand, EducationLevel>> = {
    CBC_PRE_PRIMARY: 'CBC_LOWER_PRIMARY',
    CBC_LOWER_PRIMARY: 'CBC_LOWER_PRIMARY',
    CBC_UPPER_PRIMARY: 'CBC_UPPER_PRIMARY',
    CBC_JUNIOR_SCHOOL: 'CBC_JUNIOR_SCHOOL',
    CBC_SENIOR_SCHOOL: 'CBC_SENIOR_SCHOOL',
    '844_SECONDARY': '844_SECONDARY',
};

export function catalogueLevelForGrade(grade: GradeLike): EducationLevel | null {
    const band = bandForGrade(grade);
    return band ? LEVEL_BY_BAND[band] ?? null : null;
}

/**
 * Compulsory subjects that are really one-of-two, so offering them to a whole
 * class by default would put everyone on a sheet only some sit: Kenya Sign
 * Language is the alternative to Kiswahili for deaf learners, and 8-4-4
 * Mathematics Alternative B the alternative to Alternative A.
 */
const ALTERNATIVE_CODES = new Set(['KSL_LP', 'KSL_UP', 'KSL_JS', '122']);

/** The subjects every learner at this level takes — what onboarding offers. */
export function compulsoryCodes(level: EducationLevel): string[] {
    return PREDEFINED_SUBJECTS
        .filter(s => s.level === level && s.isCore && !ALTERNATIVE_CODES.has(s.code))
        .map(s => s.code);
}

export class StandardSubjectsError extends Error {}

/**
 * Offer standard subjects of one level — all of them, or only `codes`.
 * Codes the level doesn't list are ignored, so this can never mint a
 * catalogue row nobody defined. A catalogue subject this instance has never
 * seen is created once, and then belongs to everybody.
 */
export async function offerStandardSubjects(
    supabase: Db,
    schoolId: string,
    level: EducationLevel,
    codes?: readonly string[],
): Promise<{ created: number; skipped: number }> {
    const levelCode = level.startsWith('844') ? '844' : 'CBC';
    const { data: academicLevel } = await supabase.from('academic_levels').select('id').eq('code', levelCode).maybeSingle();
    if (!academicLevel) throw new StandardSubjectsError(`No ${levelCode} academic level exists.`);

    const requested = codes ? new Set(codes.map(c => c.toUpperCase())) : null;
    const wanted = PREDEFINED_SUBJECTS.filter(s => s.level === level && (!requested || requested.has(s.code.toUpperCase())));
    if (wanted.length === 0) return { created: 0, skipped: 0 };

    const { data: catalogue, error: catalogueError } = await supabase
        .from('subjects')
        .select('id, code')
        .is('origin_school_id', null);
    if (catalogueError) throw catalogueError;
    const byCode = new Map((catalogue ?? []).map(row => [(row.code as string || '').trim().toUpperCase(), row.id as string]));

    const missing = wanted.filter(s => !byCode.has(s.code.trim().toUpperCase()));
    if (missing.length > 0) {
        const { data: added, error: addError } = await supabase
            .from('subjects')
            .insert(missing.map((s, i) => ({
                code: s.code,
                name: s.name,
                academic_level_id: academicLevel.id,
                subject_type: s.isCore ? 'CORE' : 'OPTIONAL',
                category: s.category || 'TECHNICAL',
                display_order: i,
                band: BAND_BY_LEVEL[level],
                origin_school_id: null,
            })))
            .select('id, code');
        if (addError) throw addError;
        for (const row of added ?? []) byCode.set((row.code as string || '').trim().toUpperCase(), row.id as string);
    }

    const subjectIds = wanted
        .map(s => byCode.get(s.code.trim().toUpperCase()))
        .filter((id): id is string => Boolean(id));
    const { created, error } = await offerSubjects(supabase, schoolId, subjectIds);
    if (error) throw error;
    return { created, skipped: wanted.length - created };
}
