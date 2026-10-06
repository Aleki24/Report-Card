import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTimetablePlan, type PlannedLoad } from '@/lib/timetable/server';
import { assess, type PlanLoad, type TimetablePlan } from '@/lib/timetable/readiness';

const toLoad = (l: PlannedLoad): PlanLoad => ({
    id: l.id,
    subject: l.subjectName,
    teacher: l.row.teacher ? `${l.row.teacher.first_name} ${l.row.teacher.last_name}`.trim() : null,
    lessons: l.lessons,
});

/** GET — the studio's picture: the day, each class's fit and option blocks, drafts, and what blocks generating. */
export const GET = route('timetable plan', { module: 'timetable', permission: 'timetable.manage' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const [{ config, rows, plans }, rooms, versions] = await Promise.all([
        loadTimetablePlan(access.schoolId),
        db.from('rooms').select('id', { count: 'exact', head: true }).eq('school_id', access.schoolId),
        db.from('timetable_versions').select('name, status').eq('school_id', access.schoolId),
    ]);
    const teaching = config.periods.filter(p => !p.is_break);
    const nameOf = new Map(rows.map(r => [r.grade_stream_id, r.stream?.full_name ?? '']));
    const classes = [...plans.values()]
        .map(p => ({
            streamId: p.streamId,
            name: nameOf.get(p.streamId) ?? '',
            capacity: p.capacity,
            needed: p.needed,
            fits: p.fits,
            core: p.core.map(toLoad),
            blocks: p.blocks.map(b => ({ number: b.number, label: b.label, lessons: b.lessons, manual: b.manual, teacherClash: b.teacherClash, loads: b.loads.map(toLoad) })),
            unassigned: [...p.core, ...p.blocks.flatMap(b => b.loads)].filter(l => !l.teacherId).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const base = {
        day: {
            days: config.days.length,
            lessonsPerDay: teaching.length,
            starts: config.periods[0]?.start ?? null,
            ends: config.periods[config.periods.length - 1]?.end ?? null,
            sections: config.sections.length,
        },
        rooms: rooms.count ?? 0,
        loads: rows.length,
        classes,
        drafts: (versions.data ?? []).length,
        published: (versions.data ?? []).find(v => v.status === 'PUBLISHED')?.name ?? null,
    };
    return { ...base, ...assess(base) } satisfies TimetablePlan;
});
