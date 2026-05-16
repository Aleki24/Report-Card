import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || !['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = createSupabaseAdmin();

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
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || !['ADMIN', 'CLASS_TEACHER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = createSupabaseAdmin();

        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
