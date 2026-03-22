import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Delete a student from the system.
 * Removes from students → users (CASCADE handles related records).
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user_id = session.user.id;
        const { searchParams } = new URL(request.url);
        const student_id = searchParams.get('student_id');

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN and get their school_id
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', user_id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN' || !adminProfile.school_id) {
            return NextResponse.json({ error: 'Only admins with a school can delete students.' }, { status: 403 });
        }

        const school_id = adminProfile.school_id;

        // Verify the student exists and belongs to the admin's school
        const { data: studentUser } = await supabaseAdmin
            .from('users')
            .select('id, school_id')
            .eq('id', student_id)
            .eq('role', 'STUDENT')
            .single();

        if (!studentUser || studentUser.school_id !== school_id) {
            return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
        }

        // Delete from students table first, then users
        // Use supabaseAdmin and filter by ID.
        // Even if we skip deleting from students table, deleting from users FIRST might fail due to FK if no CASCADE is set up properly,
        // or cascade delete handles it. We'll do BOTH manually for safety.
        await supabaseAdmin.from('students').delete().eq('id', student_id);
        await supabaseAdmin.from('users').delete().eq('id', student_id);

        return NextResponse.json({ success: true, message: 'Student deleted successfully.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
