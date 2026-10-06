import type { TimetableConfig, TimetableVersion } from './config';

/**
 * Making a timetable has an order: the day, the rooms, the teaching loads,
 * then generate and publish. The web and the app walk it as one guided flow
 * built from these steps, so neither sends a school back to an earlier tab.
 */

export type TimetableStepId = 'day' | 'rooms' | 'loads' | 'generate';

export interface TimetableStep {
    id: TimetableStepId;
    title: string;
    /** For the stepper under each dot. */
    short: string;
    why: string;
    optional?: boolean;
}

export const TIMETABLE_STEPS: readonly TimetableStep[] = [
    { id: 'day', title: 'Set the school day', short: 'Day', why: 'Which weekdays run, and each lesson period and break with its times.' },
    { id: 'rooms', title: 'Add special rooms', short: 'Rooms', why: 'Labs and workshops, so practicals get one. Skip this if every lesson runs in the class’s own room.', optional: true },
    { id: 'loads', title: 'Set teaching loads', short: 'Loads', why: 'Who teaches which subject to which class, and how many lessons a week.' },
    { id: 'generate', title: 'Generate and publish', short: 'Publish', why: 'Build a clash-free draft, move any lesson you want, then publish it to everyone.' },
];

/** What the school has done so far, read from the config, rooms, loads and drafts. */
export interface TimetableProgress {
    day: boolean;
    lessonsPerDay: number;
    rooms: number;
    loads: number;
    drafts: number;
    published: boolean;
}

export function timetableProgress(
    config: TimetableConfig | null,
    rooms: readonly unknown[],
    loads: readonly unknown[],
    versions: readonly Pick<TimetableVersion, 'status'>[],
): TimetableProgress {
    const lessonsPerDay = config?.periods.filter((p) => !p.is_break).length ?? 0;
    return {
        day: !!config && config.days.length > 0 && lessonsPerDay > 0,
        lessonsPerDay,
        rooms: rooms.length,
        loads: loads.length,
        drafts: versions.length,
        published: versions.some((v) => v.status === 'PUBLISHED'),
    };
}

export function isStepDone(id: TimetableStepId, p: TimetableProgress | null): boolean {
    if (!p) return false;
    switch (id) {
        case 'day': return p.day;
        case 'rooms': return p.rooms > 0;
        case 'loads': return p.loads > 0;
        case 'generate': return p.published;
    }
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line under the step's title: what is already there. */
export function stepStatus(id: TimetableStepId, p: TimetableProgress | null): string | null {
    if (!p) return null;
    switch (id) {
        case 'day': return p.day ? `${count(p.lessonsPerDay, 'lesson')} a day` : 'Not set yet';
        case 'rooms': return p.rooms > 0 ? count(p.rooms, 'room') : 'Optional';
        case 'loads': return p.loads > 0 ? count(p.loads, 'load') : 'None yet';
        case 'generate': return p.published ? 'Published' : p.drafts > 0 ? count(p.drafts, 'draft') : 'No draft yet';
    }
}

/** The first required step still to do, so the flow reopens where the school left off. */
export function firstOpenStep(p: TimetableProgress): number {
    const i = TIMETABLE_STEPS.findIndex((s) => !s.optional && !isStepDone(s.id, p));
    return i === -1 ? TIMETABLE_STEPS.length - 1 : i;
}
