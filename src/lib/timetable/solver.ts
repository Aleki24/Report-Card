/**
 * Timetable solver: places every weekly lesson so that no class, teacher or
 * room is in two places at once, then improves the result against the
 * school's preferences.
 *
 * Sections: parts of a school can keep different bells (30-minute lessons in
 * pre-primary, 40 in junior school). A class works in its section's periods;
 * teachers and rooms are shared across sections, so their clashes are found
 * by clock time, minute by minute, not by period number.
 *
 * Hard rules (never broken):
 *   - a class, a teacher and a room hold at most one lesson at any moment;
 *   - a lesson only goes in a period that runs that day (a Friday-only
 *     ninth lesson takes lessons on Friday alone);
 *   - a teacher is never timetabled at a time they cannot teach;
 *   - doubles sit in two back-to-back periods with no break between them;
 *   - lessons needing a room type (a lab) get a free room of that type,
 *     when the school has any rooms of that type;
 *   - pinned lessons stay where they are.
 *
 * Preferences (weighted cost, lower is better):
 *   - a subject spread evenly over the week: on as many days as its lessons
 *     allow, never twice in a day when another day is free (English's eight
 *     lessons over five days double up on three days; that is not a fault);
 *   - mathematics and sciences before lunch; PE and the arts not first thing;
 *   - a subject not in the same period every day, and its few lessons spread
 *     across the week rather than bunched on neighbouring days;
 *   - a class's free periods at the end of its day, not in the middle;
 *   - a learner's day that does not wear them out: a subject never in two
 *     separate lessons back to back (three periods of it in a row with a
 *     double), no more than `HEAVY_RUN` periods of mathematics and sciences
 *     on end without a break, and a class's doubles spread over its days
 *     rather than piled on one;
 *   - no more than `maxConsecutive` lessons in a row for a teacher, and a
 *     teacher's lessons spread evenly across the week.
 *
 * Method: most-constrained-first greedy placement with ejection, a repair
 * pass that makes room for anything left over (moving the lessons in the way
 * elsewhere), then simulated annealing (moves and swaps). With `fillFree`, a
 * last pass gives a class's periods still free an extra lesson of one of its
 * own subjects, under the same hard rules. `solveTimetable` runs several
 * seeds and keeps the best. Pure: no I/O, deterministic for a seed and a
 * time budget.
 */

import type { TimetableQuality } from './config';

export interface SolverPeriod {
    /** Position in the section's day, 0-based, breaks included. */
    index: number;
    isBreak: boolean;
    /** Clock time in minutes from midnight; omitted, periods are taken as back to back hours. */
    start?: number;
    end?: number;
    /** The weekdays the period runs; omitted, every day. */
    days?: readonly number[];
}

export interface SolverSection { id: string; periods: readonly SolverPeriod[] }

export interface SolverRequirement {
    id: string;
    streamId: string;
    subjectId: string;
    teacherId: string | null;
    /**
     * Teachers booked at the same times as `teacherId`: an option block runs
     * its electives in parallel, one teacher each, in a single class slot.
     */
    coTeacherIds?: readonly string[];
    lessons: number;
    doubles: number;
    roomType: string | null;
    /** Mathematics and sciences prefer the morning. */
    preferMorning: boolean;
    /** PE and the arts suit later in the day. */
    preferAfternoon?: boolean;
    /** The section whose bell the class follows; the first section when omitted. */
    sectionId?: string;
    /**
     * How much the class gains from an extra lesson of it in a free period
     * (`fillFree`): 0 or omitted never, higher first. Core subjects such as
     * mathematics and languages rank above the rest.
     */
    fillPriority?: number;
}

export interface SolverRoom { id: string; type: string }

/** A time a teacher cannot teach: on `day` (a weekday) from `start` to `end`, minutes from midnight. */
export interface TeacherUnavailable { teacherId: string; day: number; start: number; end: number }

/** Every teacher a requirement books: its own and, for an option block, the others in parallel. */
export const teachersOf = (r: Pick<SolverRequirement, 'teacherId' | 'coTeacherIds'>): string[] =>
    [...new Set([...(r.teacherId ? [r.teacherId] : []), ...(r.coTeacherIds ?? [])])];

export interface PinnedLesson { requirementId: string; day: number; period: number; roomId: string | null }

export interface SolverRules {
    maxConsecutive: number;
    /** Stop improving after this long. */
    timeBudgetMs: number;
    seed: number;
    /** Give classes' free periods extra lessons, where nobody clashes. */
    fillFree: boolean;
}

export interface SolverInput {
    days: readonly number[];
    /** The main day, used when no sections are given. */
    periods?: readonly SolverPeriod[];
    sections?: readonly SolverSection[];
    requirements: readonly SolverRequirement[];
    rooms: readonly SolverRoom[];
    pinned?: readonly PinnedLesson[];
    /** Times teachers cannot teach. */
    unavailable?: readonly TeacherUnavailable[];
    rules?: Partial<SolverRules>;
}

export interface PlacedLesson {
    requirementId: string;
    day: number;
    period: number;
    roomId: string | null;
    pinned: boolean;
    /** Beyond the requirement's lessons a week: it fills a period that was free. */
    extra: boolean;
}

export interface SolverResult {
    lessons: PlacedLesson[];
    unplaced: { requirementId: string; lessons: number }[];
    stats: {
        placed: number; required: number; cost: number; iterations: number; ms: number; attempts: number; quality: TimetableQuality;
        /** Free class periods given an extra lesson. */
        extras: number;
    };
}

const DEFAULT_RULES: SolverRules = { maxConsecutive: 4, timeBudgetMs: 2500, seed: 42, fillFree: false };

/**
 * Extra lessons one teacher takes on, so filling free periods never piles
 * work on the few who happen to be free. A week: three, or up to six for a
 * teacher whose own week is light, never past `FULL_WEEK` lessons in all. A
 * day: one, then two for the periods nobody could take at one.
 */
const EXTRA_PER_TEACHER_WEEK = { least: 3, most: 6 } as const;
const FULL_WEEK = 30;
const EXTRA_PER_TEACHER_DAY = [1, 2] as const;
const extraWeekCap = (load: number) => Math.max(EXTRA_PER_TEACHER_WEEK.least, Math.min(EXTRA_PER_TEACHER_WEEK.most, FULL_WEEK - load));

