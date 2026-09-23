import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canManageStudent, getCaller } from '@/lib/auth-server';

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id');

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!caller.schoolId) {
            return NextResponse.json({ error: 'You must have a school to delete students.' }, { status: 403 });
        }

        if (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') {
            return NextResponse.json({ error: 'Only admins and class teachers can delete students.' }, { status: 403 });
        }

        const school_id = caller.schoolId;

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
        if (!(await canManageStudent(caller, student_id))) {
            return NextResponse.json({ error: 'You can only delete students in your own class.' }, { status: 403 });
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
