import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * How a school positions learners on report cards.
 *
 * - 8-4-4 always ranks.
 * - CBC ranks only when the school opts in: KNEC does not rank KPSEA/KJSEA
 *   candidates or schools, and competency-based assessment reports
 *   performance levels rather than positions.
 * - For CBC Senior School, the overall position is counted against the whole
 *   grade, the learner's pathway, or their subject combination — always
 *   across every stream of the grade.
 */
export const SENIOR_RANK_GROUPS = ['GRADE', 'PATHWAY', 'COMBINATION'] as const;
export type SeniorRankGroup = (typeof SENIOR_RANK_GROUPS)[number];

export const SENIOR_RANK_GROUP_OPTIONS: Record<SeniorRankGroup, { label: string; description: string }> = {
    GRADE: { label: 'Whole grade', description: 'Every Grade 10, 11 or 12 learner is ranked together, whatever their pathway.' },
    PATHWAY: { label: 'By pathway', description: 'STEM, Social Sciences and Arts & Sports learners are each ranked among themselves.' },
    COMBINATION: { label: 'By subject combination', description: 'Learners are ranked only against others taking the same three electives.' },
};

export function isSeniorRankGroup(value: unknown): value is SeniorRankGroup {
    return typeof value === 'string' && (SENIOR_RANK_GROUPS as readonly string[]).includes(value);
}

export type RankingSettings = { cbcRankingEnabled: boolean; seniorRankGroup: SeniorRankGroup };

export const DEFAULT_RANKING_SETTINGS: RankingSettings = { cbcRankingEnabled: false, seniorRankGroup: 'GRADE' };

export async function loadRankingSettings(supabase: SupabaseClient, schoolId: string): Promise<RankingSettings> {
    const { data } = await supabase
        .from('schools')
        .select('cbc_ranking_enabled, senior_rank_group')
        .eq('id', schoolId)
        .maybeSingle();
    if (!data) return DEFAULT_RANKING_SETTINGS;
    return {
        cbcRankingEnabled: data.cbc_ranking_enabled === true,
        seniorRankGroup: isSeniorRankGroup(data.senior_rank_group) ? data.senior_rank_group : 'GRADE',
    };
}

/** Whether report cards of this curriculum print positions for this school. */
export function ranksCurriculum(settings: RankingSettings, gradingSystemType: 'KCSE' | 'CBC'): boolean {
    return gradingSystemType === 'KCSE' || settings.cbcRankingEnabled;
}