const COST = {
    /** A subject's lesson on a day beyond its fair share. */
    overDailyShare: 30,
    /** A day without a subject that has a lesson for every day. */
    missedDay: 14,
    morningMiss: 4,
    earlyCreative: 3,
    samePeriodRepeat: 3,
    bunchedDays: 8,
    /** A class's free period with a lesson still to come that day: idle learners in the middle of the day. */
    midDayGap: 8,
    /** A class's lessons a day, squared, so its free periods spread over the week. */
    classLoad: 1,
    consecutiveOver: 12,
    imbalance: 2,
    /** Two separate lessons of one subject back to back for a class. */
    backToBackSame: 12,
    /** Each period of mathematics or a science past `HEAVY_RUN` on end. */
    heavyRun: 6,
    /** A double on a class's day beyond its fair share of the week's doubles: one a day while the week allows. */
    crowdedDoubles: 30,
    /** A double straight after another double, with only a short break between: four periods of deep work on end. */
    doubleAfterDouble: 40,
    /** A class's doubles starting in the same period on different days, so every day has the same shape. */
    sameDoubleTime: 10,
} as const;

/** Periods of demanding subjects (mathematics, sciences) a class takes on end before it needs something else. */
const HEAVY_RUN = 3;

/** A gap longer than this between two lessons gives a teacher a rest. */
const REST_MINUTES = 5;

/** A teacher timeline minute the teacher cannot teach. */
const OFF = -2;

/** Mulberry32: small, fast, seedable. */
function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A section's teaching slots with their clock times, ready for placement. */
interface Bell {
    id: string;
    /** Period index of each teaching slot. */
    teaching: number[];
    start: number[];
    end: number[];
    canPair: boolean[];
    isMorning: boolean[];
    /** The first two lessons of the day. */
    isEarly: boolean[];
    /** Whether a slot runs on a day: `open[day * slots + slot]`, day an index into the school days. */
    open: Uint8Array;
    /** School days with at least one lesson slot. */
    teachingDays: number;
}

function bellOf(section: SolverSection, days: readonly number[]): Bell {
    const periods = [...section.periods].sort((a, b) => a.index - b.index);
    const timed = periods.every(p => p.start !== undefined && p.end !== undefined);
    const startOf = (p: SolverPeriod) => (timed ? p.start! : p.index * 60);
    const endOf = (p: SolverPeriod) => (timed ? p.end! : p.index * 60 + 59);
    const lessons = periods.filter(p => !p.isBreak);
    const breaks = periods.filter(p => p.isBreak);
    // "Morning" is before the day's last break (lunch), or its only break.
    const lastBreak = breaks.length > 0 ? Math.max(...breaks.map(b => b.index)) : Infinity;
    const n = lessons.length;
    const open = new Uint8Array(days.length * n);
    days.forEach((day, d) => lessons.forEach((p, i) => { open[d * n + i] = !p.days || p.days.includes(day) ? 1 : 0; }));
    let teachingDays = 0;
    for (let d = 0; d < days.length; d++) if (open.subarray(d * n, d * n + n).some(x => x === 1)) teachingDays++;
    return {
        id: section.id,
        teaching: lessons.map(p => p.index),
        start: lessons.map(startOf),
        end: lessons.map(endOf),
        canPair: lessons.map((p, i) => i + 1 < n && lessons[i + 1].index === p.index + 1),
        isMorning: lessons.map(p => p.index < lastBreak),
        isEarly: lessons.map((_, i) => i < 2),
        open,
        teachingDays,
    };
}

interface Session {
    key: number;
    req: SolverRequirement;
    bell: Bell;
    length: 1 | 2;
    pinned: boolean;
    /** Added by the fill pass, beyond the requirement's lessons. */
    extra: boolean;
    day: number;       // index into days, -1 when unplaced
    slot: number;      // index into the bell's teaching slots, -1 when unplaced
    roomId: string | null;
}

