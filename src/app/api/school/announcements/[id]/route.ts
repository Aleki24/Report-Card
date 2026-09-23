import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userProfile = await getCaller();
        if (!userProfile) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!isRoleIn(userProfile.role, STAFF_TEACHING_ROLES)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const { userId } = userProfile;

        const supabase = createSupabaseAdmin();

        const { id } = await params;

        // Verify the announcement is in the caller's school.
        const { data: currentItem } = await supabase
            .from('announcements')
            .select('school_id, posted_by')
            .eq('id', id)
            .maybeSingle();

        if (!currentItem || currentItem.school_id !== userProfile.schoolId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Admins and class teachers can edit any announcement in the school; a
        // subject teacher may only edit one they posted themselves.
        const canEditAny = userProfile.role === 'ADMIN' || userProfile.role === 'CLASS_TEACHER';
        if (!canEditAny && currentItem.posted_by !== userId) {
            return NextResponse.json({ error: 'You can only edit announcements you posted.' }, { status: 403 });
        }

        const body = await request.json();

        const updateData: Record<string, any> = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.content !== undefined) updateData.content = body.content;
        if (body.is_important !== undefined) updateData.is_important = body.is_important;

        const { data, error } = await supabase
            .from('announcements')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userProfile = await getCaller();
        if (!userProfile) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!isRoleIn(userProfile.role, STAFF_TEACHING_ROLES)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const { userId } = userProfile;

        const supabase = createSupabaseAdmin();

        const { id } = await params;

        // Verify the announcement is in the caller's school.
        const { data: currentItem } = await supabase
            .from('announcements')
            .select('school_id, posted_by')
            .eq('id', id)
            .single();

        if (!currentItem || currentItem.school_id !== userProfile.schoolId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Admins and class teachers can remove any announcement in the school;
        // a subject teacher may only remove one they posted themselves (so the
        // delete action isn't a dead button for them, without letting them
        // clear other people's posts).
        const canDeleteAny = userProfile.role === 'ADMIN' || userProfile.role === 'CLASS_TEACHER';
        if (!canDeleteAny && currentItem.posted_by !== userId) {
            return NextResponse.json({ error: 'You can only delete announcements you posted.' }, { status: 403 });
        }

        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
