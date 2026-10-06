import { z } from 'zod';
import { route, parseBody } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { ministryAllocation } from '@/lib/timetable/allocations';
import { assignmentKey, classAssignments, syncLoadTeachers } from '@/lib/timetable/assignments';

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
 * this year (Subjects → teachers), and brings existing loads' teachers up to
 * date: a load whose teacher is no longer assigned to that class and subject
 * takes the assigned one. An assignment to a whole grade expands to each of
 * the grade's classes. Weekly lessons follow the Ministry's allocation for
 * the class's level.
 */
export const POST = route('timetable import loads', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { lessons_per_week, follow_ministry, update_existing } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [assigned, { data: streams, error: streamsError }, { data: existing, error: existingError }] = await Promise.all([
        classAssignments(db, access.schoolId),
        db.from('grade_streams').select('id, grade_id, grade:grades(code, name_display)').eq('school_id', access.schoolId),
        db.from('timetable_requirements').select('id, grade_stream_id, subject_id').eq('school_id', access.schoolId),
    ]);
    if (streamsError || existingError) throw streamsError ?? existingError;

    const subjectIds = [...new Set([...[...assigned.values()].map(a => a.subjectId), ...(existing ?? []).map(r => r.subject_id as string)])];
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

    const have = new Set((existing ?? []).map(r => assignmentKey(r.grade_stream_id as string, r.subject_id as string)));
    const rows = [...assigned.entries()]
        .filter(([key]) => !have.has(key))
        .map(([, a]) => {
            const { lessons, doubles } = allocationFor(a.streamId, a.subjectId);
            return { school_id: access.schoolId, grade_stream_id: a.streamId, subject_id: a.subjectId, teacher_id: a.teacherId, lessons_per_week: lessons, double_lessons: doubles };
        });
    if (rows.length > 0) {
        const { error: insertError } = await db.from('timetable_requirements').insert(rows);
        if (insertError) throw insertError;
    }
    // Loads that already existed follow Subjects → Teachers when a subject changed hands.
    const reassigned = await syncLoadTeachers(db, access.schoolId, assigned);

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
    return { created: rows.length, updated, reassigned };
});