/** One run from one seed. */
function solveOnce(input: SolverInput, rules: SolverRules): SolverResult {
    const started = Date.now();
    const random = rng(rules.seed);
    const dayCount = input.days.length;

    const sections = input.sections && input.sections.length > 0
        ? input.sections
        : [{ id: 'main', periods: input.periods ?? [] }];
    const bells = new Map(sections.map(s => [s.id, bellOf(s, input.days)]));
    const firstBell = bells.get(sections[0].id)!;
    const bellFor = (req: SolverRequirement) => (req.sectionId && bells.get(req.sectionId)) || firstBell;

    // Clock span of the school day across every section, for minute timelines.
    const allBells = [...bells.values()].filter(b => b.start.length > 0);
    const dayStart = allBells.length > 0 ? Math.min(...allBells.flatMap(b => b.start)) : 0;
    const dayEnd = allBells.length > 0 ? Math.max(...allBells.flatMap(b => b.end)) : 1;
    const span = Math.max(1, dayEnd - dayStart);

    // Occupancy. Classes: per-slot grids in their own bell. Teachers and
    // rooms: per-minute timelines, shared by every section.
    const streamGrids = new Map<string, Int32Array>();
    const streamGrid = (s: Session) => {
        let g = streamGrids.get(s.req.streamId);
        if (!g) { g = new Int32Array(dayCount * s.bell.teaching.length).fill(-1); streamGrids.set(s.req.streamId, g); }
        return g;
    };
    const timelines = new Map<string, Int32Array>();
    const timeline = (owner: string) => {
        let g = timelines.get(owner);
        if (!g) { g = new Int32Array(dayCount * span).fill(-1); timelines.set(owner, g); }
        return g;
    };
    const teacherKey = (id: string) => `t:${id}`;
    const roomKey = (id: string) => `r:${id}`;
    /** Minute range [from, to) a session covers at a slot. */
    const minutes = (s: Session, slot: number): [number, number] => [s.bell.start[slot] - dayStart, s.bell.end[slot + s.length - 1] - dayStart];

    // Times teachers cannot teach, marked on their timelines for good.
    const dayIndex = new Map(input.days.map((d, i) => [d, i]));
    for (const off of input.unavailable ?? []) {
        const d = dayIndex.get(off.day);
        if (d === undefined) continue;
        const t = timeline(teacherKey(off.teacherId));
        for (let m = Math.max(0, off.start - dayStart); m < Math.min(span, off.end - dayStart); m++) t[d * span + m] = OFF;
    }

    const roomsByType = new Map<string, SolverRoom[]>();
    input.rooms.forEach(r => roomsByType.set(r.type, [...(roomsByType.get(r.type) ?? []), r]));

    // Build sessions: doubles first so they claim paired slots early.
    const sessions: Session[] = [];
    for (const req of input.requirements) {
        const bell = bellFor(req);
        const doubles = Math.max(0, Math.min(req.doubles, Math.floor(req.lessons / 2)));
        for (let i = 0; i < doubles; i++) sessions.push({ key: sessions.length, req, bell, length: 2, pinned: false, extra: false, day: -1, slot: -1, roomId: null });
        for (let i = 0; i < req.lessons - doubles * 2; i++) sessions.push({ key: sessions.length, req, bell, length: 1, pinned: false, extra: false, day: -1, slot: -1, roomId: null });
    }
    const byKey = sessions;

    const timelineOwners = (s: Session, roomId: string | null) => [
        ...teachersOf(s.req).map(teacherKey),
        ...(roomId ? [roomKey(roomId)] : []),
    ];
    const mark = (s: Session, value: number) => {
        const g = streamGrid(s);
        const n = s.bell.teaching.length;
        for (let k = 0; k < s.length; k++) g[s.day * n + s.slot + k] = value;
        const [from, to] = minutes(s, s.slot);
        for (const o of timelineOwners(s, s.roomId)) {
            const t = timeline(o);
            for (let m = from; m < to; m++) t[s.day * span + m] = value;
        }
    };
    const place = (s: Session, day: number, slot: number, roomId: string | null) => {
        s.day = day; s.slot = slot; s.roomId = roomId;
        mark(s, s.key);
    };
    const unplace = (s: Session) => {
        if (s.day < 0) return;
        mark(s, -1);
        s.day = -1; s.slot = -1; s.roomId = null;
    };

    /** Whether a session's shape fits a slot on a day: the periods run that day, and a double's two are back to back. */
    const shapeFits = (s: Session, day: number, slot: number) => {
        const n = s.bell.teaching.length;
        if (slot + s.length > n || (s.length === 2 && !s.bell.canPair[slot])) return false;
        for (let k = 0; k < s.length; k++) if (!s.bell.open[day * n + slot + k]) return false;
        return true;
    };

    /** Whether `owner` is busy for `s` at (day, slot); lessons in the way are added to `into`. Off times count as hard. */
    const busyIn = (owner: string, s: Session, day: number, slot: number, into: Set<number> | null): 'free' | 'busy' | 'off' => {
        const t = timelines.get(owner);
        if (!t) return 'free';
        const [from, to] = minutes(s, slot);
        let busy = false;
        for (let m = from; m < to; m++) {
            const hit = t[day * span + m];
            if (hit === OFF) return 'off';
            if (hit >= 0 && hit !== s.key) { busy = true; if (!into) return 'busy'; into.add(hit); }
        }
        return busy ? 'busy' : 'free';
    };

    /** Sessions blocking `s` at (day, slot), and a free room if one is needed. `hard` when nothing can be moved out of the way. */
    const conflictsAt = (s: Session, day: number, slot: number): { blockers: Set<number>; roomId: string | null; hard: boolean } => {
        const blockers = new Set<number>();
        const g = streamGrids.get(s.req.streamId);
        const n = s.bell.teaching.length;
        if (g) for (let k = 0; k < s.length; k++) { const hit = g[day * n + slot + k]; if (hit >= 0 && hit !== s.key) blockers.add(hit); }
        for (const t of teachersOf(s.req)) if (busyIn(teacherKey(t), s, day, slot, blockers) === 'off') return { blockers, roomId: null, hard: true };
        let roomId: string | null = null;
        let hard = false;
        const typed = s.req.roomType ? roomsByType.get(s.req.roomType) : undefined;
        if (typed && typed.length > 0) {
            roomId = typed.find(r => busyIn(roomKey(r.id), s, day, slot, null) === 'free')?.id ?? null;
            hard = roomId === null;
        }
        return { blockers, roomId, hard };
    };

    // ── Soft cost ────────────────────────────────────────────────────────
    const streamBell = new Map<string, Bell>();
    sessions.forEach(s => streamBell.set(s.req.streamId, s.bell));

    // Each class's lessons of a subject as sessions (a double counts once), and its fair share a day.
    const subjectKey = (streamId: string, subjectId: string) => `${streamId}|${subjectId}`;
    const sessionsOf = new Map<string, number>();
    sessions.forEach(s => { const k = subjectKey(s.req.streamId, s.req.subjectId); sessionsOf.set(k, (sessionsOf.get(k) ?? 0) + 1); });
    // The days a class's subject can be taught at all: the class has a lesson
    // slot then and its teacher is not away for the whole of it.
    const teachableDays = new Map<string, number>();
    for (const s of sessions) {
        const k = subjectKey(s.req.streamId, s.req.subjectId);
        if (teachableDays.has(k)) continue;
        const n = s.bell.teaching.length;
        let count = 0;
        for (let d = 0; d < dayCount; d++) {
            for (let t = 0; t < n; t++) {
                if (!s.bell.open[d * n + t]) continue;
                if (teachersOf(s.req).every(id => busyIn(teacherKey(id), { ...s, length: 1 }, d, t, null) !== 'off')) { count++; break; }
            }
        }
        teachableDays.set(k, count);
    }
    const daysFor = (streamId: string, subjectId: string, bell: Bell) => teachableDays.get(subjectKey(streamId, subjectId)) ?? bell.teachingDays;
    /** The most sessions of a subject one day should hold: its sessions spread over the days it can be taught. */
    const dailyShare = (streamId: string, subjectId: string, bell: Bell) =>
        Math.max(1, Math.ceil((sessionsOf.get(subjectKey(streamId, subjectId)) ?? 1) / Math.max(1, daysFor(streamId, subjectId, bell))));

    // Each class's doubles in the week, and so its fair share a day.
    const doublesOf = new Map<string, number>();
    sessions.forEach(s => { if (s.length === 2) doublesOf.set(s.req.streamId, (doublesOf.get(s.req.streamId) ?? 0) + 1); });
    const doublesShare = (streamId: string, bell: Bell) => Math.max(1, Math.ceil((doublesOf.get(streamId) ?? 0) / Math.max(1, bell.teachingDays)));

    /** A class's day: a subject past its fair share, subjects at the wrong time of day, free periods before lessons, and what wears learners out. */
    const streamDayCost = (streamId: string, day: number): number => {
        const g = streamGrids.get(streamId);
        const bell = streamBell.get(streamId);
        if (!g || !bell) return 0;
        const n = bell.teaching.length;
        const seen = new Map<string, number>();
        const strain = dayStrain(g, bell, day, byKey);
        let cost = strain.backToBack * COST.backToBackSame + strain.heavyOver * COST.heavyRun
            + Math.max(0, strain.doubles - doublesShare(streamId, bell)) * COST.crowdedDoubles
            + strain.doubleAfterDouble * COST.doubleAfterDouble;
        let last = -1;
        let freeSoFar = 0;
        for (let slot = 0; slot < n; slot++) {
            if (!bell.open[day * n + slot]) continue;
            const key = g[day * n + slot];
            if (key < 0) { freeSoFar++; last = key; continue; }
            if (freeSoFar > 0) { cost += freeSoFar * COST.midDayGap; freeSoFar = 0; }
            if (key === last) continue;
            last = key;
            const s = byKey[key];
            const count = (seen.get(s.req.subjectId) ?? 0) + 1;
            seen.set(s.req.subjectId, count);
            if (count > dailyShare(streamId, s.req.subjectId, bell)) cost += COST.overDailyShare;
            // A double after lunch costs both its periods.
            if (s.req.preferMorning && !bell.isMorning[slot]) cost += COST.morningMiss * s.length;
            if (s.req.preferAfternoon && bell.isEarly[slot]) cost += COST.earlyCreative;
        }
        let load = 0;
        for (let slot = 0; slot < n; slot++) if (g[day * n + slot] >= 0) load++;
        return cost + load * load * COST.classLoad;
    };

    /** A class's week: a subject in the same period day after day, bunched on neighbouring days, or missing a day it should have. */
    const streamWeekCost = (streamId: string): number => {
        const g = streamGrids.get(streamId);
        const bell = streamBell.get(streamId);
        if (!g || !bell) return 0;
        const n = bell.teaching.length;
        const slotsBySubject = new Map<string, number[]>();
        const daysBySubject = new Map<string, Set<number>>();
        const doubleStarts: number[] = [];
        for (let d = 0; d < dayCount; d++) {
            let last = -1;
            for (let slot = 0; slot < n; slot++) {
                const key = g[d * n + slot];
                if (key < 0 || key === last) { last = key; continue; }
                last = key;
                if (byKey[key].length === 2) doubleStarts.push(slot);
                const subject = byKey[key].req.subjectId;
                slotsBySubject.set(subject, [...(slotsBySubject.get(subject) ?? []), slot]);
                daysBySubject.set(subject, (daysBySubject.get(subject) ?? new Set()).add(d));
            }
        }
        let cost = 0;
        for (const slots of slotsBySubject.values()) {
            const counts = new Map<number, number>();
            slots.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
            counts.forEach(c => { if (c > 1) cost += (c - 1) * COST.samePeriodRepeat; });
        }
        cost += repeatedStarts(doubleStarts, bell) * COST.sameDoubleTime;
        for (const [subject, days] of daysBySubject) {
            cost += bunching(days, dayCount) * COST.bunchedDays;
            cost += Math.max(0, Math.min(sessionsOf.get(subjectKey(streamId, subject)) ?? 0, daysFor(streamId, subject, bell)) - days.size) * COST.missedDay;
        }
        return cost;
    };

    // Each teacher's lessons, so their day is read from a handful of sessions, not 600 minutes.
    const teacherSessions = new Map<string, Session[]>();
    sessions.forEach(s => teachersOf(s.req).forEach(t => teacherSessions.set(t, [...(teacherSessions.get(t) ?? []), s])));
    /** A teacher's lessons on a day in clock order, with how many run on past `maxConsecutive`. */
    const teacherDay = (teacherId: string, day: number): { load: number; over: number; longRuns: number } => {
        const today = (teacherSessions.get(teacherId) ?? []).filter(s => s.day === day).sort((a, b) => a.bell.start[a.slot] - b.bell.start[b.slot]);
        let run = 0; let lastEnd = -Infinity; let load = 0; let over = 0; let longRuns = 0;
        for (const s of today) {
            const from = s.bell.start[s.slot];
            run = from - lastEnd > REST_MINUTES ? s.length : run + s.length;
            load += s.length;
            if (run > rules.maxConsecutive) { over++; if (run - s.length <= rules.maxConsecutive) longRuns++; }
            lastEnd = s.bell.end[s.slot + s.length - 1];
        }
        return { load, over, longRuns };
    };
    /** A teacher's day: long runs without a rest, and load (squared, so days even out). */
    const teacherDayCost = (teacherId: string | null, day: number): number => {
        if (!teacherId) return 0;
        const { load, over } = teacherDay(teacherId, day);
        return over * COST.consecutiveOver + load * load * COST.imbalance / 8;
    };

    const localCost = (s: Session, day: number) => teachersOf(s.req).reduce((c, t) => c + teacherDayCost(t, day), streamDayCost(s.req.streamId, day) + streamWeekCost(s.req.streamId));

    const candidateOrder = (s: Session) => {
        const all: [number, number][] = [];
        for (let d = 0; d < dayCount; d++) for (let t = 0; t < s.bell.teaching.length; t++) all.push([d, t]);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        return all;
    };

    /** The cheapest free slot for `s` right now, if any. */
    const bestFreeSlot = (s: Session): { day: number; slot: number; roomId: string | null; cost: number } | null => {
        let best: { day: number; slot: number; roomId: string | null; cost: number } | null = null;
        for (const [d, t] of candidateOrder(s)) {
            if (!shapeFits(s, d, t)) continue;
            const { blockers, roomId, hard } = conflictsAt(s, d, t);
            if (blockers.size > 0 || hard) continue;
            const before = localCost(s, d);
            place(s, d, t, roomId);
            const cost = localCost(s, d) - before;
            unplace(s);
            if (!best || cost < best.cost) best = { day: d, slot: t, roomId, cost };
        }
        return best;
    };

    // ── Pinned lessons first ─────────────────────────────────────────────
    for (const pin of input.pinned ?? []) {
        const d = dayIndex.get(pin.day);
        if (d === undefined) continue;
        const candidates = sessions.filter(x => x.req.id === pin.requirementId && x.day < 0);
        const s = candidates.find(x => x.length === 1) ?? candidates[0];
        if (!s) continue;
        const t = s.bell.teaching.indexOf(pin.period);
        if (t < 0 || !shapeFits(s, d, t)) continue;
        const { blockers, hard } = conflictsAt(s, d, t);
        if (blockers.size > 0 || hard) continue;
        s.pinned = true;
        place(s, d, t, pin.roomId);
    }

    // ── Greedy construction with ejection ────────────────────────────────
    const teacherLoad = new Map<string, number>();
    input.requirements.forEach(r => teachersOf(r).forEach(t => teacherLoad.set(t, (teacherLoad.get(t) ?? 0) + r.lessons)));
    // A block books several teachers at once, so it is harder to place than any one of them.
    const difficulty = (s: Session) => (s.length === 2 ? 1000 : 0) + (s.req.roomType ? 500 : 0) + teachersOf(s.req).reduce((n, t) => n + (teacherLoad.get(t) ?? 0), 0) + random();
    const queue = sessions.filter(s => s.day < 0).sort((a, b) => difficulty(b) - difficulty(a));
    const ejections = new Map<number, number>();
    const maxEjections = sessions.length * 6;
    let ejected = 0;

    while (queue.length > 0) {
        const s = queue.shift()!;
        const best = bestFreeSlot(s);
        if (best) { place(s, best.day, best.slot, best.roomId); continue; }
        let fallback: { day: number; slot: number; roomId: string | null; victim: Session } | null = null;
        for (const [d, t] of candidateOrder(s)) {
            if (!shapeFits(s, d, t)) continue;
            const { blockers, roomId, hard } = conflictsAt(s, d, t);
            if (hard || blockers.size !== 1) continue;
            const victim = byKey[[...blockers][0]];
            if (!victim.pinned && (ejections.get(victim.key) ?? 0) < 3) { fallback = { day: d, slot: t, roomId, victim }; break; }
        }
        if (fallback && ejected < maxEjections) {
            ejected++;
            ejections.set(fallback.victim.key, (ejections.get(fallback.victim.key) ?? 0) + 1);
            unplace(fallback.victim);
            place(s, fallback.day, fallback.slot, fallback.roomId);
            queue.push(fallback.victim);
        }
        // Otherwise the session stays unplaced; the repair pass tries again.
    }

    // ── Repair: make room for what is left ───────────────────────────────
    // For a lesson still out, clear a slot of the (at most three) lessons in
    // its way and find each of them another free slot. Kept only when every
    // displaced lesson lands; otherwise everything goes back as it was.
    const repairDeadline = started + rules.timeBudgetMs * 0.4;
    const tryRepair = (u: Session): boolean => {
        const options: { day: number; slot: number; roomId: string | null; victims: Session[] }[] = [];
        for (const [d, t] of candidateOrder(u)) {
            if (!shapeFits(u, d, t)) continue;
            const { blockers, roomId, hard } = conflictsAt(u, d, t);
            if (hard || blockers.size === 0 || blockers.size > 3) continue;
            const victims = [...blockers].map(k => byKey[k]);
            if (victims.some(v => v.pinned)) continue;
            options.push({ day: d, slot: t, roomId, victims });
        }
        options.sort((a, b) => a.victims.length - b.victims.length);
        for (const o of options.slice(0, 40)) {
            const from = o.victims.map(v => ({ v, day: v.day, slot: v.slot, roomId: v.roomId }));
            o.victims.forEach(unplace);
            place(u, o.day, o.slot, o.roomId);
            const moved: Session[] = [];
            let ok = true;
            for (const v of o.victims) {
                const spot = bestFreeSlot(v);
                if (!spot) { ok = false; break; }
                place(v, spot.day, spot.slot, spot.roomId);
                moved.push(v);
            }
            if (ok) return true;
            moved.forEach(unplace);
            unplace(u);
            from.forEach(f => place(f.v, f.day, f.slot, f.roomId));
        }
        return false;
    };
    let repairing = true;
    while (repairing && Date.now() < repairDeadline) {
        repairing = false;
        for (const u of sessions) {
            if (u.day >= 0) continue;
            if (Date.now() >= repairDeadline) break;
            const spot = bestFreeSlot(u);
            if (spot) { place(u, spot.day, spot.slot, spot.roomId); repairing = true; continue; }
            if (tryRepair(u)) repairing = true;
        }
    }

    // ── Improvement: simulated annealing ─────────────────────────────────
    // A move takes a lesson to another slot of its class: an empty one, or
    // one held by another lesson of the same length, which swaps with it. A
    // double also trades places with the single lessons in its way, so where
    // a class's doubles fall is never fixed by the first layout.
    // The temperature falls with the time left, warms up again when nothing
    // has improved for a while, and the best week seen is the one kept.
    const movable = sessions.filter(s => s.day >= 0 && !s.pinned);
    let iterations = 0;
    const annealStart = Date.now();
    const deadline = started + rules.timeBudgetMs;
    const affectedCost = (touched: readonly Session[], days: readonly number[]) => {
        let total = 0;
        const streams = new Set(touched.map(x => x.req.streamId));
        const teachers = new Set(touched.flatMap(x => teachersOf(x.req)));
        for (const d of new Set(days)) {
            streams.forEach(id => { total += streamDayCost(id, d); });
            teachers.forEach(id => { total += teacherDayCost(id, d); });
        }
        streams.forEach(id => { total += streamWeekCost(id); });
        return total;
    };
    const streamIds = new Set(input.requirements.map(r => r.streamId));
    const teacherIds = new Set(input.requirements.flatMap(teachersOf));
    const totalCost = () => {
        let total = 0;
        streamIds.forEach(id => { total += streamWeekCost(id); });
        for (let d = 0; d < dayCount; d++) {
            streamIds.forEach(id => { total += streamDayCost(id, d); });
            teacherIds.forEach(id => { total += teacherDayCost(id, d); });
        }
        return total;
    };
    let current = totalCost();
    let bestCost = current;
    let bestState = movable.map(x => [x.day, x.slot] as const);
    const bestRooms = movable.map(x => x.roomId);
    let sinceBest = 0;
    const HOT = 10;
    const COLD = 0.15;
    let heat = HOT;
    while (movable.length > 0 && iterations < 3_000_000) {
        iterations++;
        if ((iterations & 255) === 0) {
            const now = Date.now();
            if (now >= deadline) break;
            // Cool with the time left; after a long spell without a new best, warm up from there.
            if (sinceBest > 40_000) { heat = Math.max(COLD * 4, heat * 0.5); sinceBest = 0; }
        }
        const progress = Math.min(1, (Date.now() - annealStart) / Math.max(1, deadline - annealStart));
        const temperature = heat * Math.pow(COLD / HOT, progress);
        const a = movable[Math.floor(random() * movable.length)];
        const d = Math.floor(random() * dayCount);
        const t = Math.floor(random() * a.bell.teaching.length);
        if ((d === a.day && t === a.slot) || !shapeFits(a, d, t)) continue;
        const g = streamGrids.get(a.req.streamId)!;
        const n = a.bell.teaching.length;
        // Whatever the class has in the target cells: nothing, one lesson of the same length, or (for a double) single lessons.
        const occupants: { s: Session; offset: number }[] = [];
        for (let k = 0; k < a.length; k++) { const hit = g[d * n + t + k]; if (hit >= 0 && hit !== a.key && !occupants.some(o => o.s.key === hit)) occupants.push({ s: byKey[hit], offset: k }); }
        const swapsSame = occupants.length === 1 && occupants[0].s.length === a.length;
        if (!swapsSame && occupants.length > 0) {
            // Singles out of a double's way, onto the double's old cells; never onto cells the double is taking.
            const overlaps = d === a.day && Math.abs(t - a.slot) < a.length;
            if (a.length !== 2 || overlaps || occupants.some(o => o.s.length !== 1)) continue;
        }
        const others = occupants.map(o => ({ s: o.s, to: { day: a.day, slot: a.slot + o.offset }, from: { day: o.s.day, slot: o.s.slot, roomId: o.s.roomId } }));
        if (swapsSame && occupants[0].s.slot !== t) continue;
        if (others.some(o => o.s.pinned || !shapeFits(o.s, o.to.day, o.to.slot))) continue;

        const fromA = { day: a.day, slot: a.slot, roomId: a.roomId };
        const touched = [a, ...others.map(o => o.s)];
        const days = [fromA.day, d];
        const before = affectedCost(touched, days);

        unplace(a);
        others.forEach(o => unplace(o.s));
        const fitA = conflictsAt(a, d, t);
        let ok = fitA.blockers.size === 0 && !fitA.hard;
        if (ok) place(a, d, t, fitA.roomId);
        for (const o of others) {
            if (!ok) break;
            const fit = conflictsAt(o.s, o.to.day, o.to.slot);
            ok = fit.blockers.size === 0 && !fit.hard;
            if (ok) place(o.s, o.to.day, o.to.slot, fit.roomId);
        }
        let delta = 0;
        const accept = ok && (() => {
            delta = affectedCost(touched, days) - before;
            return delta <= 0 || random() < Math.exp(-delta / temperature);
        })();
        if (!accept) {
            touched.forEach(unplace);
            place(a, fromA.day, fromA.slot, fromA.roomId);
            others.forEach(o => place(o.s, o.from.day, o.from.slot, o.from.roomId));
            sinceBest++;
            continue;
        }
        current += delta;
        if (current < bestCost - 1e-9) {
            bestCost = current;
            bestState = movable.map(x => [x.day, x.slot] as const);
            movable.forEach((x, i) => { bestRooms[i] = x.roomId; });
            sinceBest = 0;
        } else sinceBest++;
    }
    // Back to the best week seen, if the search wandered off it.
    if (current > bestCost + 1e-9) {
        movable.forEach(unplace);
        movable.forEach((x, i) => { const [day, slot] = bestState[i]; if (day >= 0) place(x, day, slot, bestRooms[i]); });
    }

    // The seeds are compared on the required lessons alone, before any extras.
    const cost = totalCost();

    // ── Fill: extra lessons in the periods still free ────────────────────
    // Each free period of a class, gaps inside its day first, takes one more
    // lesson of one of its own subjects: never one whose teacher is busy,
    // away or already given their extras, nor one needing a room when none is
    // free, nor one that runs a teacher past their longest stretch. Subjects
    // the class has not had that day come first, then the most deserving
    // (mathematics, languages, sciences), then the teacher with the lighter
    // day. A period nobody can take is offered one of the class's own lessons
    // from elsewhere in the week, and the period that frees is filled instead.
    const fillFreePeriods = (): number => {
        const candidates = new Map<string, SolverRequirement[]>();
        for (const r of input.requirements) {
            if ((r.fillPriority ?? 0) <= 0 || teachersOf(r).length === 0) continue;
            candidates.set(r.streamId, [...(candidates.get(r.streamId) ?? []), r]);
        }
        const free: { streamId: string; bell: Bell; day: number; slot: number; inside: boolean; tie: number }[] = [];
        for (const [streamId, g] of streamGrids) {
            const bell = streamBell.get(streamId);
            if (!bell || !candidates.has(streamId)) continue;
            const n = bell.teaching.length;
            for (let d = 0; d < dayCount; d++) {
                let lastTaught = -1;
                for (let t = 0; t < n; t++) if (bell.open[d * n + t] && g[d * n + t] >= 0) lastTaught = t;
                for (let t = 0; t < n; t++) {
                    if (bell.open[d * n + t] && g[d * n + t] < 0) free.push({ streamId, bell, day: d, slot: t, inside: t < lastTaught, tie: random() });
                }
            }
        }
        free.sort((a, b) => Number(b.inside) - Number(a.inside) || a.tie - b.tie);

        const perRequirement = new Map<string, number>();
        const perTeacher = new Map<string, number>();
        const perTeacherDay = new Map<string, number>();
        let dayCap: number = EXTRA_PER_TEACHER_DAY[0];
        const atLimit = (teacherId: string, day: number) =>
            (perTeacher.get(teacherId) ?? 0) >= extraWeekCap(teacherLoad.get(teacherId) ?? 0) || (perTeacherDay.get(`${teacherId}|${day}`) ?? 0) >= dayCap;
        const track = (x: Session) => {
            sessions.push(x);
            teachersOf(x.req).forEach(t => teacherSessions.set(t, [...(teacherSessions.get(t) ?? []), x]));
        };
        const untrack = (x: Session) => {
            teachersOf(x.req).forEach(t => teacherSessions.set(t, (teacherSessions.get(t) ?? []).filter(y => y !== x)));
            sessions.pop();
        };
        const overOf = (teachers: readonly string[], day: number) => teachers.reduce((sum, t) => sum + teacherDay(t, day).over, 0);
        /** A class's lessons of each subject on a day, a double counted once. */
        const subjectsOn = (streamId: string, bell: Bell, day: number) => {
            const g = streamGrids.get(streamId)!;
            const n = bell.teaching.length;
            const today = new Map<string, number>();
            let last = -1;
            for (let t = 0; t < n; t++) {
                const key = g[day * n + t];
                if (key >= 0 && key !== last) today.set(byKey[key].req.subjectId, (today.get(byKey[key].req.subjectId) ?? 0) + 1);
                last = key;
            }
            return today;
        };

        /** Places the best extra lesson a class can take at a free period, if any. */
        const fillAt = (streamId: string, bell: Bell, day: number, slot: number): boolean => {
            const today = subjectsOn(streamId, bell, day);
            let best: { req: SolverRequirement; roomId: string | null; score: number } | null = null;
            for (const req of candidates.get(streamId) ?? []) {
                const teachers = teachersOf(req);
                if (teachers.some(t => atLimit(t, day))) continue;
                const x: Session = { key: sessions.length, req, bell, length: 1, pinned: false, extra: true, day: -1, slot: -1, roomId: null };
                if (!shapeFits(x, day, slot)) continue;
                const { blockers, roomId, hard } = conflictsAt(x, day, slot);
                if (blockers.size > 0 || hard) continue;
                const overBefore = overOf(teachers, day);
                track(x);
                place(x, day, slot, roomId);
                const overAfter = overOf(teachers, day);
                const load = teachers.reduce((sum, t) => sum + teacherDay(t, day).load, 0) / teachers.length;
                unplace(x);
                untrack(x);
                if (overAfter > overBefore) continue;
                const score = (today.get(req.subjectId) ?? 0) * 12
                    + (perRequirement.get(req.id) ?? 0) * 6
                    + (req.preferMorning && !bell.isMorning[slot] ? 2 : 0)
                    + (req.preferAfternoon && bell.isEarly[slot] ? 2 : 0)
                    + load
                    - (req.fillPriority ?? 0) * 4;
                if (!best || score < best.score) best = { req, roomId, score };
            }
            if (!best) return false;
            const x: Session = { key: sessions.length, req: best.req, bell, length: 1, pinned: false, extra: true, day: -1, slot: -1, roomId: null };
            track(x);
            place(x, day, slot, best.roomId);
            perRequirement.set(best.req.id, (perRequirement.get(best.req.id) ?? 0) + 1);
            for (const t of teachersOf(best.req)) {
                perTeacher.set(t, (perTeacher.get(t) ?? 0) + 1);
                perTeacherDay.set(`${t}|${day}`, (perTeacherDay.get(`${t}|${day}`) ?? 0) + 1);
            }
            return true;
        };

        /**
         * For a period nobody can take: one of the class's own single lessons
         * moves into it, where its teacher is free, it stays within its
         * subject's share of that day and nobody runs too long; the period it
         * leaves is then filled. Undone when that fails.
         */
        const fillByMoving = (streamId: string, bell: Bell, day: number, slot: number): boolean => {
            const own = sessions.filter(x => x.req.streamId === streamId && x.day >= 0 && !x.pinned && !x.extra && x.length === 1);
            for (let i = own.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [own[i], own[j]] = [own[j], own[i]]; }
            for (const x of own) {
                const from = { day: x.day, slot: x.slot, roomId: x.roomId };
                if (from.day !== day && (subjectsOn(streamId, bell, day).get(x.req.subjectId) ?? 0) + 1 > dailyShare(streamId, x.req.subjectId, bell)) continue;
                const teachers = teachersOf(x.req);
                const overBefore = overOf(teachers, day) + (from.day !== day ? overOf(teachers, from.day) : 0);
                unplace(x);
                const fit = shapeFits(x, day, slot) ? conflictsAt(x, day, slot) : null;
                if (fit && fit.blockers.size === 0 && !fit.hard) {
                    place(x, day, slot, fit.roomId);
                    const overAfter = overOf(teachers, day) + (from.day !== day ? overOf(teachers, from.day) : 0);
                    if (overAfter <= overBefore && fillAt(streamId, bell, from.day, from.slot)) return true;
                    unplace(x);
                }
                place(x, from.day, from.slot, from.roomId);
            }
            return false;
        };

        let added = 0;
        const stillFree = (f: (typeof free)[number]) => streamGrids.get(f.streamId)![f.day * f.bell.teaching.length + f.slot] < 0;
        for (const cap of EXTRA_PER_TEACHER_DAY) {
            dayCap = cap;
            for (const f of free) if (stillFree(f) && fillAt(f.streamId, f.bell, f.day, f.slot)) added++;
        }
        for (const f of free) if (stillFree(f) && fillByMoving(f.streamId, f.bell, f.day, f.slot)) added++;
        return added;
    };
    const extras = rules.fillFree ? fillFreePeriods() : 0;

    // ── Result ───────────────────────────────────────────────────────────
    const lessons: PlacedLesson[] = [];
    const missing = new Map<string, number>();
    for (const s of sessions) {
        if (s.day < 0) { missing.set(s.req.id, (missing.get(s.req.id) ?? 0) + s.length); continue; }
        for (let k = 0; k < s.length; k++) {
            lessons.push({ requirementId: s.req.id, day: input.days[s.day], period: s.bell.teaching[s.slot + k], roomId: s.roomId, pinned: s.pinned, extra: s.extra });
        }
    }
    const required = input.requirements.reduce((n, r) => n + r.lessons, 0);
    return {
        lessons,
        unplaced: [...missing.entries()].map(([requirementId, n]) => ({ requirementId, lessons: n })),
        stats: {
            placed: lessons.length - extras, required, cost: Math.round(cost), iterations, ms: Date.now() - started, attempts: 1, extras,
            quality: measureQuality({
                sessions, dayCount, streamGrids, streamBell, teacherIds, totalLessons: required,
                teacherLongRuns: (id, d) => teacherDay(id, d).longRuns,
                dailyShare: (streamId, subjectId) => dailyShare(streamId, subjectId, streamBell.get(streamId)!),
                sessionsOf: (streamId, subjectId) => sessionsOf.get(subjectKey(streamId, subjectId)) ?? 0,
                daysFor: (streamId, subjectId) => daysFor(streamId, subjectId, streamBell.get(streamId)!),
                doublesShare: streamId => doublesShare(streamId, streamBell.get(streamId)!),
            }),
        },
    };
}

