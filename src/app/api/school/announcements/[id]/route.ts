import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Verify the announcement is in the caller's school.
        const { data: currentItem } = await supabase
            .from('announcements')
            .select('school_id, posted_by')
            .eq('id', id)
            .maybeSingle();

        if (!currentItem || currentItem.school_id !== userProfile.school_id) {
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
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .single();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Verify the announcement is in the caller's school.
        const { data: currentItem } = await supabase
            .from('announcements')
            .select('school_id, posted_by')
            .eq('id', id)
            .single();

        if (!currentItem || currentItem.school_id !== userProfile.school_id) {
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
