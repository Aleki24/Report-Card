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
        if (body.description !== undefined) updateData.description = body.description;
        if (body.due_date !== undefined) updateData.due_date = body.due_date;
        if (body.file_url !== undefined) updateData.file_url = body.file_url;
        if (body.subject_id !== undefined) updateData.subject_id = body.subject_id;
        if (body.grade_stream_id !== undefined) updateData.grade_stream_id = body.grade_stream_id;

        const { data, error } = await supabase
            .from('assignments')
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
        if (!session?.user?.id || !['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = createSupabaseAdmin();

        const { error } = await supabase.from('assignments').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
