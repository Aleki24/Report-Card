import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * PATCH /api/admin/update-student
 * Update guardian_phone and guardian_name for an existing student.
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { student_id, guardian_phone, guardian_name } = body;

        if (!student_id) {
            return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // Verify the caller is an ADMIN
        const { data: adminProfile } = await supabaseAdmin
            .from('users')
            .select('role, school_id')
            .eq('id', session.user.id)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN' || !adminProfile.school_id) {
            return NextResponse.json({ error: 'Only admins can update students.' }, { status: 403 });
        }

        // Verify the student belongs to this school
        const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, users!inner(school_id)')
            .eq('id', student_id)
            .eq('users.school_id', adminProfile.school_id)
            .maybeSingle();

        if (!student) {
            return NextResponse.json({ error: 'Student not found in your school.' }, { status: 404 });
        }

        // Update guardian fields
        const { error } = await supabaseAdmin
            .from('students')
            .update({
                guardian_phone: guardian_phone?.trim() || null,
                guardian_name: guardian_name?.trim() || null,
            })
            .eq('id', student_id);

        if (error) {
            return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'Guardian info updated.' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
