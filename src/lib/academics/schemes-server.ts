import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, type Access } from '@/lib/platform/access';
import type { SchemeStatus } from '@/lib/ops/forms/academics';

export type { SchemeStatus };

export interface SchemeRow {
    id: string;
    teacher_id: string;
    status: SchemeStatus;
    title: string;
    subject_id: string;
    grade_stream_id: string;
}

export const SCHEME_DETAIL_SELECT = '*, subject:subjects(name), stream:grade_streams(full_name), term:terms(name), teacher:users!schemes_of_work_teacher_id_fkey(first_name, last_name), reviewer:users!schemes_of_work_reviewed_by_fkey(first_name, last_name)';

/** A scheme the caller may open: their own, or any when they review records. */
export async function loadScheme(id: string, access: Access): Promise<SchemeRow & { isOwner: boolean; isReviewer: boolean }> {
    const { data, error } = await createSupabaseAdmin()
        .from('schemes_of_work')
        .select('id, teacher_id, status, title, subject_id, grade_stream_id')
        .eq('id', id)
        .eq('school_id', access.schoolId)
        .maybeSingle();
    if (error) throw error;
    const isReviewer = access.can('lesson_records.review');
    const isOwner = !!data && data.teacher_id === access.userId && access.can('lesson_records.write');
    if (!data || (!isOwner && !isReviewer)) throw new HttpError(404, 'Scheme not found.');
    return { ...(data as SchemeRow), isOwner, isReviewer };
}

/** Whether the caller may change the scheme's rows now. */
export function canEditScheme(s: { status: SchemeStatus; isOwner: boolean; isReviewer: boolean }): boolean {
    return s.isReviewer || (s.isOwner && (s.status === 'DRAFT' || s.status === 'RETURNED'));
}
