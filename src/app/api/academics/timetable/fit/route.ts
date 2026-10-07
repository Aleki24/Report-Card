import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTimetablePlan, saveConfig } from '@/lib/timetable/server';
import { fewerLessons, fitClassOf, longerDay, withLongerDay } from '@/lib/timetable/fit';

const bodySchema = z.object({
    stream_id: z.string().uuid(),
    fix: z.enum(['longer-day', 'fewer-lessons']),
});

/**
 * POST — makes a class that does not fit its week fit, the way the studio
 * showed: a longer day for its level, or fewer lessons a week. Worked out
 * again here from the school's own data, never taken from the request.
 */
export const POST = route('timetable fit class', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const { stream_id, fix } = await parseBody(request, bodySchema);
    const { config, plans, bandOf } = await loadTimetablePlan(access.schoolId);
    const plan = plans.get(stream_id);
    if (!plan) throw new HttpError(404, 'That class has no teaching loads.');
    if (plan.fits) return { changed: 0, message: 'This class already fits its week.' };
    const fitClass = fitClassOf(plan);

    if (fix === 'longer-day') {
        const band = bandOf(stream_id);
        const day = longerDay(config, band, fitClass);
        if (!day || !band) throw new HttpError(400, 'This class’s level is not known, so its day cannot be lengthened. Edit the school day instead.');
        await saveConfig(access.schoolId, withLongerDay(config, band, day.perDay));
        await audit(access, 'configure', 'timetable_configs', null, { stream_id, fix, per_day: day.perDay });
        return { changed: day.perDay, message: `${day.level} now has ${day.perDay} more lesson${day.perDay === 1 ? '' : 's'} a day (${day.times.join(', ')}).` };
    }

    const cuts = fewerLessons(fitClass);
    if (!cuts) throw new HttpError(400, 'Too many lessons to cut without going below a sensible minimum. Give this class a longer day instead.');
    const db = createSupabaseAdmin();
    const results = await Promise.all(cuts.map(c => db.from('timetable_requirements')
        .update({ lessons_per_week: c.to })
        .eq('id', c.id).eq('school_id', access.schoolId)));
    const failed = results.find(r => r.error);
    if (failed?.error) throw failed.error;
    await audit(access, 'update', 'timetable_requirements', null, { stream_id, fix, cuts: cuts.length });
    return { changed: cuts.length, message: `Lessons a week lowered for ${cuts.length} subject${cuts.length === 1 ? '' : 's'}.` };
});
