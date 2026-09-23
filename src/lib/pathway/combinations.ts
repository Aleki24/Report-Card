import type { SupabaseClient } from '@supabase/supabase-js';
import type { CbcPathway } from '@/lib/pathway-definitions';
import { allOffered } from '@/lib/school-subjects';

export type NewCombination = {
    code: string;
    name: string;
    pathway: CbcPathway;
    track: string | null;
    /** Exactly three elective subject ids, all offered by the school. */
    subjectIds: string[];
    isActive?: boolean;
};

export type CombinationRow = { id: string; code: string; name: string; pathway: CbcPathway; track: string | null };

export class CombinationError extends Error {}

/**
 * Create a school's subject combination with its three electives, all or
 * nothing. Shared by the Combinations tab and the placement tool so both
 * enforce the same rules.
 */
export async function createSchoolCombination(
    supabase: SupabaseClient,
    schoolId: string,
    input: NewCombination
): Promise<CombinationRow> {
    if (new Set(input.subjectIds).size !== 3 || !(await allOffered(supabase, schoolId, input.subjectIds))) {
        throw new CombinationError('All 3 elective subjects must be offered by your school.');
    }

    const { data: combination, error } = await supabase
        .from('subject_combinations')
        .insert({
            school_id: schoolId,
            code: input.code,
            name: input.name,
            pathway: input.pathway,
            track: input.track,
            is_active: input.isActive ?? true,
        })
        .select('id, code, name, pathway, track')
        .single();
    if (error) throw error;

    const { error: junctionError } = await supabase
        .from('subject_combination_subjects')
        .insert(input.subjectIds.map(subject_id => ({ combination_id: combination.id, subject_id })));
    if (junctionError) {
        // Manual rollback — keep combination + electives atomic
        await supabase.from('subject_combinations').delete().eq('id', combination.id);
        throw junctionError;
    }

    return combination as CombinationRow;
}
