/**
 * Whether a school can generate its timetable, and if not, exactly what to
 * fix, read in one go so the studio (web and app) can say so up front
 * instead of failing at the last step.
 */

import { missingLine, type MissingLesson } from './essentials';
import type { ClassFixes } from './fit';
import type { SubjectTime } from './config';

export interface PlanLoad {
    id: string;
    subjectId: string;
    subject: string;
    teacher: string | null;
    lessons: number;
    doubles: number;
    /** The Ministry's lessons a week for this subject at the class's level, when it sets one. */
    ministry: number | null;
    /** When the subject is best taught (the school's choice, else its usual). */
    time: SubjectTime;
    /** Whether `time` is the school's own choice rather than the subject's usual. */
    timeChosen: boolean;
}

export interface PlanBlock {
    number: number;
    label: string;
    lessons: number;
    manual: boolean;
    teacherClash: boolean;
    loads: PlanLoad[];
}

export interface PlanClass {
    streamId: string;
    name: string;
    capacity: number;
    needed: number;
    fits: boolean;
    core: PlanLoad[];
    blocks: PlanBlock[];
    /** Loads with nobody to teach them. */
    unassigned: number;
    /** What the option blocks rest on: learners' choices, or the subjects' types. */
    basis: 'choices' | 'none';
    learnersWithChoices: number;
    /** Whose choices the groups follow: learners' own, or the school's offered Grade 10 combinations. */
    choiceSource: 'learners' | 'combinations';
    /** With subject groups: learners who chose two subjects in one group, and which. */
    unfit: { name: string; subjects: [string, string] }[];
    /** Loads whose lessons a week differ from the Ministry's figure for the level. */
    offMinistry: { subject: string; lessons: number; ministry: number }[];
    /** The class's level, as schools say it ("Junior School"). */
    level: string | null;
    /** For a class that does not fit: the two ready-made ways to make it fit. */
    fixes?: ClassFixes;
    /** Non-examined lessons its level expects (PE, Life Skills, ICT, CSL) that are not on its timetable. */
    missing?: MissingLesson[];
}

/** A teacher's whole week across every class and level they teach. */
export interface TeacherWeek {
    id: string;
    name: string;
    lessons: number;
    /** Periods they can teach: the week of the longest bell they teach on, less the times they are away. */
    capacity: number;
    /** Periods lost to times they are away. */
    away: number;
    classes: string[];
}

export type StudioCard = 'day' | 'loads' | 'teachers' | 'rules' | 'rooms' | 'drafts';

/** A fix the studio can apply in one tap instead of sending the school to an editor. */
export type QuickFix = 'set-breaks';

export interface Blocker {
    card: StudioCard;
    /** The class the problem is in, so the studio can open it. */
    streamId?: string;
    message: string;
    /** One line per item when the message stands for several (teachers, periods). */
    details?: string[];
    fix?: QuickFix;
}

export interface TimetablePlan {
    day: {
        days: number;
        /** Lessons on the longest and shortest school day of the main bell (8 and 9 with a Friday-only lesson). */
        lessonsPerDay: number; fewestPerDay: number;
        /** Lessons in the main bell's week. */
        lessonsPerWeek: number;
        starts: string | null; ends: string | null; sections: number;
        /** Periods named like breaks (Tea break, Lunch) but set as lessons. */
        breakMismatches: string[];
    };
    rooms: number;
    loads: number;
    classes: PlanClass[];
    /** Every teacher with a load, busiest first. */
    teachers: TeacherWeek[];
    drafts: number;
    published: string | null;
    blockers: Blocker[];
    /** Worth knowing, but they do not stop generating. */
    notes: Blocker[];
}

