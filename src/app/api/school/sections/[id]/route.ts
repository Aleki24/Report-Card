import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { assertAdmin, assertBandsFree, loadSections, sectionInputSchema, toSection } from '@/lib/school-sections-server';

type Params = { id: string };

/** Changes a section's name, bands or head. */
export const PATCH = route<Params>('school section PATCH', {}, async ({ access, params, request }) => {
    assertAdmin(access);
    const body = await parseBody(request, sectionInputSchema.partial());
    const db = createSupabaseAdmin();
    const sections = await loadSections(db, access.schoolId);
    if (!sections.some(s => s.id === params.id)) throw new HttpError(404, 'Section not found.');
    if (body.bands) assertBandsFree(sections, body.bands, params.id);
    const { error } = await db.from('school_sections')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('school_id', access.schoolId);
    if (error) throw error;
    await audit(access, 'update', 'school_sections', params.id, { ...body });
    return (await loadSections(db, access.schoolId)).map(toSection);
});

/** Removes a section; its classes go back to the school-wide principal. */
export const DELETE = route<Params>('school section DELETE', {}, async ({ access, params }) => {
    assertAdmin(access);
    const db = createSupabaseAdmin();
    const { data, error } = await db.from('school_sections').delete().eq('id', params.id).eq('school_id', access.schoolId).select('id');
    if (error) throw error;
    if (!data?.length) throw new HttpError(404, 'Section not found.');
    await audit(access, 'delete', 'school_sections', params.id);
    return (await loadSections(db, access.schoolId)).map(toSection);
});
