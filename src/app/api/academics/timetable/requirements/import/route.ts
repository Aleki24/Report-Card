import { z } from 'zod';
import { route, parseBody } from '@/lib/platform/access';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';

const bodySchema = z.object({ lessons_per_week: z.number().int().min(1).max(20).default(5) });

/**
 * Creates a teaching load for every subject a teacher is assigned to a class
 * this year (Subjects → teachers), skipping loads that already exist. An
 * assignment to a whole grade expands to each of the grade's classes.
 */
export const POST = route('timetable import loads', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { lessons_per_week } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const yearId = await getCurrentAcademicYearId(db, access.schoolId);

    let q = db.from('subject_teacher_assignments')
        .select('subject_id, grade_id, grade_stream_id, teacher:subject_teachers!inner(user_id, user:users!inner(school_id))')
        .eq('teacher.user.school_id', access.schoolId);
    if (yearId) q = q.eq('academic_year_id', yearId);
    const [{ data: assignments, error }, { data: streams, error: streamsError }, { data: existing, error: existingError }] = await Promise.all([
        q,
        db.from('grade_streams').select('id, grade_id').eq('school_id', access.schoolId),
        db.from('timetable_requirements').select('grade_stream_id, subject_id').eq('school_id', access.schoolId),
    ]);
    if (error || streamsError || existingError) throw error ?? streamsError ?? existingError;

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
                teacher_id: teacherId, lessons_per_week, double_lessons: 0,
            });
        }
    }
    if (rows.size > 0) {
        const { error: insertError } = await db.from('timetable_requirements').insert([...rows.values()]);
        if (insertError) throw insertError;
    }
    return { created: rows.size };
});