/** "1 class", "4 classes", "2 lessons". */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : /(s|sh|ch|x|z)$/.test(word) ? 'es' : 's'}`;

/**
 * A teacher well under a normal load is worth a look. TSC expects about 27
 * lessons a week of a classroom teacher, so under 20 (or under half a short
 * week) is light; 24 or 27 is a full load, not a problem.
 */
export const LIGHT_LOAD = 20;
export const isLightLoad = (t: Pick<TeacherWeek, 'lessons' | 'capacity'>) => t.capacity > 0 && t.lessons < Math.min(LIGHT_LOAD, t.capacity / 2);

const quoteList = (xs: readonly string[]) => {
    const q = xs.map(x => `“${x}”`);
    return q.length <= 1 ? q.join('') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
};

/** "2 learners must change a subject" / "1 combination cannot be offered" — a class's unfit choices in a line. */
export const unfitTitle = (c: Pick<PlanClass, 'unfit' | 'choiceSource'>) =>
    c.choiceSource === 'combinations' ? `${plural(c.unfit.length, 'combination')} cannot be offered with these groups` : `${plural(c.unfit.length, 'learner')} must change a subject`;

/** Why a class does not fit its week, and the ways out, in plain words. */
export function overloadMessage(c: PlanClass): string {
    const over = c.needed - c.capacity;
    if (c.basis === 'choices' && c.blocks.length > 0) {
        return `${c.name} needs ${c.needed} lessons a week but its day has only ${c.capacity}. Its learners’ subject choices mix so much that their electives need ${plural(c.blocks.length, 'separate group')}, and no two of these groups can be taught at the same time. Give ${c.name} a longer day, or lower some lessons a week (${plural(over, 'lesson')} to find).`;
    }
    if (c.learnersWithChoices === 0 && c.core.length > 0) {
        return `${c.name} needs ${c.needed} lessons a week but its day has only ${c.capacity}: ${plural(over, 'lesson')} too many. No learner’s subject choices are recorded for it, so every subject is planned for the whole class: two subjects share a slot only when it is known that nobody takes both. Record each learner’s electives (People, or Subjects › Combinations for Senior School), accept option groups here, give ${c.name} a longer day, or lower some lessons a week.`;
    }
    return `${c.name} needs ${c.needed} lessons a week but its day has only ${c.capacity}: ${plural(over, 'lesson')} too many. Give ${c.name} a longer day, or lower some lessons a week.`;
}

/** What a class's elective groups rest on, in a line. */
export function basisLine(c: PlanClass): string | null {
    if (c.blocks.length === 0) return null;
    const whose = c.choiceSource === 'combinations' ? plural(c.learnersWithChoices, 'offered combination') : `${plural(c.learnersWithChoices, 'learner')}’ recorded choices`;
    if (c.basis === 'choices') return `Subjects share a slot only where nobody takes both, from ${whose}.`;
    return 'These groups were set for this class by the school: a learner takes one subject from each.';
}

/** Blockers and notes from the plan's facts. */
export function assess(plan: Omit<TimetablePlan, 'blockers' | 'notes'>): Pick<TimetablePlan, 'blockers' | 'notes'> {
    const blockers: Blocker[] = [];
    const notes: Blocker[] = [];
    if (plan.day.days === 0 || plan.day.lessonsPerDay === 0) blockers.push({ card: 'day', message: 'Set the school days and at least one lesson period.' });
    const misnamed = [...new Set(plan.day.breakMismatches)];
    if (misnamed.length > 0) {
        const one = misnamed.length === 1;
        blockers.push({
            card: 'day',
            fix: 'set-breaks',
            message: `${quoteList(misnamed)} ${one ? 'is' : 'are'} set as ${one ? 'a lesson' : 'lessons'}, so lessons would be put in ${one ? 'it' : 'them'}. Set ${one ? 'it' : 'them'} as ${one ? 'a break' : 'breaks'}.`,
        });
    }
    if (plan.loads === 0) blockers.push({ card: 'loads', message: 'Add teaching loads: who teaches which subject to which class, and how often.' });
    for (const c of plan.classes) {
        if (!c.fits) blockers.push({ card: 'loads', streamId: c.streamId, message: `${c.name} has ${plural(c.needed - c.capacity, 'more lesson')} than its week. Open it to pick a fix.` });
        for (const b of c.blocks) {
            if (b.teacherClash) blockers.push({ card: 'loads', streamId: c.streamId, message: `${c.name} ${b.label}: one teacher has two subjects running at the same time.` });
        }
        if (c.unfit.length > 0) {
            notes.push({
                card: 'loads', streamId: c.streamId,
                message: c.choiceSource === 'combinations'
                    ? `${c.name}: ${plural(c.unfit.length, 'offered combination')} put two subjects in the same group, so learners on ${c.unfit.length === 1 ? 'it' : 'them'} cannot take both. Stop offering ${c.unfit.length === 1 ? 'it' : 'them'}, or add a group rule.`
                    : `${c.name}: ${plural(c.unfit.length, 'learner')} chose two subjects that run in the same group. Change one of them in the learner’s subjects.`,
                details: c.unfit.map(u => `${u.name}: ${u.subjects.join(' and ')}`),
            });
        }
        if (c.missing?.length) notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name} has no ${missingLine(c.missing)} on its timetable. Open it to add ${c.missing.length === 1 ? 'it' : 'them'}.` });
        if (c.unassigned > 0) notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${plural(c.unassigned, 'load')} without a teacher.` });
        if (c.offMinistry.length > 0) {
            notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${c.offMinistry.map(o => `${o.subject} ${o.lessons} (Ministry ${o.ministry})`).join(', ')}.` });
        }
    }
    const light: string[] = [];
    for (const t of plan.teachers) {
        if (t.lessons > t.capacity) {
            blockers.push({
                card: 'teachers',
                message: t.away > 0
                    ? `${t.name} teaches ${t.lessons} lessons a week (${t.classes.join(', ')}) but can teach in only ${t.capacity} periods, with the times they are away. Give some of these classes to another teacher, or free some of their time.`
                    : `${t.name} teaches ${t.lessons} lessons a week (${t.classes.join(', ')}) but the week has ${t.capacity} periods. Give some of these classes to another teacher.`,
            });
        } else if (isLightLoad(t)) {
            light.push(`${t.name}: ${plural(t.lessons, 'lesson')} (${t.classes.join(', ') || 'no classes'})`);
        }
    }
    if (light.length > 0) {
        notes.push({ card: 'teachers', message: `${plural(light.length, 'teacher')} with a light week (under ${LIGHT_LOAD} lessons). Give them more classes in Subjects → Teachers, then import loads again.`, details: light });
    }
    if (plan.rooms === 0) notes.push({ card: 'rooms', message: 'No labs or special rooms: every lesson runs in the class’s own room.' });
    return { blockers, notes };
}

