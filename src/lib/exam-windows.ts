import type { SupabaseClient } from '@supabase/supabase-js';
import { bandForGrade, BAND_LABELS, type CurriculumBand, type GradeLike } from '@/lib/curriculum-bands';

/**
 * Which exam each class is marking now (see migration
 * 20261023090000_exam_marking_windows). Shared by the API, the admin's
 * "Open for marking" panel and the dashboard reminder.
 */

export const EXAM_WINDOWS_TABLE = 'exam_marking_windows';

export interface ExamWindow {
    grade_id: string;
    exam_type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Postgres "undefined_table": the migration hasn't been applied yet. */
const MISSING_TABLE = '42P01';

/**
 * The open exam per class for one term. Before the migration is applied this
 * reads as "nothing chosen yet", so mark entry keeps working as it did.
 */
export async function readExamWindows(supabase: Db, schoolId: string, termId: string): Promise<ExamWindow[]> {
    const { data, error } = await supabase
        .from(EXAM_WINDOWS_TABLE)
        .select('grade_id, exam_type')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .returns<ExamWindow[]>();
    if (error) {
        if ((error as { code?: string }).code === MISSING_TABLE) return [];
        throw new Error(`Failed to load open exams: ${error.message}`);
    }
    return data ?? [];
}

/** A level's key for grouping classes; classes we can't place share one group. */
export type LevelKey = CurriculumBand | 'OTHER';

export const LEVEL_ORDER: readonly LevelKey[] = [
    'CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL', 'CBC_SENIOR_SCHOOL',
    '844_PRIMARY', '844_SECONDARY', 'OTHER',
];

export function levelOf(grade: GradeLike): LevelKey {
    return bandForGrade(grade) ?? 'OTHER';
}

export function levelLabel(level: LevelKey): string {
    return level === 'OTHER' ? 'Other classes' : BAND_LABELS[level];
}
