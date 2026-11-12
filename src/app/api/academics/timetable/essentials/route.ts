import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { loadTimetablePlan } from '@/lib/timetable/server';
import { assignmentKey, classAssignments } from '@/lib/timetable/assignments';
import { ESSENTIAL_LESSONS, missingEssentials, missingLine } from '@/lib/timetable/essentials';

const bodySchema = z.object({ stream_id: z.string().uuid() });

interface GradeRef { code: string | null; name_display: string | null; academic_level_id: string | null }

/**
 * POST — puts the non-examined lessons a class's level expects on its
 * timetable (Physical Education and Life Skills in 8-4-4; Physical Education,
 * ICT Skills and Community Service Learning in Senior School), at the
 * Ministry's lessons a week. A subject the school does not have yet is
 * created as its own. The teacher is whoever Subjects → Teachers assigns,
 * else left to pick.
 */
export const POST = route('timetable add essentials', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { stream_id } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [{ rows, bandOf }, { data: stream, error: streamError }] = await Promise.all([
        loadTimetablePlan(access.schoolId),
        db.from('grade_streams').select('id, full_name, grade:grades(code, name_display, academic_level_id)').eq('id', stream_id).eq('school_id', access.schoolId).maybeSingle(),
    ]);
    if (streamError) throw streamError;
    if (!stream) throw new HttpError(404, 'That class was not found.');
    const grade = embedOne<GradeRef>(stream.grade);
    const band = bandOf(stream_id);
    const have = rows.filter(r => r.grade_stream_id === stream_id).map(r => r.subject?.name ?? '');
    const missing = missingEssentials(band, grade, have);
    if (missing.length === 0) return { added: 0, message: 'Nothing to add: these lessons are already on this class’s timetable.' };
    if (!grade?.academic_level_id) throw new HttpError(400, 'This class’s level is not set, so its subjects cannot be added.');

    const defs = (band ? ESSENTIAL_LESSONS[band] ?? [] : []).filter(d => missing.some(m => m.code === d.code));
    // The standard subject with the code, or this school's own; else created for the school.
    const { data: known, error: knownError } = await db.from('subjects')
        .select('id, code, origin_school_id')
        .in('code', defs.map(d => d.code))
        .or(`origin_school_id.is.null,origin_school_id.eq.${access.schoolId}`);
    if (knownError) throw knownError;
    const idOf = new Map((known ?? []).map(s => [s.code as string, s.id as string]));
    const toCreate = defs.filter(d => !idOf.has(d.code));
    if (toCreate.length > 0) {
        const { data: created, error: createError } = await db.from('subjects').insert(toCreate.map(d => ({
            code: d.code, name: d.name, academic_level_id: grade.academic_level_id, subject_type: 'CORE', category: d.category, origin_school_id: access.schoolId,
        }))).select('id, code');
        if (createError) throw createError;
        (created ?? []).forEach(s => idOf.set(s.code as string, s.id as string));
    }

    const assigned = await classAssignments(db, access.schoolId);
    const loads = missing.flatMap(m => {
        const subjectId = idOf.get(m.code);
        if (!subjectId) return [];
        return [{
            school_id: access.schoolId, grade_stream_id: stream_id, subject_id: subjectId,
            teacher_id: assigned.get(assignmentKey(stream_id, subjectId))?.teacherId ?? null,
            lessons_per_week: m.lessons, double_lessons: 0,
        }];
    });
    const { error: insertError } = await db.from('timetable_requirements').insert(loads);
    if (insertError) throw insertError;
    await audit(access, 'create', 'timetable_requirements', null, { stream_id, added: missing.map(m => m.code) });
    const unassigned = loads.filter(l => !l.teacher_id).length;
    return {
        added: loads.length,
        message: `Added to ${stream.full_name as string}: ${missingLine(missing)}.${unassigned > 0 ? ` Pick a teacher for ${unassigned === 1 ? 'it' : `${unassigned} of them`} under “Edit teaching loads one by one”.` : ''}`,
    };
});
