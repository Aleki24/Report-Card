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

export const EXAM_REQUESTS_TABLE = 'exam_marking_requests';

/** A class with scheduled exams this term, and which ones. */
export interface ExamClass {
    grade_id: string;
    name: string;
    code: string | null;
    /** Scheduled exam types this class has this term, in running order. */
    types: string[];
}

/** Teachers waiting for an exam to be opened in a class. */
export interface ExamRequest {
    grade_id: string;
    names: string[];
    /** ISO time of the latest request. */
    latest: string;
}

/** GET /api/school/exam-windows */
export interface ExamWindowsResponse {
    termId: string | null;
    termName: string | null;
    data: ExamWindow[];
    /** Whether the caller can open exams (marking.open). */
    canOpen: boolean;
    /** For those who can open exams: every class with scheduled exams this term. */
    classes: ExamClass[];
    /** For those who can open exams: who is waiting, per class. */
    requests: ExamRequest[];
    /** Classes the caller has asked about and is still waiting on. */
    myRequests: string[];
}

/** Rows for one term, or none before the migration is applied. */
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
