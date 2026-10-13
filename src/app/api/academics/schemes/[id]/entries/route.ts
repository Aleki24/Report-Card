import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { schemeEntrySchema } from '@/lib/academics/scheme-draft';
import { canEditScheme, loadScheme } from '@/lib/academics/schemes-server';

type Params = { id: string };

const bodySchema = z.object({ entries: z.array(schemeEntrySchema).max(400) });

/**
 * Saves the scheme's rows, keeping each existing row's id where its week and
 * lesson are unchanged, so records of work stay linked to what they covered.
 */
export const PUT = route<Params>('scheme entries save', { module: 'lesson_records', permission: ['lesson_records.write', 'lesson_records.review'] }, async ({ access, params, request }) => {
    const { entries } = await parseBody(request, bodySchema);
    const scheme = await loadScheme(params.id, access);
    if (!canEditScheme(scheme)) throw new HttpError(409, 'This scheme is with the reviewer; it can no longer be edited.');
    const keys = entries.map(e => `${e.week}|${e.lesson}`);
    if (new Set(keys).size !== keys.length) throw new HttpError(400, 'Each week and lesson can appear only once.');

    const db = createSupabaseAdmin();
    const { data: existing, error } = await db.from('scheme_entries').select('id, week, lesson').eq('scheme_id', scheme.id);
    if (error) throw error;

    // One upsert on (scheme_id, week, lesson) keeps each existing row's id,
    // and runs before anything is removed: a failed save leaves the scheme
    // as it was instead of half-cleared.
    if (entries.length > 0) {
        const { error: saveError } = await db.from('scheme_entries')
            .upsert(entries.map(e => ({ ...e, school_id: access.schoolId, scheme_id: scheme.id })), { onConflict: 'scheme_id,week,lesson' });
        if (saveError) throw saveError;
    }
    const kept = new Set(keys);
    const removed = (existing ?? []).filter(e => !kept.has(`${e.week}|${e.lesson}`)).map(e => e.id as string);
    if (removed.length > 0) {
        const { error: delError } = await db.from('scheme_entries').delete().in('id', removed);
        if (delError) throw delError;
    }
    return { saved: entries.length };
});
