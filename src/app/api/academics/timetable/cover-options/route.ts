import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadLessons, publishedVersionId } from '@/lib/timetable/server';
import type { TimetableLesson } from '@/lib/timetable/config';

export interface CoverCandidate { id: string; name: string; sameSubject: boolean; weeklyLessons: number }
export interface CoverNeed { lesson: TimetableLesson; candidates: CoverCandidate[]; coveredBy: string | null }

/**
 * For an absent teacher on a date: each of their lessons that day, with the
 * teachers free in that period ranked by who teaches the same subject, then
 * by lightest weekly load. Teachers already covering that slot are left out.
 */
export const GET = route('timetable cover options', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const date = request.nextUrl.searchParams.get('date');
    const teacherId = request.nextUrl.searchParams.get('teacher_id');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !teacherId) throw new HttpError(400, 'Choose a date and the absent teacher.');
    const versionId = await publishedVersionId(access.schoolId);
    if (!versionId) throw new HttpError(400, 'Publish a timetable first.');

    const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // Monday = 1
    const db = createSupabaseAdmin();
    const [all, { data: staff, error: staffError }, { data: covers, error: coversError }] = await Promise.all([
        loadLessons(versionId),
        db.from('users').select('id, first_name, last_name').eq('school_id', access.schoolId).in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER']),
        db.from('timetable_substitutions').select('lesson_id, cover_teacher_id').eq('school_id', access.schoolId).eq('cover_date', date),
    ]);
    if (staffError || coversError) throw staffError ?? coversError;

    const load = new Map<string, number>();
    const subjectsTaught = new Map<string, Set<string>>();
    const busy = new Set<string>();
    for (const l of all) {
        if (!l.teacher_id) continue;
        load.set(l.teacher_id, (load.get(l.teacher_id) ?? 0) + 1);
        subjectsTaught.set(l.teacher_id, (subjectsTaught.get(l.teacher_id) ?? new Set()).add(l.subject_id));
        if (l.day === weekday) busy.add(`${l.teacher_id}|${l.period}`);
    }
    const lessonById = new Map(all.map(l => [l.id, l]));
    const coverOf = new Map((covers ?? []).map(c => [c.lesson_id as string, c.cover_teacher_id as string]));
    for (const c of covers ?? []) {
        const l = lessonById.get(c.lesson_id as string);
        if (l) busy.add(`${c.cover_teacher_id}|${l.period}`);
    }

    const needs: CoverNeed[] = all
        .filter(l => l.teacher_id === teacherId && l.day === weekday)
        .map(lesson => ({
            lesson,
            coveredBy: coverOf.get(lesson.id) ?? null,
            candidates: (staff ?? [])
                .filter(u => u.id !== teacherId && !busy.has(`${u.id}|${lesson.period}`))
                .map(u => ({
                    id: u.id as string,
                    name: `${u.first_name} ${u.last_name}`.trim(),
                    sameSubject: subjectsTaught.get(u.id as string)?.has(lesson.subject_id) ?? false,
                    weeklyLessons: load.get(u.id as string) ?? 0,
                }))
                .sort((x, y) => Number(y.sameSubject) - Number(x.sameSubject) || x.weeklyLessons - y.weeklyLessons)
                .slice(0, 8),
        }));
    return { weekday, needs };
});
