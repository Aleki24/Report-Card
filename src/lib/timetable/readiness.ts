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
    drafts: number;
    published: string | null;
    blockers: Blocker[];
    /** Worth knowing, but they do not stop generating. */
    notes: Blocker[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Blockers and notes from the plan's facts. */
export function assess(plan: Omit<TimetablePlan, 'blockers' | 'notes'>): Pick<TimetablePlan, 'blockers' | 'notes'> {
    const blockers: Blocker[] = [];
    const notes: Blocker[] = [];
    if (plan.day.days === 0 || plan.day.lessonsPerDay === 0) blockers.push({ card: 'day', message: 'Set the school days and at least one lesson period.' });
    if (plan.loads === 0) blockers.push({ card: 'loads', message: 'Add teaching loads: who teaches which subject to which class, and how often.' });
    for (const c of plan.classes) {
        if (!c.fits) {
            const over = c.needed - c.capacity;
            blockers.push({ card: 'loads', streamId: c.streamId, message: `${c.name} needs ${c.needed} lessons but has ${c.capacity} periods: ${plural(over, 'lesson')} too many.` });
        }
        for (const b of c.blocks) {
            if (b.teacherClash) blockers.push({ card: 'loads', streamId: c.streamId, message: `${c.name} ${b.label}: one teacher has two subjects running at the same time.` });
        }
        if (c.unassigned > 0) notes.push({ card: 'loads', streamId: c.streamId, message: `${c.name}: ${plural(c.unassigned, 'load')} without a teacher.` });
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
