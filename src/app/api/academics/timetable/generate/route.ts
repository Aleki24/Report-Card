import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { solveTimetable, type PinnedLesson, type SolverRequirement } from '@/lib/timetable/solver';
import { MORNING_CATEGORIES } from '@/lib/timetable/config';
import { insertChunked, loadConfig, loadVersion } from '@/lib/timetable/server';

export const maxDuration = 60;

const bodySchema = z.object({
    name: z.string().trim().min(1).max(120),
    /** Keep this version's locked lessons where they are. */
    keep_locked_from: z.string().uuid().optional(),
    seed: z.number().int().min(0).max(2 ** 31).optional(),
});

interface RequirementRow {
    id: string;
    grade_stream_id: string;
    subject_id: string;
    teacher_id: string | null;
    lessons_per_week: number;
    double_lessons: number;
    room_type: string | null;
    subject: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
    stream: { full_name: string } | { full_name: string }[] | null;
}

/** Builds a new draft timetable from the teaching loads, rooms and day structure. */
export const POST = route('timetable generate', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [config, { data: reqRows, error }, { data: rooms, error: roomsError }] = await Promise.all([
        loadConfig(access.schoolId),
        db.from('timetable_requirements')
            .select('id, grade_stream_id, subject_id, teacher_id, lessons_per_week, double_lessons, room_type, subject:subjects(name, category), stream:grade_streams(full_name)')
            .eq('school_id', access.schoolId),
        db.from('rooms').select('id, room_type').eq('school_id', access.schoolId),
    ]);
    if (error || roomsError) throw error ?? roomsError;
    const requirements = (reqRows ?? []) as RequirementRow[];
    if (requirements.length === 0) throw new HttpError(400, 'Add teaching loads first (or import them from subject assignments).');

    const slotsPerWeek = config.days.length * config.periods.filter(p => !p.is_break).length;
    const overloaded = new Map<string, number>();
    requirements.forEach(r => overloaded.set(r.grade_stream_id, (overloaded.get(r.grade_stream_id) ?? 0) + r.lessons_per_week));
    const tooMany = requirements.filter(r => (overloaded.get(r.grade_stream_id) ?? 0) > slotsPerWeek);
    if (tooMany.length > 0) {
        const names = [...new Set(tooMany.map(r => embedOne(r.stream)?.full_name ?? 'A class'))];
        throw new HttpError(400, `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} more weekly lessons than the ${slotsPerWeek} periods in the week.`);
    }

    let pinned: PinnedLesson[] = [];
    if (body.keep_locked_from) {
        await loadVersion(body.keep_locked_from, access.schoolId);
        const { data: locked, error: lockedError } = await db.from('timetable_lessons')
            .select('requirement_id, day, period, room_id')
            .eq('version_id', body.keep_locked_from)
            .eq('locked', true)
            .not('requirement_id', 'is', null);
        if (lockedError) throw lockedError;
        pinned = (locked ?? []).map(l => ({ requirementId: l.requirement_id as string, day: l.day as number, period: l.period as number, roomId: l.room_id as string | null }));
    }

    const solverReqs: SolverRequirement[] = requirements.map(r => ({
        id: r.id,
        streamId: r.grade_stream_id,
        subjectId: r.subject_id,
        teacherId: r.teacher_id,
        lessons: r.lessons_per_week,
        doubles: r.double_lessons,
        roomType: r.room_type,
        preferMorning: MORNING_CATEGORIES.has(embedOne(r.subject)?.category ?? ''),
    }));
    const result = solveTimetable({
        days: config.days,
        periods: config.periods.map((p, index) => ({ index, isBreak: p.is_break })),
        requirements: solverReqs,
        rooms: (rooms ?? []).map(r => ({ id: r.id as string, type: r.room_type as string })),
        pinned,
        rules: { maxConsecutive: config.rules.max_consecutive, timeBudgetMs: 4000, seed: body.seed ?? Date.now() % 2 ** 31 },
    });

    const byId = new Map(requirements.map(r => [r.id, r]));
    const unplaced = result.unplaced.map(u => {
        const r = byId.get(u.requirementId);
        return { label: `${embedOne(r?.stream ?? null)?.full_name ?? ''} ${embedOne(r?.subject ?? null)?.name ?? ''}`.trim(), lessons: u.lessons };
    });

    const { data: version, error: versionError } = await db.from('timetable_versions').insert({
        school_id: access.schoolId,
        name: body.name,
        status: 'DRAFT',
        stats: { ...result.stats, unplaced },
        created_by: access.userId,
    }).select('*').single();
    if (versionError || !version) throw versionError ?? new Error('version insert failed');

    try {
        await insertChunked('timetable_lessons', result.lessons.map(l => {
            const r = byId.get(l.requirementId)!;
            return {
                school_id: access.schoolId, version_id: version.id, requirement_id: r.id,
                day: l.day, period: l.period, grade_stream_id: r.grade_stream_id, subject_id: r.subject_id,
                teacher_id: r.teacher_id, room_id: l.roomId, locked: l.pinned,
            };
        }));
    } catch (err) {
        await db.from('timetable_versions').delete().eq('id', version.id);
        throw err;
    }
    await audit(access, 'create', 'timetable_versions', version.id, { placed: result.stats.placed, required: result.stats.required });
    return version;
});
