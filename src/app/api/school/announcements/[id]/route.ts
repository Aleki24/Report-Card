import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { announcementUpdateSchema } from '@/lib/announcements';

type Guard = { ok: true } | { ok: false; response: NextResponse };

/**
 * The admin manages every announcement in the school; anyone else who posts
 * manages only their own. Class teachers could once edit or delete the
 * admin's notices.
 */
async function guardAnnouncement(id: string, verb: 'edit' | 'delete'): Promise<Guard> {
    const caller = await getCaller();
    if (!caller) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!isRoleIn(caller.role, STAFF_TEACHING_ROLES)) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    const { data: item } = await createSupabaseAdmin()
        .from('announcements')
        .select('school_id, posted_by')
        .eq('id', id)
        .maybeSingle();
    if (!item || item.school_id !== caller.schoolId) {
        return { ok: false, response: NextResponse.json({ error: 'Announcement not found' }, { status: 404 }) };
    }
    if (caller.role !== 'ADMIN' && item.posted_by !== caller.userId) {
        return { ok: false, response: NextResponse.json({ error: `You can only ${verb} announcements you posted.` }, { status: 403 }) };
    }
    return { ok: true };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const guard = await guardAnnouncement(id, 'edit');
        if (!guard.ok) return guard.response;

        const parsed = announcementUpdateSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid announcement.' }, { status: 400 });
        }

        const { data, error } = await createSupabaseAdmin()
            .from('announcements')
            .update(parsed.data)
            .eq('id', id)
            .select('id')
            .single();
        if (error) return internalError('announcement update', error);
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('announcement update', err);
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const guard = await guardAnnouncement(id, 'delete');
        if (!guard.ok) return guard.response;

        const { error } = await createSupabaseAdmin().from('announcements').delete().eq('id', id);
        if (error) return internalError('announcement delete', error);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('announcement delete', err);
    }
}
