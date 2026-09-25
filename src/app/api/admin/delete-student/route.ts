import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canManageStudent, getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';

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

        // Every student record (marks, attendance, fees, report cards,
        // subjects…) cascades from the user row, so one delete removes it all
        // or nothing. The old step-by-step deletes ignored their errors and
        // reported success even when the student was still there.
        const { error: deleteError } = await supabaseAdmin.from('users').delete().eq('id', student_id);
        if (deleteError) return internalError('delete-student', deleteError);

        return NextResponse.json({ success: true, message: 'Student deleted successfully.' });
    } catch (err: unknown) {
        return internalError('delete-student', err);
    }
}
