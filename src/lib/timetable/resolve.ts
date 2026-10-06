import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, assertInSchool, type Access } from '@/lib/platform/access';
import { loadConfig, loadLessons, loadVersion, publishedVersionId } from './server';
import type { TimetableConfig, TimetableLesson } from './config';
import type { TimetablePdfView } from './pdf-url';

const COLUMNS = { class: 'grade_stream_id', teacher: 'teacher_id', room: 'room_id' } as const;

export interface ResolvedTimetable {
    config: TimetableConfig;
    lessons: TimetableLesson[];
    published: boolean;
    /** Whose timetable it is, from the caller's side: a teacher's `mine` is a teacher view. */
    mode: 'class' | 'teacher' | 'room' | 'master';
}

const isView = (v: string): v is TimetablePdfView => ['mine', 'class', 'teacher', 'room', 'master'].includes(v);

/**
 * The lessons a caller may see for a view, shared by the screen and the PDF.
 * Learners only get their own class. `version` reads a draft and needs
 * `timetable.manage`; otherwise the published timetable is used.
 */
export async function resolveTimetable(access: Access, params: URLSearchParams): Promise<ResolvedTimetable> {
    const view = params.get('view') ?? 'mine';
    if (!isView(view)) throw new HttpError(400, 'Unknown timetable view.');
    const config = await loadConfig(access.schoolId);

    const draft = params.get('version');
    if (draft && !access.can('timetable.manage')) throw new HttpError(403, 'Only timetable managers can open drafts.');
    const versionId = draft ? (await loadVersion(draft, access.schoolId)).id : await publishedVersionId(access.schoolId);
    const empty = (mode: ResolvedTimetable['mode']): ResolvedTimetable => ({ config, lessons: [], published: !!versionId, mode });

    if (view === 'mine') {
        if (access.role === 'STUDENT') {
            if (!versionId) return empty('class');
            const { data } = await createSupabaseAdmin().from('students').select('current_grade_stream_id').eq('id', access.userId).maybeSingle();
            const streamId = data?.current_grade_stream_id as string | undefined;
            return { ...empty('class'), lessons: streamId ? await loadLessons(versionId, { column: 'grade_stream_id', value: streamId }) : [] };
        }
        return versionId ? { ...empty('teacher'), lessons: await loadLessons(versionId, { column: 'teacher_id', value: access.userId }) } : empty('teacher');
    }

    if (access.role === 'STUDENT') throw new HttpError(403, 'You can only see your own timetable.');
    if (view === 'master') return versionId ? { ...empty('master'), lessons: await loadLessons(versionId) } : empty('master');

    const column = COLUMNS[view];
    const id = params.get('id');
    if (!id) throw new HttpError(400, 'Choose a class, teacher or room.');
    if (column === 'grade_stream_id') await assertInSchool('grade_streams', [id], access.schoolId);
    if (column === 'room_id') await assertInSchool('rooms', [id], access.schoolId);
    return versionId ? { ...empty(view), lessons: await loadLessons(versionId, { column, value: id }) } : empty(view);
}
