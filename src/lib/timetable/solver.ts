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
 *   - doubles sit in two back-to-back periods with no break between them;
 *   - lessons needing a room type (a lab) get a free room of that type,
 *     when the school has any rooms of that type;
 *   - pinned lessons stay where they are.
 *
 * Preferences (weighted cost, lower is better):
 *   - a subject at most once a day per class (doubles count once);
 *   - mathematics and sciences before lunch; PE and the arts not first thing;
 *   - a subject not in the same period every day, and its few lessons spread
 *     across the week rather than bunched on neighbouring days;
 *   - no more than `maxConsecutive` lessons in a row for a teacher, and a
 *     teacher's lessons spread evenly across the week.
 *
 * Method: most-constrained-first greedy placement with ejection, then
 * simulated annealing (moves and swaps). `solveBest` runs several seeds and
 * keeps the best. Pure: no I/O, deterministic for a seed.
 */

import type { TimetableQuality } from './config';

export interface SolverPeriod {
    /** Position in the section's day, 0-based, breaks included. */
    index: number;
    isBreak: boolean;
    /** Clock time in minutes from midnight; omitted, periods are taken as back to back hours. */
    start?: number;
    end?: number;
}

export interface SolverSection { id: string; periods: readonly SolverPeriod[] }

export interface SolverRequirement {
    id: string;
    streamId: string;
    subjectId: string;
    teacherId: string | null;
    lessons: number;
    doubles: number;
    roomType: string | null;
    /** Mathematics and sciences prefer the morning. */
    preferMorning: boolean;
    /** PE and the arts suit later in the day. */
    preferAfternoon?: boolean;
    /** The section whose bell the class follows; the first section when omitted. */
    sectionId?: string;
}

export interface SolverRoom { id: string; type: string }

export interface PinnedLesson { requirementId: string; day: number; period: number; roomId: string | null }

export interface SolverRules {
    maxConsecutive: number;
    /** Stop improving after this long. */
    timeBudgetMs: number;
    seed: number;
}

export interface SolverInput {
    days: readonly number[];
    /** The main day, used when no sections are given. */
    periods?: readonly SolverPeriod[];
    sections?: readonly SolverSection[];
    requirements: readonly SolverRequirement[];
    rooms: readonly SolverRoom[];
    pinned?: readonly PinnedLesson[];
    rules?: Partial<SolverRules>;
}

export interface PlacedLesson { requirementId: string; day: number; period: number; roomId: string | null; pinned: boolean }

export interface SolverResult {
    lessons: PlacedLesson[];
    unplaced: { requirementId: string; lessons: number }[];
    stats: { placed: number; required: number; cost: number; iterations: number; ms: number; attempts: number; quality: TimetableQuality };
}

const DEFAULT_RULES: SolverRules = { maxConsecutive: 4, timeBudgetMs: 2500, seed: 42 };

const COST = {
    sameSubjectSameDay: 30,
    morningMiss: 4,
    earlyCreative: 3,
    samePeriodRepeat: 3,
    bunchedDays: 8,
    consecutiveOver: 12,
    imbalance: 2,
} as const;

/** A gap longer than this between two lessons gives a teacher a rest. */
const REST_MINUTES = 5;

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
}

function bellOf(section: SolverSection): Bell {
    const periods = [...section.periods].sort((a, b) => a.index - b.index);
    const timed = periods.every(p => p.start !== undefined && p.end !== undefined);
    const startOf = (p: SolverPeriod) => (timed ? p.start! : p.index * 60);
    const endOf = (p: SolverPeriod) => (timed ? p.end! : p.index * 60 + 59);
    const lessons = periods.filter(p => !p.isBreak);
    const breaks = periods.filter(p => p.isBreak);
    // "Morning" is before the day's last break (lunch), or its only break.
    const lastBreak = breaks.length > 0 ? Math.max(...breaks.map(b => b.index)) : Infinity;
    return {
        id: section.id,
        teaching: lessons.map(p => p.index),
        start: lessons.map(startOf),
        end: lessons.map(endOf),
        canPair: lessons.map((p, i) => i + 1 < lessons.length && lessons[i + 1].index === p.index + 1),
        isMorning: lessons.map(p => p.index < lastBreak),
        isEarly: lessons.map((_, i) => i < 2),
    };
}