/** "5 days · 8–9 lessons a day (41 a week) · 08:20–16:00". */
export function daySummary(day: TimetablePlan['day']): string {
    if (day.days === 0) return 'Not set yet';
    const span = day.starts && day.ends ? ` · ${day.starts}–${day.ends}` : '';
    const sections = day.sections > 0 ? ` · ${plural(day.sections, 'section')}` : '';
    const perDay = day.fewestPerDay !== day.lessonsPerDay ? `${day.fewestPerDay}–${day.lessonsPerDay} lessons a day` : `${plural(day.lessonsPerDay, 'lesson')} a day`;
    return `${plural(day.days, 'day')} · ${perDay} (${day.lessonsPerWeek} a week)${span}${sections}`;
}

/** "14 classes · 3 with option blocks · 2 don’t fit". */
export function loadsSummary(plan: TimetablePlan): string {
    if (plan.loads === 0) return 'No loads yet';
    const blocked = plan.classes.filter(c => c.blocks.length > 0).length;
    const over = plan.classes.filter(c => !c.fits).length;
    return [plural(plan.classes.length, 'class'), blocked ? `${blocked} with option blocks` : '', over ? `${over} over the week` : 'all fit'].filter(Boolean).join(' · ');
}

/** The card the studio opens first: the first with a blocker, else drafts once loads exist. */
export function firstCard(plan: TimetablePlan): StudioCard {
    return plan.blockers[0]?.card ?? (plan.loads > 0 ? 'drafts' : 'loads');
}

/** A subject's time of day across every level that teaches it (each level has its own Mathematics). */
export interface SubjectTimeRow { key: string; name: string; ids: string[]; time: SubjectTime | null }

/** One row per subject name, with every level's subject id; `time` is null when the levels differ. */
export function subjectTimeRows(plan: Pick<TimetablePlan, 'classes'>): SubjectTimeRow[] {
    const rows = new Map<string, { name: string; ids: Set<string>; times: Set<SubjectTime> }>();
    for (const c of plan.classes) {
        for (const l of [...c.core, ...c.blocks.flatMap(b => b.loads)]) {
            const key = l.subject.trim().toLowerCase();
            const row = rows.get(key) ?? { name: l.subject.trim(), ids: new Set<string>(), times: new Set<SubjectTime>() };
            row.ids.add(l.subjectId);
            row.times.add(l.time);
            rows.set(key, row);
        }
    }
    return [...rows.entries()]
        .map(([key, row]) => ({ key, name: row.name, ids: [...row.ids], time: row.times.size === 1 ? [...row.times][0] : null }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
