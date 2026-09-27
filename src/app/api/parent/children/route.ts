import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** The signed-in parent's children in this school. */
export const GET = route('parent children', { module: 'parent_portal' }, async ({ access }) => {
    if (access.role !== 'PARENT') throw new HttpError(403, 'This page is for parents.');
    const { data, error } = await createSupabaseAdmin()
        .from('student_guardians')
        .select('relationship, student:students(id, admission_number, status, stream:grade_streams(full_name), user:users(first_name, last_name))')
        .eq('parent_user_id', access.userId)
        .eq('school_id', access.schoolId);
    if (error) throw error;
    return data ?? [];
});