interface Session {
    key: number;
    req: SolverRequirement;
    bell: Bell;
    length: 1 | 2;
    pinned: boolean;
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
    const bells = new Map(sections.map(s => [s.id, bellOf(s)]));
    const firstBell = bells.get(sections[0].id)!;
    const bellFor = (req: SolverRequirement) => (req.sectionId && bells.get(req.sectionId)) || firstBell;

    // Clock span of the school day across every section, for minute timelines.
    const allBells = [...bells.values()];
    const dayStart = Math.min(...allBells.flatMap(b => b.start));
    const dayEnd = Math.max(...allBells.flatMap(b => b.end));
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

    const roomsByType = new Map<string, SolverRoom[]>();
    input.rooms.forEach(r => roomsByType.set(r.type, [...(roomsByType.get(r.type) ?? []), r]));

    // Build sessions: doubles first so they claim paired slots early.
    const sessions: Session[] = [];
    for (const req of input.requirements) {
        const bell = bellFor(req);
        const doubles = Math.max(0, Math.min(req.doubles, Math.floor(req.lessons / 2)));
        for (let i = 0; i < doubles; i++) sessions.push({ key: sessions.length, req, bell, length: 2, pinned: false, day: -1, slot: -1, roomId: null });
        for (let i = 0; i < req.lessons - doubles * 2; i++) sessions.push({ key: sessions.length, req, bell, length: 1, pinned: false, day: -1, slot: -1, roomId: null });
    }
    const byKey = sessions;

