import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/postgrest';

/** Strands and sub-strands already used for a subject, to pick from instead of retyping. */
export const GET = route('cbc strands', { module: 'cbc_assessment', permission: ['cbc.assess', 'cbc.view'] }, async ({ access, request }) => {
    const subject = request.nextUrl.searchParams.get('subject_id');
    if (!subject) throw new HttpError(400, 'Choose a subject.');
    // One row per learner per strand, so a class or two passes the 1,000-row
    // page: read them all (the distinct strands are few).
    const { rows: data, error } = await fetchAllRows(() => createSupabaseAdmin()
        .from('competency_assessments')
        .select('id, strand, sub_strand')
        .eq('school_id', access.schoolId)
        .eq('subject_id', subject)
        .order('id'));
    if (error) throw error;
    const seen = new Map<string, Set<string>>();
    for (const r of data ?? []) {
        const subs = seen.get(r.strand as string) ?? new Set<string>();
        if (r.sub_strand) subs.add(r.sub_strand as string);
        seen.set(r.strand as string, subs);
    }
    return [...seen.entries()].sort().map(([strand, subs]) => ({ strand, subStrands: [...subs].sort() }));
});