interface DayStrain {
    backToBack: number;
    heavyOver: number;
    doubles: number;
    /** Doubles that follow another double with only a short break between (lunch or a free period parts them). */
    doubleAfterDouble: number;
}

/**
 * What wears a class out on one day: separate lessons of one subject back to
 * back, periods of heavy subjects past `HEAVY_RUN` on end (a break or a free
 * period ends a run), its doubles, and a double straight after another.
 */
function dayStrain(g: Int32Array, bell: Bell, day: number, byKey: readonly Session[]): DayStrain {
    const n = bell.teaching.length;
    let backToBack = 0; let heavyOver = 0; let doubles = 0; let doubleAfterDouble = 0;
    let prev = -1; let prevSlot = -1; let run = 0;
    for (let slot = 0; slot < n; slot++) {
        const key = bell.open[day * n + slot] ? g[day * n + slot] : -1;
        if (key < 0) { prev = -1; run = 0; continue; }
        const s = byKey[key];
        const joined = prev >= 0 && bell.start[slot] - bell.end[prevSlot] <= REST_MINUTES;
        if (!joined) run = 0;
        if (key !== prev) {
            if (s.length === 2) doubles++;
            if (joined && byKey[prev].req.subjectId === s.req.subjectId) backToBack++;
            // A short break is not a rest from deep work; only lunch parts two doubles.
            if (s.length === 2 && prev >= 0 && byKey[prev].length === 2 && bell.isMorning[slot] === bell.isMorning[prevSlot]) doubleAfterDouble++;
        }
        if (s.req.preferMorning) { if (++run > HEAVY_RUN) heavyOver++; } else run = 0;
        prev = key;
        prevSlot = slot;
    }
    return { backToBack, heavyOver, doubles, doubleAfterDouble };
}

