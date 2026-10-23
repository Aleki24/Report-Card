import type { PostgrestError } from '@supabase/supabase-js';

/** Writes to exam_marks name who saved them, read by the history trigger. */

export const MARK_HISTORY_TABLE = 'exam_mark_history';

/** PostgREST "column not found": exam_marks.updated_by isn't there yet. */
const MISSING_COLUMN = 'PGRST204';
/** Postgres "undefined_table". */
export const MISSING_TABLE = '42P01';

/**
 * Runs a mark write stamped with its author, and once more without the stamp
 * if the database doesn't have the column yet, so saving marks never depends
 * on the migration having been applied.
 */
export async function writeWithAuthor<R extends { error: PostgrestError | null }>(write: (stamp: boolean) => PromiseLike<R>): Promise<R> {
    const result = await write(true);
    return result.error?.code === MISSING_COLUMN ? write(false) : result;
}

/** The rows with `updated_by` set when `stamp` is true. */
export function stamped<T extends object>(rows: T[], userId: string | null, stamp: boolean): (T & { updated_by?: string | null })[] {
    return stamp ? rows.map(r => ({ ...r, updated_by: userId })) : rows;
}
