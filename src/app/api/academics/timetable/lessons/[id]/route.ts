import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { minutesOf, sectionFor } from '@/lib/timetable/config';
import { loadConfig, streamBands } from '@/lib/timetable/server';

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

    // Sections can keep different bells, so "at the same time" means overlapping clock times.
    const [config, bands] = await Promise.all([loadConfig(access.schoolId), streamBands(access.schoolId)]);
    const periodsOf = (streamId: string) => sectionFor(config, bands.get(streamId) ?? null).periods;
    const target = periodsOf(a.grade_stream_id)[period];
    if (!target || target.is_break) throw new HttpError(400, 'That is not a lesson period for this class.');
    const clockOf = (l: { grade_stream_id: string; period: number }): [number, number] | null => {
        const p = periodsOf(l.grade_stream_id)[l.period];
        return p ? [minutesOf(p.start), minutesOf(p.end)] : null;
    };

    const { data: sameDay, error: targetError } = await db.from('timetable_lessons')
        .select(LESSON_COLUMNS)
        .eq('version_id', a.version_id).in('day', [...new Set([day, a.day])]).neq('id', a.id);
    if (targetError) throw targetError;
    const pool = (sameDay ?? []) as LessonRow[];
    const swapWith = moving ? pool.find(o => o.grade_stream_id === a.grade_stream_id && o.day === day && o.period === period) ?? null : null;

    const clash = (who: LessonRow, d: number, p: number, room: string | null, ignore: string[]) => {
        const at = clockOf({ grade_stream_id: who.grade_stream_id, period: p });
        if (!at) return null;
        return pool.find(o => {
            if (ignore.includes(o.id) || o.day !== d) return false;
            if (!((who.teacher_id && o.teacher_id === who.teacher_id) || (room && o.room_id === room))) return false;
            const theirs = clockOf(o);
            return !!theirs && at[0] < theirs[1] && theirs[0] < at[1];
        });
    };

    if (clash(a, day, period, roomId, [a.id, swapWith?.id ?? ''])) {
        throw new HttpError(409, 'The teacher or room is already busy at that time.');
    }
    if (swapWith) {
        if (clash(swapWith, a.day, a.period, swapWith.room_id, [a.id, swapWith.id])) {
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
