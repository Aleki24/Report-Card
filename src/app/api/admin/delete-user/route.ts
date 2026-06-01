import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();

        // Verify admin
        const { data: adminProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .single();

        if (!adminProfile || adminProfile.role !== 'ADMIN' || !adminProfile.school_id) {
            return NextResponse.json({ error: 'Only admins can delete users.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('user_id');

        if (!targetUserId) {
            return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 });
        }

        // Prevent admins from deleting themselves
        if (targetUserId === userId) {
            return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
        }

        // Verify the target user belongs to the same school
        const { data: targetUser } = await supabase
            .from('users')
            .select('id, school_id, role')
            .eq('id', targetUserId)
            .single();

        if (!targetUser || targetUser.school_id !== adminProfile.school_id) {
            return NextResponse.json({ error: 'User not found in your school' }, { status: 404 });
        }

        // Delete related records first (cascade manually)
        // Delete student record if exists
        await supabase.from('students').delete().eq('id', targetUserId);
        // Delete class teacher record if exists
        await supabase.from('class_teachers').delete().eq('user_id', targetUserId);
        // Delete subject teacher assignments + subject teacher record
        const { data: stRecord } = await supabase
            .from('subject_teachers')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();
        if (stRecord) {
            await supabase.from('subject_teacher_assignments').delete().eq('subject_teacher_id', stRecord.id);
            await supabase.from('subject_teachers').delete().eq('id', stRecord.id);
        }
        // Delete active_users record if exists
        await supabase.from('active_users').delete().eq('user_id', targetUserId);

        // Finally delete the user
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', targetUserId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
