import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamWindow } from './exam-windows';

/** Database reads for the exams open for marking (see exam-windows.ts). */

export const EXAM_WINDOWS_TABLE = 'exam_marking_windows';
export const EXAM_REQUESTS_TABLE = 'exam_marking_requests';

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

/** Teachers' requests for one term, or none before the migration is applied. */
export async function readExamRequests(supabase: Db, schoolId: string, termId: string): Promise<{ grade_id: string; requested_by: string; created_at: string }[]> {
    const { data, error } = await supabase
        .from(EXAM_REQUESTS_TABLE)
        .select('grade_id, requested_by, created_at')
        .eq('school_id', schoolId)
        .eq('term_id', termId)
        .returns<{ grade_id: string; requested_by: string; created_at: string }[]>();
    if (error) {
        if ((error as { code?: string }).code === MISSING_TABLE) return [];
        throw new Error(`Failed to load exam requests: ${error.message}`);
    }
    return data ?? [];
}
