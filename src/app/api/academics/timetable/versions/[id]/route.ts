import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadLessons, loadVersion } from '@/lib/timetable/server';

type Params = { id: string };

export const GET = route<Params>('timetable version', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, params }) => {
    const version = await loadVersion(params.id, access.schoolId);
    return { version, lessons: await loadLessons(version.id) };
});

const patchSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(['PUBLISHED', 'ARCHIVED', 'DRAFT']).optional(),
});

/** Rename, or publish (the previously published timetable is archived). */
export const PATCH = route<Params>('timetable version update', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, params, request }) => {
    const body = await parseBody(request, patchSchema);
    if (!body.name && !body.status) throw new HttpError(400, 'Nothing to update.');
    const version = await loadVersion(params.id, access.schoolId);
    const db = createSupabaseAdmin();
    if (body.status === 'PUBLISHED' && version.status !== 'PUBLISHED') {
        // Archiving the live timetable and publishing this one happen together,
        // so a failure never leaves the school without a live timetable.
        const { error } = await db.rpc('publish_timetable_version', { p_school_id: access.schoolId, p_version_id: version.id });
        if (error) throw error;
        await audit(access, 'release', 'timetable_versions', version.id, { name: version.name });
    }
    const update: Record<string, unknown> = {};
    if (body.name) update.name = body.name;
    if (body.status && body.status !== 'PUBLISHED') update.status = body.status;
    const { data, error } = Object.keys(update).length > 0
        ? await db.from('timetable_versions').update(update).eq('id', version.id).select('*').single()
        : await db.from('timetable_versions').select('*').eq('id', version.id).single();
    if (error) throw error;
    return data;
});

export const DELETE = route<Params>('timetable version delete', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, params }) => {
    const version = await loadVersion(params.id, access.schoolId);
    if (version.status === 'PUBLISHED') throw new HttpError(409, 'Publish another timetable before deleting the live one.');
    const { error } = await createSupabaseAdmin().from('timetable_versions').delete().eq('id', version.id);
    if (error) throw error;
    return { deleted: true };
});
