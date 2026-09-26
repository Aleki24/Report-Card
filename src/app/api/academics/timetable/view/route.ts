import { route, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadConfig, loadLessons, publishedVersionId } from '@/lib/timetable/server';

const VIEWS = { class: 'grade_stream_id', teacher: 'teacher_id', room: 'room_id' } as const;

/**
 * The published timetable for a class, teacher or room, or `mine`: a
 * teacher's own lessons, or a learner's class. Includes the day structure.
 */
export const GET = route('timetable view', { module: 'timetable', permission: 'timetable.view' }, async ({ access, request }) => {
    const params = request.nextUrl.searchParams;
    const view = params.get('view') ?? 'mine';
    const config = await loadConfig(access.schoolId);
    const versionId = await publishedVersionId(access.schoolId);
    if (!versionId) return { config, lessons: [], published: false };

    if (view === 'mine') {
        if (access.role === 'STUDENT') {
            const { data } = await createSupabaseAdmin().from('students').select('current_grade_stream_id').eq('id', access.userId).maybeSingle();
            if (!data) return { config, lessons: [], published: true };
            return { config, lessons: await loadLessons(versionId, { column: 'grade_stream_id', value: data.current_grade_stream_id as string }), published: true };
        }
        return { config, lessons: await loadLessons(versionId, { column: 'teacher_id', value: access.userId }), published: true };
    }

    if (access.role === 'STUDENT') throw new HttpError(403, 'You can only see your own timetable.');
    const column = VIEWS[view as keyof typeof VIEWS];
    const id = params.get('id');
    if (!column || !id) throw new HttpError(400, 'Choose a class, teacher or room.');
    if (column === 'grade_stream_id') await assertInSchool('grade_streams', [id], access.schoolId);
    if (column === 'room_id') await assertInSchool('rooms', [id], access.schoolId);
    return { config, lessons: await loadLessons(versionId, { column, value: id }), published: true };
});
