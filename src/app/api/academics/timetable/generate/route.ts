import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { solveTimetable, type PinnedLesson, type SolverRequirement } from '@/lib/timetable/solver';
import { AFTERNOON_CATEGORIES, MAIN_SECTION_ID, MORNING_CATEGORIES, minutesOf, type TimetablePeriod } from '@/lib/timetable/config';
import { loadTimetablePlan, loadVersion, type LoadRow, type PlannedLoad } from '@/lib/timetable/server';
import { blockLabel, planProblem, teacherWeeks } from '@/lib/timetable/blocks';
import { periodKindMismatch } from '@/lib/ops/forms/academics';
import { insertChunked } from '@/lib/db-batch';

export const maxDuration = 60;

const bodySchema = z.object({
    name: z.string().trim().min(1).max(120),
    /** Keep this version's locked lessons where they are. */
    keep_locked_from: z.string().uuid().optional(),
    seed: z.number().int().min(0).max(2 ** 31).optional(),
});

/** A block's id in the solver: one class slot shared by its electives. */
const blockId = (streamId: string, n: number) => `block:${streamId}:${n}`;
const blockLabelOf = (id: string) => blockLabel(Number(id.split(':')[2]));

/** Builds a new draft timetable from the teaching loads, rooms and day structure. */
export const POST = route('timetable generate', { module: 'timetable', permission: 'timetable.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [{ config, rows, sectionOf, capacityOf, plans }, { data: rooms, error: roomsError }] = await Promise.all([
        loadTimetablePlan(access.schoolId),
        db.from('rooms').select('id, room_type').eq('school_id', access.schoolId),
    ]);
    if (roomsError) throw roomsError;
    if (rows.length === 0) throw new HttpError(400, 'Add teaching loads first (or import them from subject assignments).');

    // A break set as a lesson would get lessons timetabled in it.
    const misnamed = [...config.periods, ...config.sections.flatMap(s => s.periods)].map(periodKindMismatch).filter((m): m is string => !!m);
    if (misnamed.length > 0) throw new HttpError(400, misnamed.join(' '));

    // Option blocks already fit electives into the week; what still overflows needs the school.
    const problems = [...plans.values()].map(p => planProblem(p, rows.find(r => r.grade_stream_id === p.streamId)?.stream?.full_name ?? 'A class')).filter((m): m is string => !!m);
    // A teacher's week across every class, Junior and Senior Secondary alike, must fit the periods.
    const capacityByTeacher = new Map<string, number>();
    rows.forEach(r => { if (r.teacher_id) capacityByTeacher.set(r.teacher_id, Math.max(capacityByTeacher.get(r.teacher_id) ?? 0, capacityOf(r.grade_stream_id))); });
    for (const [teacherId, lessons] of teacherWeeks(plans.values())) {
        const capacity = capacityByTeacher.get(teacherId) ?? 0;
        if (lessons > capacity) {
            const t = rows.find(r => r.teacher_id === teacherId)?.teacher;
            problems.push(`${t ? `${t.first_name} ${t.last_name}` : 'A teacher'} has ${lessons} lessons a week but the week has ${capacity} periods.`);
        }
    }
    if (problems.length > 0) throw new HttpError(400, problems.join(' '));

    // Whole-class loads as they are; each option block as one requirement booking all its teachers.
    const solverReqs: SolverRequirement[] = [];
    const blockMembers = new Map<string, PlannedLoad[]>();
    const memberBlock = new Map<string, string>();
    const prefers = (category: string | null | undefined) => ({
        preferMorning: MORNING_CATEGORIES.has(category ?? ''),
        preferAfternoon: AFTERNOON_CATEGORIES.has(category ?? ''),
    });
    for (const plan of plans.values()) {
        const sectionId = sectionOf(plan.streamId).id;
        for (const l of plan.core) {
            solverReqs.push({
                id: l.id, streamId: l.streamId, subjectId: l.row.subject_id, teacherId: l.teacherId, lessons: l.lessons,
                doubles: l.doubles, roomType: l.row.room_type, sectionId, ...prefers(l.category),
            });
        }
        for (const b of plan.blocks) {
            const id = blockId(plan.streamId, b.number);
            blockMembers.set(id, b.loads);
            b.loads.forEach(l => memberBlock.set(l.id, id));
            const teachers = [...new Set(b.loads.map(l => l.teacherId).filter((t): t is string => !!t))];
            solverReqs.push({
                id, streamId: plan.streamId, subjectId: id, teacherId: teachers[0] ?? null, coTeacherIds: teachers.slice(1),
                lessons: b.lessons, doubles: Math.min(...b.loads.map(l => l.doubles)), roomType: null, sectionId,
                ...prefers(b.loads.every(l => l.category === b.loads[0].category) ? b.loads[0].category : null),
            });
        }
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
        // A pinned elective pins its whole block, once per slot.
        const seen = new Set<string>();
        pinned = (locked ?? []).flatMap(l => {
            const requirementId = memberBlock.get(l.requirement_id as string) ?? (l.requirement_id as string);
            const key = `${requirementId}|${l.day}|${l.period}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [{ requirementId, day: l.day as number, period: l.period as number, roomId: memberBlock.has(l.requirement_id as string) ? null : l.room_id as string | null }];
        });
    }

    const toSolver = (periods: readonly TimetablePeriod[]) => periods.map((p, index) => ({ index, isBreak: p.is_break, start: minutesOf(p.start), end: minutesOf(p.end) }));
    // Several shuffles, the best kept (see solveTimetable).
    const result = solveTimetable({
        days: config.days,
        sections: [{ id: MAIN_SECTION_ID, periods: toSolver(config.periods) }, ...config.sections.map(s => ({ id: s.id, periods: toSolver(s.periods) }))],
        requirements: solverReqs,
        rooms: (rooms ?? []).map(r => ({ id: r.id as string, type: r.room_type as string })),
        pinned,
        rules: { maxConsecutive: config.rules.max_consecutive, timeBudgetMs: 12_000, seed: body.seed ?? Date.now() % 2 ** 31 },
    }, 4);

    const byId = new Map(rows.map(r => [r.id, r]));
    const labelOf = (id: string) => {
        const members = blockMembers.get(id);
        if (members) return `${members[0].row.stream?.full_name ?? ''} ${blockLabelOf(id)} (${members.map(m => m.subjectName).join(', ')})`;
        const r = byId.get(id);
        return `${r?.stream?.full_name ?? ''} ${r?.subject?.name ?? ''}`.trim();
    };
    const unplaced = result.unplaced.map(u => ({ label: labelOf(u.requirementId), lessons: u.lessons }));

    // A block's slots become one lesson per elective; a shorter elective takes the first of them.
    const lessonRows: Record<string, unknown>[] = [];
    const slotsOf = new Map<string, typeof result.lessons>();
    for (const l of result.lessons) slotsOf.set(l.requirementId, [...(slotsOf.get(l.requirementId) ?? []), l]);
    const row = (r: LoadRow, l: (typeof result.lessons)[number], roomId: string | null) => ({
        school_id: access.schoolId, version_id: '', requirement_id: r.id, day: l.day, period: l.period,
        grade_stream_id: r.grade_stream_id, subject_id: r.subject_id, teacher_id: r.teacher_id, room_id: roomId, locked: l.pinned,
    });
    for (const [id, slots] of slotsOf) {
        const members = blockMembers.get(id);
        if (!members) { slots.forEach(l => lessonRows.push(row(byId.get(id)!, l, l.roomId))); continue; }
        const ordered = [...slots].sort((a, b) => a.day - b.day || a.period - b.period);
        for (const m of members) ordered.slice(0, m.lessons).forEach(l => lessonRows.push(row(m.row, l, null)));
    }

    const { data: version, error: versionError } = await db.from('timetable_versions').insert({
        school_id: access.schoolId,
        name: body.name,
        status: 'DRAFT',
        stats: { ...result.stats, unplaced },
        created_by: access.userId,
    }).select('*').single();
    if (versionError || !version) throw versionError ?? new Error('version insert failed');

    try {
        await insertChunked('timetable_lessons', lessonRows.map(r => ({ ...r, version_id: version.id })));
    } catch (err) {
        await db.from('timetable_versions').delete().eq('id', version.id);
        throw err;
    }
    await audit(access, 'create', 'timetable_versions', version.id, { placed: result.stats.placed, required: result.stats.required });
    return version;
});