/**
 * Doubles starting in a period already used by another of the week's doubles,
 * beyond what the day's possible start periods force: five doubles over four
 * start periods must share one, not all start first thing.
 */
function repeatedStarts(starts: readonly number[], bell: Bell): number {
    if (starts.length < 2) return 0;
    const counts = new Map<number, number>();
    starts.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
    const fair = Math.ceil(starts.length / Math.max(1, bell.canPair.filter(Boolean).length));
    let excess = 0;
    counts.forEach(c => { if (c > fair) excess += c - fair; });
    return excess;
}

/**
 * How bunched a subject's week is: a two-lesson subject on neighbouring days,
 * or three or more days in a row (Mon, Tue, Wed) for a subject on fewer days
 * than that leaves room for. A subject on all but one day has nothing to
 * spread: four lessons over five days always sit together somewhere.
 */
function bunching(days: ReadonlySet<number>, dayCount: number): number {
    const k = days.size;
    if (k <= 1 || k >= dayCount - 1) return 0;
    const sorted = [...days].sort((a, b) => a - b);
    let excess = 0;
    let run = 1;
    for (let i = 1; i <= sorted.length; i++) {
        if (i < sorted.length && sorted[i] - sorted[i - 1] === 1) { run++; continue; }
        if (k === 2 && run === 2) excess += 1;
        else if (run >= 3) excess += run - 2;
        run = 1;
    }
    return excess;
}

