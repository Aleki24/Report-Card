import { z } from 'zod';
import { route, parseBody } from '@/lib/platform/access';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { ministryAllocation } from '@/lib/timetable/allocations';

const bodySchema = z.object({
    /** For subjects the Ministry sets no allocation for (or all, when not following it). */
    lessons_per_week: z.number().int().min(1).max(20).default(5),
    /** Use KICD / Ministry weekly lessons for each subject and level. */
    follow_ministry: z.boolean().default(true),
    /** Also reset existing loads to the Ministry's figures. */
    update_existing: z.boolean().default(false),
});

type GradeRef = { code: string | null; name_display: string | null };

/**
 * Creates a teaching load for every subject a teacher is assigned to a class
 * this year (Subjects → teachers), skipping loads that already exist. An
 * assignment to a whole grade expands to each of the grade's classes. Weekly
 * lessons follow the Ministry's allocation for the class's level.
 */
export const POST = route('timetable import loads', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { lessons_per_week, follow_ministry, update_existing } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const yearId = await getCurrentAcademicYearId(db, access.schoolId);

    let q = db.from('subject_teacher_assignments')
        .select('subject_id, grade_id, grade_stream_id, teacher:subject_teachers!inner(user_id, user:users!inner(school_id))')
        .eq('teacher.user.school_id', access.schoolId);
    if (yearId) q = q.eq('academic_year_id', yearId);
    const [{ data: assignments, error }, { data: streams, error: streamsError }, { data: existing, error: existingError }] = await Promise.all([
        q,
        db.from('grade_streams').select('id, grade_id, grade:grades(code, name_display)').eq('school_id', access.schoolId),
        db.from('timetable_requirements').select('id, grade_stream_id, subject_id').eq('school_id', access.schoolId),
    ]);
    if (error || streamsError || existingError) throw error ?? streamsError ?? existingError;

    const subjectIds = [...new Set([...(assignments ?? []).map(a => a.subject_id as string), ...(existing ?? []).map(r => r.subject_id as string)])];
    const { data: subjects, error: subjectsError } = subjectIds.length
        ? await db.from('subjects').select('id, name, code').in('id', subjectIds)
        : { data: [], error: null };
    if (subjectsError) throw subjectsError;
    const subjectById = new Map((subjects ?? []).map(s => [s.id as string, s as { name: string | null; code: string | null }]));
    const gradeByStream = new Map((streams ?? []).map(s => [s.id as string, embedOne<GradeRef>(s.grade)]));
    const allocationFor = (streamId: string, subjectId: string) => {
        const subject = subjectById.get(subjectId);
        const ministry = follow_ministry && subject ? ministryAllocation(gradeByStream.get(streamId) ?? null, subject) : null;
        return ministry ?? { lessons: lessons_per_week, doubles: 0 };
    };

    const have = new Set((existing ?? []).map(r => `${r.grade_stream_id}|${r.subject_id}`));
    const rows = new Map<string, Record<string, unknown>>();
    for (const a of assignments ?? []) {
        const teacherId = embedOne<{ user_id: string }>(a.teacher)?.user_id ?? null;
        const targets = a.grade_stream_id
            ? [a.grade_stream_id as string]
            : (streams ?? []).filter(s => s.grade_id === a.grade_id).map(s => s.id as string);
        for (const streamId of targets) {
            const key = `${streamId}|${a.subject_id}`;
            if (have.has(key) || rows.has(key)) continue;
            rows.set(key, {
                school_id: access.schoolId, grade_stream_id: streamId, subject_id: a.subject_id,
                teacher_id: teacherId, ...(({ lessons, doubles }) => ({ lessons_per_week: lessons, double_lessons: doubles }))(allocationFor(streamId, a.subject_id as string)),
            });
        }
    }
    if (rows.size > 0) {
        const { error: insertError } = await db.from('timetable_requirements').insert([...rows.values()]);
        if (insertError) throw insertError;
    }

    let updated = 0;
    if (follow_ministry && update_existing) {
        const changes = (existing ?? []).flatMap(r => {
            const subject = subjectById.get(r.subject_id as string);
            const ministry = subject ? ministryAllocation(gradeByStream.get(r.grade_stream_id as string) ?? null, subject) : null;
            return ministry ? [{ id: r.id as string, ...ministry }] : [];
        });
        const results = await Promise.all(changes.map(c => db.from('timetable_requirements')
            .update({ lessons_per_week: c.lessons, double_lessons: c.doubles })
            .eq('id', c.id).eq('school_id', access.schoolId)));
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
        updated = changes.length;
    }
    return { created: rows.size, updated };
});
