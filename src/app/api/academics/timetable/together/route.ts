import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { CURRICULUM_BANDS } from '@/lib/timetable/config';
import { loadTogetherRules, loadTimetablePlan } from '@/lib/timetable/server';
import type { CurriculumBand } from '@/lib/curriculum-bands';
import type { TogetherRuleView, TogetherSubject } from '@/lib/timetable/together';

/** GET — the built-in rules, the school's own, and the subjects to choose from. */
export const GET = route('timetable together rules', { module: 'timetable', permission: 'timetable.manage' }, async ({ access }) => {
    const [rules, { rows, bandOf }] = await Promise.all([loadTogetherRules(access.schoolId), loadTimetablePlan(access.schoolId)]);
    const subjects = new Map<string, TogetherSubject>();
    for (const r of rows) {
        const band = bandOf(r.grade_stream_id);
        const s = subjects.get(r.subject_id) ?? { id: r.subject_id, name: r.subject?.name ?? '', bands: [] };
        if (band && !s.bands.includes(band)) s.bands.push(band);
        subjects.set(r.subject_id, s);
    }
    const nameOf = (id: string) => subjects.get(id)?.name ?? 'A subject no longer timetabled';
    return {
        rules: rules.map((r): TogetherRuleView => ({ id: r.id, name: r.name, bands: r.bands, subjects: r.patterns ? [] : r.subjectIds.map(nameOf), builtIn: r.builtIn })),
        subjects: [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
});

const bodySchema = z.object({
    name: z.string().trim().min(1, 'Name the group').max(80),
    bands: z.array(z.enum(CURRICULUM_BANDS as [CurriculumBand, ...CurriculumBand[]])).max(10).default([]),
    subject_ids: z.array(z.string().uuid()).min(2, 'Pick at least two subjects').max(12),
});

/** POST — a school's own group of subjects taught at the same time. */
export const POST = route('timetable together add', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const subjectIds = [...new Set(body.subject_ids)];
    if (subjectIds.length < 2) throw new HttpError(400, 'Pick at least two different subjects.');
    await assertInSchool('school_subject_catalogue', subjectIds, access.schoolId);
    const { data, error } = await createSupabaseAdmin().from('timetable_subject_groups')
        .insert({ school_id: access.schoolId, name: body.name, bands: body.bands, subject_ids: subjectIds })
        .select('id').single();
    if (error) throw error;
    await audit(access, 'create', 'timetable_subject_groups', data.id as string, { name: body.name, subjects: subjectIds.length });
    return { id: data.id };
});

/** DELETE ?id= — removes one of the school's own groups. */
export const DELETE = route('timetable together delete', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || !z.string().uuid().safeParse(id).success) throw new HttpError(400, 'Which group?');
    const { error, count } = await createSupabaseAdmin().from('timetable_subject_groups')
        .delete({ count: 'exact' }).eq('id', id).eq('school_id', access.schoolId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'That group is already gone.');
    await audit(access, 'delete', 'timetable_subject_groups', id);
    return { deleted: true };
});