    const timelineOwners = (s: Session, roomId: string | null) => [
        ...(s.req.teacherId ? [teacherKey(s.req.teacherId)] : []),
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

    const shapeFits = (s: Session, slot: number) => (s.length === 1 ? slot < s.bell.teaching.length : !!s.bell.canPair[slot]);

    const busyIn = (owner: string, s: Session, day: number, slot: number, into: Set<number> | null): boolean => {
        const t = timelines.get(owner);
        if (!t) return false;
        const [from, to] = minutes(s, slot);
        let busy = false;
        for (let m = from; m < to; m++) {
            const hit = t[day * span + m];
            if (hit >= 0 && hit !== s.key) { busy = true; if (!into) return true; into.add(hit); }
        }
        return busy;
    };

    /** Sessions blocking `s` at (day, slot), and a free room if one is needed. */
    const conflictsAt = (s: Session, day: number, slot: number): { blockers: Set<number>; roomId: string | null; roomBlocked: boolean } => {
        const blockers = new Set<number>();
        const g = streamGrids.get(s.req.streamId);
        const n = s.bell.teaching.length;
        if (g) for (let k = 0; k < s.length; k++) { const hit = g[day * n + slot + k]; if (hit >= 0 && hit !== s.key) blockers.add(hit); }
        if (s.req.teacherId) busyIn(teacherKey(s.req.teacherId), s, day, slot, blockers);
        let roomId: string | null = null;
        let roomBlocked = false;
        const typed = s.req.roomType ? roomsByType.get(s.req.roomType) : undefined;
        if (typed && typed.length > 0) {
            roomId = typed.find(r => !busyIn(roomKey(r.id), s, day, slot, null))?.id ?? null;
            roomBlocked = roomId === null;
        }
        return { blockers, roomId, roomBlocked };
    };

    // ── Soft cost ────────────────────────────────────────────────────────
    const streamBell = new Map<string, Bell>();
    sessions.forEach(s => streamBell.set(s.req.streamId, s.bell));

    /** A class's day: repeats, and subjects at the wrong time of day. */
    const streamDayCost = (streamId: string, day: number): number => {
        const g = streamGrids.get(streamId);
        const bell = streamBell.get(streamId);
        if (!g || !bell) return 0;
        const n = bell.teaching.length;
        const seen = new Map<string, number>();
        let cost = 0;
        let last = -1;
        for (let slot = 0; slot < n; slot++) {
            const key = g[day * n + slot];
            if (key < 0 || key === last) { last = key; continue; }
            last = key;
            const s = byKey[key];
            const count = (seen.get(s.req.subjectId) ?? 0) + 1;
            seen.set(s.req.subjectId, count);
            if (count > 1) cost += COST.sameSubjectSameDay;
            if (s.req.preferMorning && !bell.isMorning[slot]) cost += COST.morningMiss;
            if (s.req.preferAfternoon && bell.isEarly[slot]) cost += COST.earlyCreative;
        }
        return cost;
    };

    /** A class's week: a subject in the same period day after day, or bunched on neighbouring days. */
    const streamWeekCost = (streamId: string): number => {
        const g = streamGrids.get(streamId);
        const bell = streamBell.get(streamId);
        if (!g || !bell) return 0;
        const n = bell.teaching.length;
        const slotsBySubject = new Map<string, number[]>();
        const daysBySubject = new Map<string, Set<number>>();
        for (let d = 0; d < dayCount; d++) {
            let last = -1;
            for (let slot = 0; slot < n; slot++) {
                const key = g[d * n + slot];
                if (key < 0 || key === last) { last = key; continue; }
                last = key;
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
        for (const days of daysBySubject.values()) cost += bunching(days, dayCount) * COST.bunchedDays;
        return cost;
    };

    // Each teacher's lessons, so their day is read from a handful of sessions, not 600 minutes.
    const teacherSessions = new Map<string, Session[]>();
    sessions.forEach(s => { if (s.req.teacherId) teacherSessions.set(s.req.teacherId, [...(teacherSessions.get(s.req.teacherId) ?? []), s]); });
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

    const localCost = (s: Session, day: number) => streamDayCost(s.req.streamId, day) + teacherDayCost(s.req.teacherId, day);

    const candidateOrder = (s: Session) => {
        const all: [number, number][] = [];
        for (let d = 0; d < dayCount; d++) for (let t = 0; t < s.bell.teaching.length; t++) all.push([d, t]);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        return all;
    };

    // ── Pinned lessons first ─────────────────────────────────────────────
    const dayIndex = new Map(input.days.map((d, i) => [d, i]));
    for (const pin of input.pinned ?? []) {
        const d = dayIndex.get(pin.day);
        if (d === undefined) continue;
        const candidates = sessions.filter(x => x.req.id === pin.requirementId && x.day < 0);
        const s = candidates.find(x => x.length === 1) ?? candidates[0];
        if (!s) continue;
        const t = s.bell.teaching.indexOf(pin.period);
        if (t < 0 || !shapeFits(s, t)) continue;
        const { blockers } = conflictsAt(s, d, t);
        if (blockers.size > 0) continue;
        s.pinned = true;
        place(s, d, t, pin.roomId);
    }

    // ── Greedy construction with ejection ────────────────────────────────
    const teacherLoad = new Map<string, number>();
    input.requirements.forEach(r => { if (r.teacherId) teacherLoad.set(r.teacherId, (teacherLoad.get(r.teacherId) ?? 0) + r.lessons); });
    const difficulty = (s: Session) => (s.length === 2 ? 1000 : 0) + (s.req.roomType ? 500 : 0) + (s.req.teacherId ? teacherLoad.get(s.req.teacherId) ?? 0 : 0) + random();
    const queue = sessions.filter(s => s.day < 0).sort((a, b) => difficulty(b) - difficulty(a));
    const ejections = new Map<number, number>();
    const maxEjections = sessions.length * 6;
    let ejected = 0;

    while (queue.length > 0) {
        const s = queue.shift()!;
        let best: { day: number; slot: number; roomId: string | null; cost: number } | null = null;
        let fallback: { day: number; slot: number; roomId: string | null; victim: Session } | null = null;

        for (const [d, t] of candidateOrder(s)) {
            if (!shapeFits(s, t)) continue;
            const { blockers, roomId, roomBlocked } = conflictsAt(s, d, t);
            if (blockers.size === 0 && !roomBlocked) {
                const before = localCost(s, d);
                place(s, d, t, roomId);
                const cost = localCost(s, d) - before;
                unplace(s);
                if (!best || cost < best.cost) best = { day: d, slot: t, roomId, cost };
                if (cost === 0) break;
            } else if (!roomBlocked && blockers.size === 1 && !fallback) {
                const victim = byKey[[...blockers][0]];
                if (!victim.pinned && (ejections.get(victim.key) ?? 0) < 3) fallback = { day: d, slot: t, roomId, victim };
            }
        }

        if (best) place(s, best.day, best.slot, best.roomId);
        else if (fallback && ejected < maxEjections) {
            ejected++;
            ejections.set(fallback.victim.key, (ejections.get(fallback.victim.key) ?? 0) + 1);
            unplace(fallback.victim);
            place(s, fallback.day, fallback.slot, fallback.roomId);
            queue.push(fallback.victim);
        }
        // Otherwise the session stays unplaced and is reported.
    }

    // ── Improvement: simulated annealing ─────────────────────────────────
    // A move takes a lesson to another slot of its class: an empty one, or
    // one held by another lesson of the same length, which swaps with it.
    const movable = sessions.filter(s => s.day >= 0 && !s.pinned);
    let iterations = 0;
    let temperature = 8;
    const deadline = started + rules.timeBudgetMs;
    const affectedCost = (touched: readonly Session[], days: readonly number[]) => {
        let total = 0;
        const streams = new Set(touched.map(x => x.req.streamId));
        const teachers = new Set(touched.map(x => x.req.teacherId).filter((t): t is string => !!t));
        for (const d of new Set(days)) {
            streams.forEach(id => { total += streamDayCost(id, d); });
            teachers.forEach(id => { total += teacherDayCost(id, d); });
        }
        streams.forEach(id => { total += streamWeekCost(id); });
        return total;
    };
    while (movable.length > 0 && Date.now() < deadline && iterations < 3_000_000) {
        iterations++;
        const a = movable[Math.floor(random() * movable.length)];
        const d = Math.floor(random() * dayCount);
        const t = Math.floor(random() * a.bell.teaching.length);
        if ((d === a.day && t === a.slot) || !shapeFits(a, t)) continue;
        const g = streamGrids.get(a.req.streamId)!;
        const n = a.bell.teaching.length;
        // Whatever the class has in the target cells must be one lesson of the same length, or nothing.
        const occupants = new Set<number>();
        for (let k = 0; k < a.length; k++) { const hit = g[d * n + t + k]; if (hit >= 0 && hit !== a.key) occupants.add(hit); }
        if (occupants.size > 1) continue;
        const b = occupants.size === 1 ? byKey[[...occupants][0]] : null;
        if (b && (b.pinned || b.length !== a.length || b.slot !== t)) continue;

        const fromA = { day: a.day, slot: a.slot, roomId: a.roomId };
        const fromB = b ? { day: b.day, slot: b.slot, roomId: b.roomId } : null;
        const touched = b ? [a, b] : [a];
        const days = [fromA.day, d];
        const before = affectedCost(touched, days);

        unplace(a);
        if (b) unplace(b);
        const fitA = conflictsAt(a, d, t);
        let ok = fitA.blockers.size === 0 && !fitA.roomBlocked;
        if (ok) place(a, d, t, fitA.roomId);
        if (ok && b) {
            const fitB = conflictsAt(b, fromA.day, fromA.slot);
            ok = fitB.blockers.size === 0 && !fitB.roomBlocked;
            if (ok) place(b, fromA.day, fromA.slot, fitB.roomId);
        }
        const accept = ok && (() => {
            const delta = affectedCost(touched, days) - before;
            return delta <= 0 || random() < Math.exp(-delta / temperature);
        })();
        if (!accept) {
            unplace(a);
            if (b) unplace(b);
            place(a, fromA.day, fromA.slot, fromA.roomId);
            if (b && fromB) place(b, fromB.day, fromB.slot, fromB.roomId);
        }
        if (iterations % 500 === 0) temperature = Math.max(0.05, temperature * 0.97);
    }

    // ── Result ───────────────────────────────────────────────────────────
    const lessons: PlacedLesson[] = [];
    const missing = new Map<string, number>();
    for (const s of sessions) {
        if (s.day < 0) { missing.set(s.req.id, (missing.get(s.req.id) ?? 0) + s.length); continue; }
        for (let k = 0; k < s.length; k++) {
            lessons.push({ requirementId: s.req.id, day: input.days[s.day], period: s.bell.teaching[s.slot + k], roomId: s.roomId, pinned: s.pinned });
        }
    }
    let cost = 0;
    const streamIds = new Set(input.requirements.map(r => r.streamId));
    const teacherIds = new Set(input.requirements.map(r => r.teacherId).filter((t): t is string => !!t));
    streamIds.forEach(id => { cost += streamWeekCost(id); });
    for (let d = 0; d < dayCount; d++) {
        streamIds.forEach(id => { cost += streamDayCost(id, d); });
        teacherIds.forEach(id => { cost += teacherDayCost(id, d); });
    }
    const required = input.requirements.reduce((n, r) => n + r.lessons, 0);
    return {
        lessons,
        unplaced: [...missing.entries()].map(([requirementId, n]) => ({ requirementId, lessons: n })),
        stats: {
            placed: lessons.length, required, cost: Math.round(cost), iterations, ms: Date.now() - started, attempts: 1,
            quality: measureQuality(sessions, dayCount, streamGrids, streamBell, teacherIds, (id, d) => teacherDay(id, d).longRuns, required),
        },
    };
}

/**
 * How bunched a subject's week is: a two-lesson subject on neighbouring
 * days, or three or more days in a row (Mon, Tue, Wed) for a subject that
 * does not run every day. Monday, Tuesday and Thursday is fine.
 */
function bunching(days: ReadonlySet<number>, dayCount: number): number {
    const k = days.size;
    if (k <= 1 || k >= dayCount) return 0;
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

/** The preferences a draft breaks, counted the way a timetabler would. */
function measureQuality(
    sessions: readonly Session[],
    dayCount: number,
    streamGrids: ReadonlyMap<string, Int32Array>,
    streamBell: ReadonlyMap<string, Bell>,
    teacherIds: ReadonlySet<string>,
    teacherLongRuns: (teacherId: string, day: number) => number,
    totalLessons: number,
): TimetableQuality {
    let repeatsInDay = 0; let lateCoreLessons = 0; let earlyCreativeLessons = 0; let samePeriodHabits = 0; let bunchedWeeks = 0; let longTeacherRuns = 0;
    for (const [streamId, g] of streamGrids) {
        const bell = streamBell.get(streamId)!;
        const n = bell.teaching.length;
        const slotsBySubject = new Map<string, number[]>();
        const daysBySubject = new Map<string, Set<number>>();
        for (let d = 0; d < dayCount; d++) {
            const seen = new Set<string>();
            let last = -1;
            for (let slot = 0; slot < n; slot++) {
                const key = g[d * n + slot];
                if (key < 0 || key === last) { last = key; continue; }
                last = key;
                const s = sessions[key];
                if (seen.has(s.req.subjectId)) repeatsInDay++;
                seen.add(s.req.subjectId);
                if (s.req.preferMorning && !bell.isMorning[slot]) lateCoreLessons++;
                if (s.req.preferAfternoon && bell.isEarly[slot]) earlyCreativeLessons++;
                slotsBySubject.set(s.req.subjectId, [...(slotsBySubject.get(s.req.subjectId) ?? []), slot]);
                daysBySubject.set(s.req.subjectId, (daysBySubject.get(s.req.subjectId) ?? new Set()).add(d));
            }
        }
        for (const slots of slotsBySubject.values()) {
            if (slots.length < 3) continue;
            const counts = new Map<number, number>();
            slots.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
            if (Math.max(...counts.values()) >= 3) samePeriodHabits++;
        }
        for (const days of daysBySubject.values()) if (bunching(days, dayCount) > 0) bunchedWeeks++;
    }
    for (const id of teacherIds) for (let d = 0; d < dayCount; d++) longTeacherRuns += teacherLongRuns(id, d);
    const points = repeatsInDay * 4 + lateCoreLessons + earlyCreativeLessons + samePeriodHabits * 2 + bunchedWeeks * 2 + longTeacherRuns * 3;
    const score = totalLessons === 0 ? 100 : Math.max(0, Math.round(100 - (points / totalLessons) * 100));
    return { score, repeatsInDay, lateCoreLessons, earlyCreativeLessons, samePeriodHabits, bunchedWeeks, longTeacherRuns };
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
