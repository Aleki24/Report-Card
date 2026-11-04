import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { LESSON_SELECT, type TimetableLesson } from '@/lib/timetable/config';
import { loadConfig } from '@/lib/timetable/server';
import { checkMove } from '@/lib/timetable/moves';

type Params = { id: string };

const bodySchema = z.object({
    day: z.number().int().min(1).max(7).optional(),
    period: z.number().int().min(0).max(30).optional(),
    room_id: z.string().uuid().nullable().optional(),
    locked: z.boolean().optional(),
});

/** A period no real lesson uses, where a lesson waits for a moment during a swap. */
const PARK_PERIOD = 999;

/**
 * Moves a lesson (swapping with the class's lessons already in that slot, if
 * any), changes its room, or pins it. An option block's electives share a
 * slot and move as one. Refuses a period that does not run that day, and
 * anything that would put a teacher or room in two places at once or a
 * teacher in a time they cannot teach (see `checkMove`).
 */
export const PATCH = route<Params>('timetable lesson update', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data: row, error } = await db.from('timetable_lessons').select(`${LESSON_SELECT}, version_id`).eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!row) throw new HttpError(404, 'Lesson not found.');
    const a = row as unknown as TimetableLesson & { version_id: string };
    if (body.room_id) await assertInSchool('rooms', [body.room_id], access.schoolId);

    const day = body.day ?? a.day;
    const period = body.period ?? a.period;
    const roomId = body.room_id === undefined ? a.room_id : body.room_id;
    const moving = day !== a.day || period !== a.period;

    if (!moving) {
        const locked = body.locked !== undefined ? { locked: body.locked } : {};
        const { error: e } = await db.from('timetable_lessons').update({ room_id: roomId, ...locked }).eq('id', a.id);
        if (e) throw e;
        return { swapped: false };
    }

    const [config, { data: sameDays, error: poolError }] = await Promise.all([
        loadConfig(access.schoolId),
        db.from('timetable_lessons').select(LESSON_SELECT).eq('version_id', a.version_id).in('day', [...new Set([day, a.day])]),
    ]);
    if (poolError) throw poolError;
    const pool = (sameDays ?? []) as unknown as TimetableLesson[];
    const check = checkMove(config, pool, { ...a, room_id: roomId }, day, period);
    if (!check.ok) throw new HttpError(409, check.reason);
    const group = pool.filter(o => o.grade_stream_id === a.grade_stream_id && o.day === a.day && o.period === a.period);

    // One transaction: the slot's lessons are parked outside the grid, the
    // group moves in and they move back, or nothing changes at all.
    const { error: swapError } = await db.rpc('swap_timetable_slot', {
        p_version_id: a.version_id,
        p_group: group.map(o => o.id),
        p_swap: check.swap.map(o => o.id),
        p_to_day: day,
        p_to_period: period,
        p_from_day: a.day,
        p_from_period: a.period,
        p_park_period: PARK_PERIOD,
        p_lesson: a.id,
        p_room: roomId,
        p_locked: body.locked ?? null,
    });
    if (swapError) throw swapError;
    return { swapped: check.swap.length > 0 };
});
