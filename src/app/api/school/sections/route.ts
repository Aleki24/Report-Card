import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { DEFAULT_SECTIONS, type SchoolSectionsOverview } from '@/lib/school-sections';
import { assertAdmin, assertBandsFree, loadSections, schoolBands, sectionInputSchema, toSection } from '@/lib/school-sections-server';

/** The school's sections and the bands it teaches (to place them in). */
export const GET = route('school sections GET', {}, async ({ access }): Promise<SchoolSectionsOverview> => {
    assertAdmin(access);
    const db = createSupabaseAdmin();
    const [sections, bands] = await Promise.all([loadSections(db, access.schoolId), schoolBands(db, access.schoolId)]);
    return { sections: sections.map(toSection), bands };
});

const createSchema = z.union([z.object({ defaults: z.literal(true) }), sectionInputSchema]);

/**
 * Adds a section, or with `{ defaults: true }` the usual Primary, Junior and
 * Senior (only the bands the school teaches) when it has none yet.
 */
export const POST = route('school sections POST', {}, async ({ access, request }) => {
    assertAdmin(access);
    const body = await parseBody(request, createSchema);
    const db = createSupabaseAdmin();
    const existing = await loadSections(db, access.schoolId);

    if ('defaults' in body) {
        if (existing.length > 0) throw new HttpError(400, 'Your school already has sections. Add or change them one at a time.');
        const taught = new Set((await schoolBands(db, access.schoolId)).map(b => b.band));
        const rows = DEFAULT_SECTIONS
            .map(s => ({ ...s, bands: s.bands.filter(b => taught.has(b)) }))
            .filter(s => s.bands.length > 0)
            .map((s, i) => ({ ...s, school_id: access.schoolId, sort_order: i }));
        if (rows.length === 0) throw new HttpError(400, 'Add classes first: the sections are made from the grades your school teaches.');
        const { error } = await db.from('school_sections').insert(rows);
        if (error) throw error;
        await audit(access, 'create', 'school_sections', null, { defaults: rows.map(r => r.name) });
    } else {
        assertBandsFree(existing, body.bands);
        const { error } = await db.from('school_sections').insert({ ...body, school_id: access.schoolId, sort_order: existing.length });
        if (error) throw error;
        await audit(access, 'create', 'school_sections', null, { name: body.name });
    }
    return (await loadSections(db, access.schoolId)).map(toSection);
});
