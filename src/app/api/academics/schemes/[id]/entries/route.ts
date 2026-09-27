import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { schemeEntrySchema } from '@/lib/academics/scheme-draft';
import { canEditScheme, loadScheme } from '@/lib/academics/schemes-server';
import { insertChunked } from '@/lib/db-batch';

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
    const byKey = new Map((existing ?? []).map(e => [`${e.week}|${e.lesson}`, e.id as string]));

    const updates = entries.filter(e => byKey.has(`${e.week}|${e.lesson}`));
    const inserts = entries.filter(e => !byKey.has(`${e.week}|${e.lesson}`));
    const keep = new Set(updates.map(e => byKey.get(`${e.week}|${e.lesson}`)!));
    const removed = (existing ?? []).map(e => e.id as string).filter(id => !keep.has(id));

    if (removed.length > 0) {
        const { error: delError } = await db.from('scheme_entries').delete().in('id', removed);
        if (delError) throw delError;
    }
    for (const e of updates) {
        const { error: upError } = await db.from('scheme_entries').update(e).eq('id', byKey.get(`${e.week}|${e.lesson}`)!);
        if (upError) throw upError;
    }
    await insertChunked('scheme_entries', inserts.map(e => ({ ...e, school_id: access.schoolId, scheme_id: scheme.id })));
    return { saved: entries.length };
});
