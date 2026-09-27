import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, type Access } from '@/lib/platform/access';
import { embedOne } from '@/lib/postgrest';
import type { CurrentStudent } from '@/types';

/**
 * A child the signed-in parent is linked to, shaped like a signed-in learner
 * so the learner queries (results, attendance, reports) can be reused as-is.
 */
export async function loadLinkedChild(access: Access, studentId: string): Promise<CurrentStudent> {
    if (access.role !== 'PARENT') throw new HttpError(403, 'This page is for parents.');
    const db = createSupabaseAdmin();
    const { data: link, error } = await db.from('student_guardians')
        .select('student_id').eq('parent_user_id', access.userId).eq('student_id', studentId).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!link) throw new HttpError(404, 'Child not found.');
    const { data: s, error: sError } = await db.from('students')
        .select('id, admission_number, current_grade_stream_id, academic_level_id, school_id, user:users(first_name, last_name, email)')
        .eq('id', studentId).maybeSingle();
    if (sError) throw sError;
    if (!s) throw new HttpError(404, 'Child not found.');
    const u = embedOne<{ first_name: string; last_name: string; email: string }>(s.user);
    return {
        userId: s.id as string,
        studentId: s.id as string,
        role: 'STUDENT',
        fullName: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim(),
        email: u?.email ?? '',
        admissionNumber: (s.admission_number as string | null) ?? '',
        gradeStreamId: s.current_grade_stream_id as string,
        academicLevelId: s.academic_level_id as string,
        schoolId: s.school_id as string,
    };
}
