/**
 * Whether a school can generate its timetable, and if not, exactly what to
 * fix, read in one go so the studio (web and app) can say so up front
 * instead of failing at the last step.
 */

import type { ClassFixes } from './fit';

export interface PlanLoad {
    id: string;
    subject: string;
    teacher: string | null;
    lessons: number;
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
    basis: 'choices' | 'groups' | 'subjects' | 'none';
    learnersWithChoices: number;
    /** With subject groups: learners who chose two subjects in one group, and which. */
    unfit: { name: string; subjects: [string, string] }[];
    /** Loads whose lessons a week differ from the Ministry's figure for the level. */
    offMinistry: { subject: string; lessons: number; ministry: number }[];
    /** For a class that does not fit: the two ready-made ways to make it fit. */
    fixes?: ClassFixes;
}

/** A teacher's whole week across every class and level they teach. */
export interface TeacherWeek {
    name: string;
    lessons: number;
    /** Periods in the week of the longest bell they teach on. */
    capacity: number;
    classes: string[];
}

export type StudioCard = 'day' | 'loads' | 'rooms' | 'drafts';

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
        days: number; lessonsPerDay: number; starts: string | null; ends: string | null; sections: number;
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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

/** Why a class does not fit its week, and the ways out, in plain words. */
export function overloadMessage(c: PlanClass): string {
    const over = c.needed - c.capacity;
    if ((c.basis === 'choices' || c.basis === 'groups') && c.blocks.length > 0) {
        return `${c.name} needs ${c.needed} lessons a week but its day has only ${c.capacity}. Its learners’ subject choices mix so much that their electives need ${plural(c.blocks.length, 'separate group')}, and no two of these groups can be taught at the same time. Give ${c.name} a longer day, or lower some lessons a week (${plural(over, 'lesson')} to find).`;
    }
    return `${c.name} needs ${c.needed} lessons a week but its day has only ${c.capacity}: ${plural(over, 'lesson')} too many. Give ${c.name} a longer day, or lower some lessons a week.`;
}

/** What a class's elective groups rest on, in a line. */
export function basisLine(c: PlanClass): string | null {
    if (c.blocks.length === 0) return null;
    if (c.basis === 'groups') {
        return `Electives run in ${plural(c.blocks.length, 'subject group')}: each learner takes one subject from each group, as KCSE subject groups are taught.${c.unfit.length > 0 ? ` ${plural(c.unfit.length, 'learner')} chose two subjects in one group and must change one.` : ' Every learner’s choices fit.'}`;
    }
    if (c.basis === 'choices') return `Option blocks follow ${plural(c.learnersWithChoices, 'learner')}’ recorded subject choices: no learner has two subjects at the same time.`;
    return 'No subject choices recorded for this class yet, so electives are grouped by subject type. Record learners’ electives for groups that match them.';
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
                message: `${c.name}: ${plural(c.unfit.length, 'learner')} chose two subjects that run in the same group. Change one of them in the learner’s subjects.`,
                details: c.unfit.map(u => `${u.name}: ${u.subjects.join(' and ')}`),
            });
        }
        if (c.unassigned > 0) notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${plural(c.unassigned, 'load')} without a teacher.` });
        if (c.offMinistry.length > 0) {
            notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${c.offMinistry.map(o => `${o.subject} ${o.lessons} (Ministry ${o.ministry})`).join(', ')}.` });
        }
    }
    const light: string[] = [];
    for (const t of plan.teachers) {
        if (t.lessons > t.capacity) {
            blockers.push({ card: 'loads', message: `${t.name} teaches ${t.lessons} lessons a week (${t.classes.join(', ')}) but the week has ${t.capacity} periods. Give some of these classes to another teacher.` });
        } else if (isLightLoad(t)) {
            light.push(`${t.name}: ${plural(t.lessons, 'lesson')} (${t.classes.join(', ') || 'no classes'})`);
        }
    }
    if (light.length > 0) {
        notes.push({ card: 'loads', message: `${plural(light.length, 'teacher')} with a light week (under ${LIGHT_LOAD} lessons). Give them more classes in Subjects → Teachers, then import loads again.`, details: light });
    }
    if (plan.rooms === 0) notes.push({ card: 'rooms', message: 'No labs or special rooms: every lesson runs in the class’s own room.' });
    return { blockers, notes };
}

/** "Mon–Fri · 8 lessons · 08:20–16:00". */
export function daySummary(day: TimetablePlan['day']): string {
    if (day.days === 0) return 'Not set yet';
    const span = day.starts && day.ends ? ` · ${day.starts}–${day.ends}` : '';
    const sections = day.sections > 0 ? ` · ${plural(day.sections, 'section')}` : '';
    return `${plural(day.days, 'day')} · ${plural(day.lessonsPerDay, 'lesson')} a day${span}${sections}`;
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
