import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user_id = userId;
        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id');

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN or CLASS_TEACHER and get their school_id
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', user_id)
            .maybeSingle();

        if (!adminProfile || adminProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminProfile.school_id) {
            return NextResponse.json({ error: 'You must have a school to delete students.' }, { status: 403 });
        }

        const isAdmin = adminProfile.role === 'ADMIN';
        const isClassTeacher = adminProfile.role === 'CLASS_TEACHER';

        if (!isAdmin && !isClassTeacher) {
            return NextResponse.json({ error: 'Only admins and class teachers can delete students.' }, { status: 403 });
        }

        const school_id = adminProfile.school_id;

        // Verify the student exists and belongs to the school
        const { data: studentUser } = await supabaseAdmin
            .from('users')
            .select('id, school_id')
            .eq('id', student_id)
            .eq('role', 'STUDENT')
            .maybeSingle();

        if (!studentUser || studentUser.school_id !== school_id) {
            return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
        }

        // Class teachers may only delete students in their own assigned stream
        if (isClassTeacher && !isAdmin) {
            const { data: teacherAssignment } = await supabaseAdmin
                .from('class_teachers')
                .select('current_grade_stream_id')
                .eq('user_id', user_id)
                .maybeSingle();

            const { data: studentRecord } = await supabaseAdmin
                .from('students')
                .select('current_grade_stream_id')
                .eq('id', student_id)
                .maybeSingle();

            if (
                !teacherAssignment?.current_grade_stream_id ||
                !studentRecord ||
                studentRecord.current_grade_stream_id !== teacherAssignment.current_grade_stream_id
            ) {
                return NextResponse.json({ error: 'You can only delete students in your own class.' }, { status: 403 });
            }
        }

        // Cascade delete all related records before removing the student
        // 1. Delete exam marks for this student
        await supabaseAdmin.from('exam_marks').delete().eq('student_id', student_id);
        // 2. Delete daily attendance records
        await supabaseAdmin.from('daily_attendance').delete().eq('student_id', student_id);
        // 3. Delete fee records
        await supabaseAdmin.from('student_fees').delete().eq('student_id', student_id);
        // 4. Delete active_users record if exists
        await supabaseAdmin.from('active_users').delete().eq('user_id', student_id);
        // 5. Delete from students table
        await supabaseAdmin.from('students').delete().eq('id', student_id);
        // 6. Finally delete the user record
        await supabaseAdmin.from('users').delete().eq('id', student_id);

        return NextResponse.json({ success: true, message: 'Student deleted successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