/** The preferences a draft breaks that it could have kept, counted the way a timetabler would. */
function measureQuality(q: {
    sessions: readonly Session[];
    dayCount: number;
    streamGrids: ReadonlyMap<string, Int32Array>;
    streamBell: ReadonlyMap<string, Bell>;
    teacherIds: ReadonlySet<string>;
    totalLessons: number;
    teacherLongRuns: (teacherId: string, day: number) => number;
    dailyShare: (streamId: string, subjectId: string) => number;
    sessionsOf: (streamId: string, subjectId: string) => number;
    daysFor: (streamId: string, subjectId: string) => number;
    doublesShare: (streamId: string) => number;
}): TimetableQuality {
    let repeatsInDay = 0; let missedDays = 0; let lateCoreLessons = 0; let earlyCreativeLessons = 0;
    let samePeriodHabits = 0; let bunchedWeeks = 0; let longTeacherRuns = 0; let midDayGaps = 0;
    let backToBackSame = 0; let heavyRuns = 0; let doubleAfterDouble = 0; let crowdedDoubleDays = 0; let sameDoubleTimes = 0;
    for (const [streamId, g] of q.streamGrids) {
        const bell = q.streamBell.get(streamId)!;
        const n = bell.teaching.length;
        const doubleStarts: number[] = [];
        for (let d = 0; d < q.dayCount; d++) {
            const strain = dayStrain(g, bell, d, q.sessions);
            backToBackSame += strain.backToBack;
            doubleAfterDouble += strain.doubleAfterDouble;
            if (strain.heavyOver > 0) heavyRuns++;
            if (strain.doubles > q.doublesShare(streamId)) crowdedDoubleDays++;
        }
        const slotsBySubject = new Map<string, number[]>();
        const daysBySubject = new Map<string, Set<number>>();
        for (let d = 0; d < q.dayCount; d++) {
            const seen = new Map<string, number>();
            let last = -1;
            let freeSoFar = 0;
            for (let slot = 0; slot < n; slot++) {
                if (!bell.open[d * n + slot]) continue;
                const key = g[d * n + slot];
                if (key < 0) { freeSoFar++; last = key; continue; }
                midDayGaps += freeSoFar;
                freeSoFar = 0;
                if (key === last) continue;
                last = key;
                const s = q.sessions[key];
                // An extra lesson fills a gap; it is not how the subject's own lessons are spread.
                if (s.extra) continue;
                if (s.length === 2) doubleStarts.push(slot);
                const count = (seen.get(s.req.subjectId) ?? 0) + 1;
                seen.set(s.req.subjectId, count);
                if (count > q.dailyShare(streamId, s.req.subjectId)) repeatsInDay++;
                if (s.req.preferMorning && !bell.isMorning[slot]) lateCoreLessons++;
                if (s.req.preferAfternoon && bell.isEarly[slot]) earlyCreativeLessons++;
                slotsBySubject.set(s.req.subjectId, [...(slotsBySubject.get(s.req.subjectId) ?? []), slot]);
                daysBySubject.set(s.req.subjectId, (daysBySubject.get(s.req.subjectId) ?? new Set()).add(d));
            }
        }
        sameDoubleTimes += repeatedStarts(doubleStarts, bell);
        for (const slots of slotsBySubject.values()) {
            if (slots.length < 3) continue;
            const counts = new Map<number, number>();
            slots.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
            if (Math.max(...counts.values()) >= 3) samePeriodHabits++;
        }
        for (const [subject, days] of daysBySubject) {
            if (bunching(days, q.dayCount) > 0) bunchedWeeks++;
            if (Math.min(q.sessionsOf(streamId, subject), q.daysFor(streamId, subject)) > days.size) missedDays++;
        }
    }
    for (const id of q.teacherIds) for (let d = 0; d < q.dayCount; d++) longTeacherRuns += q.teacherLongRuns(id, d);
    const points = repeatsInDay * 4 + missedDays * 3 + lateCoreLessons + earlyCreativeLessons + samePeriodHabits * 2 + bunchedWeeks * 2 + longTeacherRuns * 3 + midDayGaps
        + backToBackSame * 3 + heavyRuns * 2 + doubleAfterDouble * 4 + crowdedDoubleDays * 3 + sameDoubleTimes;
    const score = q.totalLessons === 0 ? 100 : Math.max(0, Math.round(100 - (points / q.totalLessons) * 100));
    return { score, repeatsInDay, missedDays, lateCoreLessons, earlyCreativeLessons, samePeriodHabits, bunchedWeeks, longTeacherRuns, midDayGaps, backToBackSame, heavyRuns, doubleAfterDouble, crowdedDoubleDays, sameDoubleTimes };
}

/** Fewest lessons left out first, then the lowest cost. */
const better = (a: SolverResult, b: SolverResult) => {
    const ua = a.stats.required - a.stats.placed;
    const ub = b.stats.required - b.stats.placed;
    return ua !== ub ? ua < ub : a.stats.cost < b.stats.cost;
};

/**
 * Several runs from different seeds, the best kept: each start shuffles the
 * subjects differently, so a poor first layout does not decide the result.
 */
export function solveTimetable(input: SolverInput, attempts = 1): SolverResult {
    const rules = { ...DEFAULT_RULES, ...input.rules };
    const runs = Math.max(1, Math.floor(attempts));
    const budget = rules.timeBudgetMs / runs;
    let best: SolverResult | null = null;
    let iterations = 0;
    let ms = 0;
    for (let i = 0; i < runs; i++) {
        const result = solveOnce(input, { ...rules, timeBudgetMs: budget, seed: (rules.seed + i * 7919) >>> 0 });
        iterations += result.stats.iterations;
        ms += result.stats.ms;
        if (!best || better(result, best)) best = result;
    }
    return { ...best!, stats: { ...best!.stats, iterations, ms, attempts: runs } };
}
