import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTimetablePlan } from '@/lib/timetable/server';
import { buildStudioPlan, unfitLearnerIds } from '@/lib/timetable/studio';
import type { TimetablePlan } from '@/lib/timetable/readiness';

/** GET — the studio's picture: the day, each class's fit and option blocks, teachers' weeks, drafts, and what blocks generating. */
export const GET = route('timetable plan', { module: 'timetable', permission: 'timetable.manage' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const [{ config, rows, plans, capacityOf, bandOf, sectionOf }, rooms, versions] = await Promise.all([
        loadTimetablePlan(access.schoolId),
        db.from('rooms').select('id', { count: 'exact', head: true }).eq('school_id', access.schoolId),
        db.from('timetable_versions').select('name, status').eq('school_id', access.schoolId),
    ]);
    if (rooms.error) throw rooms.error;
    if (versions.error) throw versions.error;
    // Names of learners whose choices do not fit their class's subject groups.
    const unfitIds = unfitLearnerIds(plans);
    const { data: learners, error } = unfitIds.length
        ? await db.from('users').select('id, first_name, last_name').in('id', unfitIds)
        : { data: [], error: null };
    if (error) throw error;
    const learnerNames = new Map((learners ?? []).map(u => [u.id as string, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'A learner']));
    return buildStudioPlan({
        config, rows, plans, bandOf, sectionOf, capacityOf, learnerNames,
        rooms: rooms.count ?? 0,
        versions: versions.data ?? [],
    }) satisfies TimetablePlan;
});
