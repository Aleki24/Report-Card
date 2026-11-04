/**
 * The studio's picture of a school, put together from what the server has
 * read: each class's fit and elective groups against the Ministry's lessons,
 * every teacher's week, the day, and what stops generating. Pure, so the plan
 * route and anything that checks it build exactly the same thing.
 */

import { BAND_LABELS, type CurriculumBand } from '../curriculum-bands';
import { ministryAllocation } from './allocations';
import { teacherWeeks, type ClassPlan } from './blocks';
import { timeOfDay } from './checks';
import { lessonsOn, weeklyLessons, type TimetableConfig, type TimetablePeriod } from './config';
import { classFixes, fitClassOf } from './fit';
import { availableLessons } from './moves';
import { assess, type PlanClass, type PlanLoad, type TeacherWeek, type TimetablePlan } from './readiness';
import { isMisnamedBreak } from '../ops/forms/academics';
import type { LoadRow, PlannedLoad } from './server';

export interface StudioInput {
    config: TimetableConfig;
    rows: readonly LoadRow[];
    plans: ReadonlyMap<string, ClassPlan<PlannedLoad>>;
    bandOf: (streamId: string) => CurriculumBand | null;
    sectionOf: (streamId: string) => { periods: readonly TimetablePeriod[] };
    capacityOf: (streamId: string) => number;
    /** Special rooms the school has. */
    rooms: number;
    versions: readonly { name: string; status: string }[];
    /** Learners' names by id, for those whose choices do not fit. */
    learnerNames: ReadonlyMap<string, string>;
}

const COMBINATION = 'combination:';

/** Learners whose elective choices do not fit their class's groups (now, or with fewer groups): whose names the studio shows. */
export const unfitLearnerIds = (plans: ReadonlyMap<string, ClassPlan>): string[] =>
    [...new Set([...plans.values()].flatMap(p => [...p.unfit, ...(p.tighter?.unfit ?? [])].map(u => u.learnerId)))].filter(id => !id.startsWith(COMBINATION));

const personName = (p: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}`.trim() : null);

/** "Form 3", "Form 3 and Form 4", "Form 2, Form 3 and Form 4". */
const namesList = (names: readonly string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

export function buildStudioPlan(input: StudioInput): TimetablePlan {
    const { config, rows, plans, bandOf, sectionOf, capacityOf } = input;
    const toLoad = (l: PlannedLoad): PlanLoad => ({
        id: l.id,
        subjectId: l.subjectId,
        subject: l.subjectName,
        teacher: personName(l.row.teacher),
        lessons: l.lessons,
        doubles: l.doubles,
        ministry: l.row.subject ? ministryAllocation(l.row.stream?.grade ?? null, l.row.subject)?.lessons ?? null : null,
        time: timeOfDay(config, l.subjectId, l.category),
        timeChosen: !!config.rules.subject_times[l.subjectId],
    });
    const nameOf = new Map(rows.map(r => [r.grade_stream_id, r.stream?.full_name ?? '']));
    const learnerLabel = (id: string) =>
        id.startsWith(COMBINATION) ? `Combination ${id.slice(COMBINATION.length)}` : input.learnerNames.get(id) ?? 'A learner';
    const unfitOf = (unfit: readonly { learnerId: string; subjects: [string, string] }[]) => unfit.map(u => ({ name: learnerLabel(u.learnerId), subjects: u.subjects }));

    const classes: PlanClass[] = [...plans.values()]
        .map(p => {
            const band = bandOf(p.streamId);
            const loads = [...p.core, ...p.blocks.flatMap(b => b.loads)];
            return {
                ...(p.fits ? {} : {
                    fixes: {
                        ...classFixes(config, band, fitClassOf(p)),
                        fewerGroups: p.tighter ? {
                            groups: p.tighter.groups.map(g => ({ label: g.label, subjects: g.loads.map(l => l.subjectName), lessons: g.lessons })),
                            unfit: unfitOf(p.tighter.unfit),
                        } : null,
                    },
                }),
                streamId: p.streamId,
                name: nameOf.get(p.streamId) ?? '',
                capacity: p.capacity,
                needed: p.needed,
                fits: p.fits,
                core: p.core.map(toLoad),
                blocks: p.blocks.map(b => ({ number: b.number, label: b.label, lessons: b.lessons, manual: b.manual, teacherClash: b.teacherClash, loads: b.loads.map(toLoad) })),
                level: band ? BAND_LABELS[band] : null,
                unassigned: loads.filter(l => !l.teacherId).length,
                basis: p.basis,
                learnersWithChoices: p.learnersWithChoices,
                choiceSource: p.choiceSource,
                unfit: unfitOf(p.unfit),
                offMinistry: loads.flatMap(l => {
                    const ministry = l.row.subject ? ministryAllocation(l.row.stream?.grade ?? null, l.row.subject) : null;
                    return ministry && ministry.lessons !== l.lessons ? [{ subject: l.subjectName, lessons: l.lessons, ministry: ministry.lessons }] : [];
                }),
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    // A longer day is for a whole level: name its classes ("Form 3 and Form 4"), not the level.
    for (const c of classes) {
        const day = c.fixes?.longerDay;
        if (!day) continue;
        const band = bandOf(c.streamId);
        day.level = namesList(classes.filter(o => bandOf(o.streamId) === band).map(o => o.name));
    }

    // Every teacher's whole week, Junior and Senior Secondary together, so no one is booked past the week.
    const teacherInfo = new Map<string, { name: string; capacity: number; week: number; classes: Set<string> }>();
    for (const r of rows) {
        if (!r.teacher_id) continue;
        const t = teacherInfo.get(r.teacher_id) ?? { name: personName(r.teacher) ?? 'A teacher', capacity: 0, week: 0, classes: new Set<string>() };
        // The periods they can teach in their longest bell, less the times they are away.
        t.capacity = Math.max(t.capacity, availableLessons(config, sectionOf(r.grade_stream_id).periods, r.teacher_id));
        t.week = Math.max(t.week, capacityOf(r.grade_stream_id));
        t.classes.add(r.stream?.full_name ?? '');
        teacherInfo.set(r.teacher_id, t);
    }
    const teachers: TeacherWeek[] = [...teacherWeeks(plans.values()).entries()]
        .map(([id, lessons]) => {
            const t = teacherInfo.get(id);
            return {
                id, name: t?.name ?? 'A teacher', lessons, capacity: t?.capacity ?? 0, away: Math.max(0, (t?.week ?? 0) - (t?.capacity ?? 0)),
                classes: [...(t?.classes ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
            };
        })
        .sort((a, b) => b.lessons - a.lessons);

    const perDay = config.days.map(d => lessonsOn(config.periods, d));
    const base = {
        day: {
            days: config.days.length,
            lessonsPerDay: Math.max(0, ...perDay),
            fewestPerDay: perDay.length ? Math.min(...perDay) : 0,
            lessonsPerWeek: weeklyLessons(config.periods, config.days),
            starts: config.periods[0]?.start ?? null,
            ends: config.periods[config.periods.length - 1]?.end ?? null,
            sections: config.sections.length,
            breakMismatches: [...config.periods, ...config.sections.flatMap(s => s.periods)].filter(isMisnamedBreak).map(p => p.label),
        },
        rooms: input.rooms,
        loads: rows.length,
        classes,
        teachers,
        drafts: input.versions.length,
        published: input.versions.find(v => v.status === 'PUBLISHED')?.name ?? null,
    };
    return { ...base, ...assess(base) };
}
