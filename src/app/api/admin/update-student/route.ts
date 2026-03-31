import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * PATCH /api/admin/update-student
 * Update student details - allows admins and teachers to update various fields.
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            student_id, 
            first_name, 
            last_name, 
            admission_number, 
            guardian_phone, 
            guardian_name,
            grade_stream_id,
            status
        } = body;

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an admin or teacher
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', session.user.id)
            .single();

        if (!profile || !['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(profile.role) || !profile.school_id) {
            return NextResponse.json({ error: 'Only admins and teachers can update students.' }, { status: 403 });
        }

        // Verify the student belongs to this school
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, users!inner(school_id)')
            .eq('id', student_id)
            .eq('users.school_id', profile.school_id)
            .maybeSingle();

        if (!student) {
            return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
        }

        // Build update object for student table
        const studentUpdates: Record<string, any> = {};
        if (guardian_phone !== undefined) studentUpdates.guardian_phone = guardian_phone?.trim() || null;
        if (guardian_name !== undefined) studentUpdates.guardian_name = guardian_name?.trim() || null;
        if (grade_stream_id !== undefined) studentUpdates.current_grade_stream_id = grade_stream_id || null;
        if (status !== undefined) studentUpdates.status = status;

        // Build update object for users table
        const userUpdates: Record<string, any> = {};
        if (first_name !== undefined) userUpdates.first_name = first_name?.trim() || null;
        if (last_name !== undefined) userUpdates.last_name = last_name?.trim() || null;
        if (admission_number !== undefined) {
            // Need to update the students table admission_number
            studentUpdates.admission_number = admission_number?.trim() || null;
        }

        // Update student record
        if (Object.keys(studentUpdates).length > 0) {
            const { error: studentError } = await supabaseAdmin
                .from('students')
                .update(studentUpdates)
                .eq('id', student_id);

            if (studentError) {
                return NextResponse.json({ error: `Update failed: ${studentError.message}` }, { status: 400 });
            }
        }

        // Update user record (name)
        if (Object.keys(userUpdates).length > 0) {
            // First get the user_id for this student
            const { data: studentUser } = await supabaseAdmin
                .from('students')
                .select('users:id')
                .eq('id', student_id)
                .single();

            if (studentUser?.users) {
                const { error: userError } = await supabaseAdmin
                    .from('users')
                    .update(userUpdates)
                    .eq('id', studentUser.users);

                if (userError) {
                    return NextResponse.json({ error: `Update failed: ${userError.message}` }, { status: 400 });
                }
            }
        }

        return NextResponse.json({ success: true, message: 'Student updated successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
