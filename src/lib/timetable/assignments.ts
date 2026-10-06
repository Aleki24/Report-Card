/**
 * Subjects → Teachers is where a school says who teaches what. Teaching loads
 * are created from it, and kept in step with it: when a subject changes hands
 * there, its loads (and so the next timetable) follow.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { embedOne } from '@/lib/postgrest';

/** One class and subject's assigned teachers this year. */
export interface ClassAssignment {
    streamId: string;
    subjectId: string;
    teachers: Set<string>;
    /** Who takes the load: an assignment to the class itself wins over a grade-wide one. */
    teacherId: string | null;
}

export const assignmentKey = (streamId: string, subjectId: string) => `${streamId}|${subjectId}`;

/** This year's assignments, a grade-wide one expanded to each of the grade's classes. */
export async function classAssignments(db: SupabaseClient, schoolId: string): Promise<Map<string, ClassAssignment>> {
    const yearId = await getCurrentAcademicYearId(db, schoolId);
    let q = db.from('subject_teacher_assignments')
        .select('subject_id, grade_id, grade_stream_id, teacher:subject_teachers!inner(user_id, user:users!inner(school_id))')
        .eq('teacher.user.school_id', schoolId);
    if (yearId) q = q.eq('academic_year_id', yearId);
    const [{ data: assignments, error }, { data: streams, error: streamsError }] = await Promise.all([
        q,
        db.from('grade_streams').select('id, grade_id').eq('school_id', schoolId),
    ]);
    if (error || streamsError) throw error ?? streamsError;

    const out = new Map<string, ClassAssignment & { byClass: string | null; byGrade: string | null }>();
    for (const a of assignments ?? []) {
        const teacherId = embedOne<{ user_id: string }>(a.teacher)?.user_id ?? null;
        const targets = a.grade_stream_id
            ? [a.grade_stream_id as string]
            : (streams ?? []).filter(s => s.grade_id === a.grade_id).map(s => s.id as string);
        for (const streamId of targets) {
            const key = assignmentKey(streamId, a.subject_id as string);
            const entry = out.get(key) ?? { streamId, subjectId: a.subject_id as string, teachers: new Set<string>(), teacherId: null, byClass: null, byGrade: null };
            if (teacherId) {
                entry.teachers.add(teacherId);
                if (a.grade_stream_id) entry.byClass ??= teacherId;
                else entry.byGrade ??= teacherId;
                entry.teacherId = entry.byClass ?? entry.byGrade;
            }
            out.set(key, entry);
        }
    }
    return out;
}

/**
 * Gives each load whose teacher is no longer assigned to its class and
 * subject the one who is. A load kept with any assigned teacher (say one of
 * two sharing a subject) is left alone. Returns how many changed.
 */
export async function syncLoadTeachers(db: SupabaseClient, schoolId: string, assigned?: Map<string, ClassAssignment>): Promise<number> {
    const [now, { data: loads, error }] = await Promise.all([
        assigned ?? classAssignments(db, schoolId),
        db.from('timetable_requirements').select('id, grade_stream_id, subject_id, teacher_id').eq('school_id', schoolId),
    ]);
    if (error) throw error;
    const changes = (loads ?? []).flatMap(r => {
        const a = now.get(assignmentKey(r.grade_stream_id as string, r.subject_id as string));
        if (!a?.teacherId || (r.teacher_id && a.teachers.has(r.teacher_id as string))) return [];
        return [{ id: r.id as string, teacherId: a.teacherId }];
    });
    const results = await Promise.all(changes.map(c => db.from('timetable_requirements')
        .update({ teacher_id: c.teacherId })
        .eq('id', c.id).eq('school_id', schoolId)));
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
    return changes.length;
}
