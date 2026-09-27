import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

type Params = { id: string };

const bodySchema = z.object({
    day: z.number().int().min(1).max(7).optional(),
    period: z.number().int().min(0).max(30).optional(),
    room_id: z.string().uuid().nullable().optional(),
    locked: z.boolean().optional(),
});

interface LessonRow { id: string; version_id: string; day: number; period: number; grade_stream_id: string; teacher_id: string | null; room_id: string | null }

const LESSON_COLUMNS = 'id, version_id, day, period, grade_stream_id, teacher_id, room_id';
/** A period no real lesson uses, where a lesson waits for a moment during a swap. */
const PARK_PERIOD = 999;

/**
 * Moves a lesson (swapping with the class's lesson already in that slot, if
 * any), changes its room, or pins it. Refuses anything that would put a
 * teacher or room in two places at once.
 */
export const PATCH = route<Params>('timetable lesson update', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data: lesson, error } = await db.from('timetable_lessons').select(LESSON_COLUMNS).eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!lesson) throw new HttpError(404, 'Lesson not found.');
    const a = lesson as LessonRow;
    if (body.room_id) await assertInSchool('rooms', [body.room_id], access.schoolId);

    const day = body.day ?? a.day;
    const period = body.period ?? a.period;
    const roomId = body.room_id === undefined ? a.room_id : body.room_id;
    const moving = day !== a.day || period !== a.period;

    const { data: atTarget, error: targetError } = await db.from('timetable_lessons')
        .select(LESSON_COLUMNS)
        .eq('version_id', a.version_id).eq('day', day).eq('period', period).neq('id', a.id);
    if (targetError) throw targetError;
    const others = (atTarget ?? []) as LessonRow[];
    const swapWith = moving ? others.find(o => o.grade_stream_id === a.grade_stream_id) ?? null : null;

    const clash = (who: LessonRow, d: number, p: number, room: string | null, ignore: string[], pool: LessonRow[]) =>
        pool.find(o => !ignore.includes(o.id) && o.day === d && o.period === p
            && ((who.teacher_id && o.teacher_id === who.teacher_id) || (room && o.room_id === room)));

    if (clash(a, day, period, roomId, [a.id, swapWith?.id ?? ''], others)) {
        throw new HttpError(409, 'The teacher or room is already busy in that slot.');
    }
    if (swapWith) {
        const { data: atSource, error: sourceError } = await db.from('timetable_lessons')
            .select(LESSON_COLUMNS).eq('version_id', a.version_id).eq('day', a.day).eq('period', a.period);
        if (sourceError) throw sourceError;
        if (clash(swapWith, a.day, a.period, swapWith.room_id, [a.id, swapWith.id], (atSource ?? []) as LessonRow[])) {
            throw new HttpError(409, 'Swapping would double-book the other lesson’s teacher or room.');
        }
        // Park one lesson outside the grid so the unique (class, slot) index never sees both in one place.
        const park = await db.from('timetable_lessons').update({ period: PARK_PERIOD }).eq('id', swapWith.id);
        if (park.error) throw park.error;
        const moveA = await db.from('timetable_lessons').update({ day, period, room_id: roomId, ...(body.locked !== undefined ? { locked: body.locked } : {}) }).eq('id', a.id);
        if (moveA.error) throw moveA.error;
        const moveB = await db.from('timetable_lessons').update({ day: a.day, period: a.period }).eq('id', swapWith.id);
        if (moveB.error) throw moveB.error;
        return { swapped: true };
    }

    const update: Record<string, unknown> = { day, period, room_id: roomId };
    if (body.locked !== undefined) update.locked = body.locked;
    const { error: updateError } = await db.from('timetable_lessons').update(update).eq('id', a.id);
    if (updateError) throw updateError;
    return { swapped: false };
});
