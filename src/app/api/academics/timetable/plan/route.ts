import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTimetablePlan, type PlannedLoad } from '@/lib/timetable/server';
import { assess, type PlanLoad, type TeacherWeek, type TimetablePlan } from '@/lib/timetable/readiness';
import { teacherWeeks } from '@/lib/timetable/blocks';
import { ministryAllocation } from '@/lib/timetable/allocations';
import { isMisnamedBreak } from '@/lib/ops/forms/academics';
import { classFixes, fitClassOf } from '@/lib/timetable/fit';

const toLoad = (l: PlannedLoad): PlanLoad => ({
    id: l.id,
    subject: l.subjectName,
    teacher: l.row.teacher ? `${l.row.teacher.first_name} ${l.row.teacher.last_name}`.trim() : null,
    lessons: l.lessons,
});

/** GET — the studio's picture: the day, each class's fit and option blocks, drafts, and what blocks generating. */
export const GET = route('timetable plan', { module: 'timetable', permission: 'timetable.manage' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const [{ config, rows, plans, capacityOf, bandOf }, rooms, versions] = await Promise.all([
        loadTimetablePlan(access.schoolId),
        db.from('rooms').select('id', { count: 'exact', head: true }).eq('school_id', access.schoolId),
        db.from('timetable_versions').select('name, status').eq('school_id', access.schoolId),
    ]);
    const teaching = config.periods.filter(p => !p.is_break);
    const nameOf = new Map(rows.map(r => [r.grade_stream_id, r.stream?.full_name ?? '']));
    const classes = [...plans.values()]
        .map(p => ({
            ...(p.fits ? {} : { fixes: classFixes(config, bandOf(p.streamId), fitClassOf(p)) }),
            streamId: p.streamId,
            name: nameOf.get(p.streamId) ?? '',
            capacity: p.capacity,
            needed: p.needed,
            fits: p.fits,
            core: p.core.map(toLoad),
            blocks: p.blocks.map(b => ({ number: b.number, label: b.label, lessons: b.lessons, manual: b.manual, teacherClash: b.teacherClash, loads: b.loads.map(toLoad) })),
            unassigned: [...p.core, ...p.blocks.flatMap(b => b.loads)].filter(l => !l.teacherId).length,
            basis: p.basis,
            learnersWithChoices: p.learnersWithChoices,
            offMinistry: rows.filter(r => r.grade_stream_id === p.streamId).flatMap(r => {
                const ministry = r.subject ? ministryAllocation(r.stream?.grade ?? null, r.subject) : null;
                return ministry && ministry.lessons !== r.lessons_per_week ? [{ subject: r.subject?.name ?? '', lessons: r.lessons_per_week, ministry: ministry.lessons }] : [];
            }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    // A longer day is for a whole level: name its classes ("Form 3 and Form 4"), not the level.
    for (const c of classes) {
        const day = c.fixes?.longerDay;
        if (!day) continue;
        const band = bandOf(c.streamId);
        const names = classes.filter(o => bandOf(o.streamId) === band).map(o => o.name);
        day.level = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    }
    // Every teacher's whole week, Junior and Senior Secondary together, so no one is booked past the week.
    const weeks = teacherWeeks(plans.values());
    const teacherInfo = new Map<string, { name: string; capacity: number; classes: Set<string> }>();
    for (const r of rows) {
        if (!r.teacher_id) continue;
        const t = teacherInfo.get(r.teacher_id) ?? { name: r.teacher ? `${r.teacher.first_name} ${r.teacher.last_name}`.trim() : 'A teacher', capacity: 0, classes: new Set<string>() };
        t.capacity = Math.max(t.capacity, capacityOf(r.grade_stream_id));
        t.classes.add(r.stream?.full_name ?? '');
        teacherInfo.set(r.teacher_id, t);
    }
    const teachers: TeacherWeek[] = [...weeks.entries()]
        .map(([id, lessons]) => {
            const t = teacherInfo.get(id);
            return { name: t?.name ?? 'A teacher', lessons, capacity: t?.capacity ?? 0, classes: [...(t?.classes ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
        })
        .sort((a, b) => b.lessons - a.lessons);

    const base = {
        day: {
            days: config.days.length,
            lessonsPerDay: teaching.length,
            starts: config.periods[0]?.start ?? null,
            ends: config.periods[config.periods.length - 1]?.end ?? null,
            sections: config.sections.length,
            breakMismatches: [...config.periods, ...config.sections.flatMap(s => s.periods)].filter(isMisnamedBreak).map(p => p.label),
        },
        rooms: rooms.count ?? 0,
        loads: rows.length,
        classes,
        teachers,
        drafts: (versions.data ?? []).length,
        published: (versions.data ?? []).find(v => v.status === 'PUBLISHED')?.name ?? null,
    };
    return { ...base, ...assess(base) } satisfies TimetablePlan;
});
