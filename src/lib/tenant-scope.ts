import { createSupabaseAdmin } from '@/lib/supabase-admin';

/*
 * Ownership checks for ids that arrive in a request. The service-role client
 * bypasses RLS, so an id taken from a query string or body is only this
 * school's if a query says so.
 */

async function belongsToSchool(table: 'terms' | 'grade_streams', id: string, schoolId: string): Promise<boolean> {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
        .from(table)
        .select('id')
        .eq('id', id)
        .eq('school_id', schoolId)
        .maybeSingle();
    return Boolean(data);
}

/**
 * Whether a term id is one of the school's terms. Report queries filter exams
 * by term id alone, so a foreign term id pulled another school's exams (and
 * subject list) into the document.
 */
export function termBelongsToSchool(termId: string, schoolId: string): Promise<boolean> {
    return belongsToSchool('terms', termId, schoolId);
}

/**
 * Whether a grade stream (class) id is one of the school's classes, so a
 * record cannot be pinned to another school's class.
 */
export function streamBelongsToSchool(streamId: string, schoolId: string): Promise<boolean> {
    return belongsToSchool('grade_streams', streamId, schoolId);
}
