import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { CurrentStudent } from '@/types';

export async function getCurrentStudent(): Promise<CurrentStudent | null> {
    const clerkAuth = await auth();
    if (!clerkAuth?.userId) return null;

    const userId = clerkAuth.userId;

    const supabase = createSupabaseAdmin();
    const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('id', userId)
        .maybeSingle();

    if (!userProfile) {
        console.error('[getCurrentStudent] no users row for id', userId, userError);
        return null;
    }
    if (userProfile.role !== 'STUDENT') {
        console.error('[getCurrentStudent] role is not STUDENT', userId, userProfile.role);
        return null;
    }
    if (!userProfile.school_id) {
        console.error('[getCurrentStudent] users.school_id is null', userId);
        return null;
    }

    const schoolId = userProfile.school_id;

    const { data, error } = await supabase
        .from('students')
        .select(`
            id,
            admission_number,
            current_grade_stream_id,
            academic_level_id,
            users!inner (
                id,
                first_name,
                last_name,
                email,
                school_id
            )
        `)
        .eq('id', userId)
        .eq('users.school_id', schoolId)
        .maybeSingle();

    if (error || !data) {
        console.error('[getCurrentStudent] no students row for id', userId, 'schoolId', schoolId, error);
        return null;
    }

    const user = data.users as any;

    return {
        userId: user.id,
        studentId: data.id,
        role: 'STUDENT',
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        admissionNumber: data.admission_number,
        gradeStreamId: data.current_grade_stream_id,
        academicLevelId: data.academic_level_id,
        schoolId: user.school_id,
    };
}

/**
 * Requires a student session. Returns 401/403 Response objects if not valid.
 */
export async function requireStudent(): Promise<CurrentStudent> {
    const student = await getCurrentStudent();
    if (!student) {
        throw new Response(JSON.stringify({ error: 'Unauthorized: Student access required' }), { status: 403 });
    }
    return student;
}
