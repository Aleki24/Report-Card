// src/lib/student/get-current-student.ts
// ============================================================
// Server-side helper to resolve the current student from
// NextAuth session. Used by all student API routes and queries.
// ============================================================

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { CurrentStudent } from '@/types';

/**
 * Resolves the currently logged-in student from the NextAuth session.
 * Returns null if the user is not authenticated, not a STUDENT, or has no student record.
 */
export async function getCurrentStudent(): Promise<CurrentStudent | null> {
    const session = await getServerSession(authOptions) as any;

    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const role = session.user.role;
    const schoolId = session.user.schoolId;

    if (role !== 'STUDENT') return null;
    if (!schoolId) return null;

    const supabase = createSupabaseAdmin();

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
        .single();

    if (error || !data) return null;

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
