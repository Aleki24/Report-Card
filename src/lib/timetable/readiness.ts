/**
 * Whether a school can generate its timetable, and if not, exactly what to
 * fix, read in one go so the studio (web and app) can say so up front
 * instead of failing at the last step.
 */

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
    basis: 'choices' | 'subjects' | 'none';
    learnersWithChoices: number;
    /** Loads whose lessons a week differ from the Ministry's figure for the level. */
    offMinistry: { subject: string; lessons: number; ministry: number }[];
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

export interface Blocker {
    card: StudioCard;
    /** The class the problem is in, so the studio can open it. */
    streamId?: string;
    message: string;
}

export interface TimetablePlan {
    day: { days: number; lessonsPerDay: number; starts: string | null; ends: string | null; sections: number };
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

/** Why a class does not fit its week, and the ways out. */
export function overloadMessage(c: PlanClass): string {
    const over = c.needed - c.capacity;
    const whole = c.core.reduce((n, l) => n + l.lessons, 0);
    const electives = c.needed - whole;
    if (c.basis === 'choices' && c.blocks.length > 0) {
        return `${c.name}: learners’ subject choices need ${plural(c.blocks.length, 'option block')} (${electives} periods) on top of ${whole} whole-class lessons — ${c.needed} in all, but the week has ${c.capacity}. Add ${plural(over, 'period')} to this class’s week (a section with a longer day), lower some lessons a week, or fix the option blocks learners choose from.`;
    }
    return `${c.name} needs ${c.needed} lessons a week but has ${c.capacity} periods: ${plural(over, 'lesson')} too many. Lower some lessons a week, move electives into option blocks, or add periods to this class’s day.`;
}

/** "Blocks follow 19 learners’ choices" — what a class's blocks rest on. */
export function basisLine(c: PlanClass): string | null {
    if (c.blocks.length === 0) return null;
    if (c.basis === 'choices') return `Option blocks follow ${plural(c.learnersWithChoices, 'learner')}’ recorded subject choices: no learner has two subjects at the same time.`;
    return 'No subject choices recorded for this class yet, so blocks are spread by subject type. Record learners’ electives for blocks that match them.';
}

/** Blockers and notes from the plan's facts. */
export function assess(plan: Omit<TimetablePlan, 'blockers' | 'notes'>): Pick<TimetablePlan, 'blockers' | 'notes'> {
    const blockers: Blocker[] = [];
    const notes: Blocker[] = [];
    if (plan.day.days === 0 || plan.day.lessonsPerDay === 0) blockers.push({ card: 'day', message: 'Set the school days and at least one lesson period.' });
    if (plan.loads === 0) blockers.push({ card: 'loads', message: 'Add teaching loads: who teaches which subject to which class, and how often.' });
    for (const c of plan.classes) {
        if (!c.fits) blockers.push({ card: 'loads', streamId: c.streamId, message: overloadMessage(c) });
        for (const b of c.blocks) {
            if (b.teacherClash) blockers.push({ card: 'loads', streamId: c.streamId, message: `${c.name} ${b.label}: one teacher has two subjects running at the same time.` });
        }
        if (c.unassigned > 0) notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${plural(c.unassigned, 'load')} without a teacher.` });
        if (c.offMinistry.length > 0) {
            notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${c.offMinistry.map(o => `${o.subject} ${o.lessons} (Ministry ${o.ministry})`).join(', ')}.` });
        }
    }
    for (const t of plan.teachers) {
        if (t.lessons > t.capacity) {
            blockers.push({ card: 'loads', message: `${t.name} teaches ${t.lessons} lessons a week (${t.classes.join(', ')}) but the week has ${t.capacity} periods. Give some of these classes to another teacher.` });
        }
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
