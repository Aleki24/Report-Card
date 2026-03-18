import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Delete a student from the system.
 * Removes from students → users (CASCADE handles related records).
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id');
        const user_id = searchParams.get('user_id');

        if (!student_id || !user_id) {
            return NextResponse.json({ error: 'student_id and user_id (admin) are required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user_id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can delete students.' }, { status: 403 });
        }

        // Verify the student exists
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id')
            .eq('id', student_id)
            .single();

        if (!student) {
            return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
        }

        // Delete from students table first, then users
        await supabaseAdmin.from('students').delete().eq('id', student_id);
        await supabaseAdmin.from('users').delete().eq('id', student_id);

        return NextResponse.json({ success: true, message: 'Student deleted successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
