import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHEME_DETAIL_SELECT, canEditScheme, loadScheme } from '@/lib/academics/schemes-server';

type Params = { id: string };

/** A scheme with its weekly entries and which of them have been taught. */
export const GET = route<Params>('scheme detail', { module: 'lesson_records', permission: ['lesson_records.write', 'lesson_records.review'] }, async ({ access, params }) => {
    const scheme = await loadScheme(params.id, access);
    const db = createSupabaseAdmin();
    const [{ data, error }, { data: entries, error: entriesError }] = await Promise.all([
        db.from('schemes_of_work').select(SCHEME_DETAIL_SELECT).eq('id', scheme.id).single(),
        db.from('scheme_entries').select('*').eq('scheme_id', scheme.id).order('week').order('lesson'),
    ]);
    if (error || entriesError) throw error ?? entriesError;
    const ids = (entries ?? []).map(e => e.id as string);
    const { data: taught, error: taughtError } = ids.length
        ? await db.from('records_of_work').select('scheme_entry_id').in('scheme_entry_id', ids)
        : { data: [], error: null };
    if (taughtError) throw taughtError;
    return {
        ...data,
        entries: entries ?? [],
        covered: [...new Set((taught ?? []).map(t => t.scheme_entry_id as string))],
        editable: canEditScheme(scheme),
    };
});
