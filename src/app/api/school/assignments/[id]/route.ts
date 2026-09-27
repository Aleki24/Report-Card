import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { assignmentSchema } from '@/lib/assignments';
import { assignmentRefsBelongToSchool, authorizeAssignment } from '@/lib/assignments-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const access = await authorizeAssignment(id, 'edit');
        if (!access.ok) return access.response;

        const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid assignment.' }, { status: 400 });
        }
        const body = parsed.data;
        const refsProblem = await assignmentRefsBelongToSchool(access.caller.schoolId as string, body.subject_id, body.grade_stream_id);
        if (refsProblem) return NextResponse.json({ error: refsProblem }, { status: 404 });

        const { data, error } = await createSupabaseAdmin()
            .from('assignments')
            .update(body)
            .eq('id', id)
            .select('id')
            .single();
        if (error) return internalError('assignment update', error);
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('assignment update', err);
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const access = await authorizeAssignment(id, 'delete');
        if (!access.ok) return access.response;

        const { error } = await createSupabaseAdmin().from('assignments').delete().eq('id', id);
        if (error) return internalError('assignment delete', error);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('assignment delete', err);
    }
}
