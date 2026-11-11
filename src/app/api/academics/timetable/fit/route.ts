import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTimetablePlan, saveConfig } from '@/lib/timetable/server';
import { fewerLessons, fitClassOf, longerDay, withLongerDay } from '@/lib/timetable/fit';

const bodySchema = z.object({
    stream_id: z.string().uuid(),
    fix: z.enum(['longer-day', 'fewer-lessons', 'fewer-groups', 'auto-groups']),
});

/**
 * POST — makes a class that does not fit its week fit, the way the studio
 * showed: a longer day for its level, fewer lessons a week, or its electives
 * in fewer groups (fixed as option blocks). `auto-groups` hands a class's
 * groups back to the planner. Worked out again here from the school's own
 * data, never taken from the request.
 */
export const POST = route('timetable fit class', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { stream_id, fix } = await parseBody(request, bodySchema);
    const { config, plans, bandOf } = await loadTimetablePlan(access.schoolId);
    const plan = plans.get(stream_id);
    if (!plan) throw new HttpError(404, 'That class has no teaching loads.');
    const db = createSupabaseAdmin();
    if (fix === 'auto-groups') {
        const { error } = await db.from('timetable_requirements').update({ option_block: null })
            .eq('school_id', access.schoolId).eq('grade_stream_id', stream_id).not('option_block', 'is', null);
        if (error) throw error;
        await audit(access, 'update', 'timetable_requirements', null, { stream_id, fix });
        return { changed: 1, message: 'Elective groups are worked out from learners’ choices again.' };
    }
    if (plan.fits) return { changed: 0, message: 'This class already fits its week.' };
    const fitClass = fitClassOf(plan);

    if (fix === 'longer-day') {
        const band = bandOf(stream_id);
        const day = longerDay(config, band, fitClass);
        if (!day || !band) throw new HttpError(400, 'This class’s level is not known, so its day cannot be lengthened. Edit the school day instead.');
        await saveConfig(access.schoolId, withLongerDay(config, band, day.extra));
        await audit(access, 'configure', 'timetable_configs', null, { stream_id, fix, extra: day.extra });
        return { changed: day.extra, message: `${day.level}: ${day.extra} more lesson${day.extra === 1 ? '' : 's'} a week (${day.changes.join('; ')}).` };
    }

    if (fix === 'fewer-groups') {
        if (!plan.tighter) throw new HttpError(400, 'No grouping of these electives fits the week. Give this class a longer day instead.');
        // Fixed as option blocks after any the school set by hand, so the planner keeps them.
        const first = Math.max(0, ...plan.blocks.filter(b => b.manual).map(b => b.number)) + 1;
        // A suggested group of one subject is just that subject for the whole class: nothing to fix.
        const groups = plan.tighter.guessed ? plan.tighter.groups.filter(g => g.loads.length > 1) : plan.tighter.groups;
        const results = await Promise.all(groups.flatMap((g, i) => g.loads.map(l => db.from('timetable_requirements')
            .update({ option_block: Math.min(12, first + i) })
            .eq('id', l.id).eq('school_id', access.schoolId))));
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
        await audit(access, 'update', 'timetable_requirements', null, { stream_id, fix, groups: plan.tighter.groups.length });
        if (plan.tighter.guessed) return { changed: groups.length, message: `${groups.length} group${groups.length === 1 ? '' : 's'} of electives now share a slot. Check that no learner takes two subjects from one group.` };
        return { changed: plan.tighter.groups.length, message: `Electives now run in ${plan.tighter.groups.length} groups. ${plan.tighter.unfit.length} learner${plan.tighter.unfit.length === 1 ? '' : 's'} must change a subject.` };
    }

    const cuts = fewerLessons(fitClass);
    if (!cuts) throw new HttpError(400, 'Too many lessons to cut without going below a sensible minimum. Give this class a longer day instead.');
    const results = await Promise.all(cuts.map(c => db.from('timetable_requirements')
        .update({ lessons_per_week: c.to })
        .eq('id', c.id).eq('school_id', access.schoolId)));
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
    await audit(access, 'update', 'timetable_requirements', null, { stream_id, fix, cuts: cuts.length });
    return { changed: cuts.length, message: `Lessons a week lowered for ${cuts.length} subject${cuts.length === 1 ? '' : 's'}.` };
});
