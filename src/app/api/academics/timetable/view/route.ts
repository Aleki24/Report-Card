import { HttpError, route } from '@/lib/platform/access';
import type { TimetableViewResult } from '@/lib/ops/forms/academics';
import { resolveTimetable } from '@/lib/timetable/resolve';

/**
 * The published timetable for a class, teacher or room, or `mine`: a
 * teacher's own lessons, or a learner's class. Includes the day structure.
 */
export const GET = route('timetable view', { module: 'timetable', permission: 'timetable.view' }, async ({ access, request }) => {
    const { config, lessons, published, mode } = await resolveTimetable(access, request.nextUrl.searchParams);
    if (mode === 'master') throw new HttpError(400, 'Download the master timetable as a PDF.');
    return { config, lessons, published, mode } satisfies TimetableViewResult;
});
