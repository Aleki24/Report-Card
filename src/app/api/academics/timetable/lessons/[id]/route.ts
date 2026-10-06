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
 * Moves a lesson (swapping with the class's lessons already in that slot, if
 * any), changes its room, or pins it. An option block's electives share a
 * slot and move as one. Refuses anything that would put a teacher or room in
 * two places at once.
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
        .eq('version_id', a.version_id).in('day', [...new Set([day, a.day])]);
    if (targetError) throw targetError;
    const pool = (sameDay ?? []) as LessonRow[];
    // An option block is several lessons in one class slot: they move together.
    const inSlot = (d: number, p: number) => pool.filter(o => o.grade_stream_id === a.grade_stream_id && o.day === d && o.period === p);
    const group = moving ? inSlot(a.day, a.period) : [a];
    const swapGroup = moving ? inSlot(day, period) : [];
    const ignore = [...group, ...swapGroup].map(o => o.id);

    const clash = (who: LessonRow, d: number, p: number, room: string | null) => {
        const at = clockOf({ grade_stream_id: who.grade_stream_id, period: p });
        if (!at) return null;
        return pool.find(o => {
            if (ignore.includes(o.id) || o.day !== d) return false;
            if (!((who.teacher_id && o.teacher_id === who.teacher_id) || (room && o.room_id === room))) return false;
            const theirs = clockOf(o);
            return !!theirs && at[0] < theirs[1] && theirs[0] < at[1];
        });
    };

    if (group.some(o => clash(o, day, period, o.id === a.id ? roomId : o.room_id))) {
        throw new HttpError(409, 'A teacher or room is already busy at that time.');
    }
    if (swapGroup.some(o => clash(o, a.day, a.period, o.room_id))) {
        throw new HttpError(409, 'Swapping would double-book the other lesson’s teacher or room.');
    }

    const set = async (ids: string[], values: Record<string, unknown>) => {
        if (ids.length === 0) return;
        const { error: e } = await db.from('timetable_lessons').update(values).in('id', ids);
        if (e) throw e;
    };
    const locked = body.locked !== undefined ? { locked: body.locked } : {};
    if (!moving) {
        await set([a.id], { room_id: roomId, ...locked });
        return { swapped: false };
    }
    // Park the slot's lessons outside the grid first, so no class ever holds a subject twice mid-swap.
    await set(swapGroup.map(o => o.id), { period: PARK_PERIOD });
    await set(group.map(o => o.id), { day, period, ...locked });
    if (roomId !== a.room_id) await set([a.id], { room_id: roomId });
    await set(swapGroup.map(o => o.id), { day: a.day, period: a.period });
    return { swapped: swapGroup.length > 0 };
});
