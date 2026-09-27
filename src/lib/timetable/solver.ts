/**
 * Timetable solver: places every weekly lesson so that no class, teacher or
 * room is in two places at once, then improves the result against the
 * school's preferences.
 *
 * Hard rules (never broken):
 *   - a class, a teacher and a room hold at most one lesson per slot;
 *   - doubles sit in two back-to-back periods with no break between them;
 *   - lessons needing a room type (a lab) get a free room of that type,
 *     when the school has any rooms of that type;
 *   - pinned lessons stay where they are.
 *
 * Preferences (weighted cost, lower is better):
 *   - a subject at most once a day per class (doubles count once);
 *   - mathematics and sciences before the first break;
 *   - no more than `maxConsecutive` lessons in a row for a teacher;
 *   - a teacher's and a class's lessons spread evenly across the week.
 *
 * Method: most-constrained-first greedy placement with ejection (a session
 * that cannot be placed may evict one unpinned session, which is queued
 * again), then simulated annealing on single lessons. Deterministic for a
 * given seed. Pure: no I/O, so it runs anywhere and is easy to test.
 */

export interface SolverPeriod {
    /** Position in the day, 0-based, breaks included. */
    index: number;
    isBreak: boolean;
}

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
    periods: readonly SolverPeriod[];
    requirements: readonly SolverRequirement[];
    rooms: readonly SolverRoom[];
    pinned?: readonly PinnedLesson[];
    rules?: Partial<SolverRules>;
}

export interface PlacedLesson { requirementId: string; day: number; period: number; roomId: string | null; pinned: boolean }

export interface SolverResult {
    lessons: PlacedLesson[];
    unplaced: { requirementId: string; lessons: number }[];
    stats: { placed: number; required: number; cost: number; iterations: number; ms: number };
}

const DEFAULT_RULES: SolverRules = { maxConsecutive: 4, timeBudgetMs: 2500, seed: 42 };

const COST = {
    sameSubjectSameDay: 30,
    morningMiss: 4,
    consecutiveOver: 12,
    imbalance: 2,
} as const;

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

interface Session {
    key: number;
    req: SolverRequirement;
    length: 1 | 2;
    pinned: boolean;
    day: number;       // index into days, -1 when unplaced
    slot: number;      // index into teaching slots of the day, -1 when unplaced
    roomId: string | null;
}

export function solveTimetable(input: SolverInput): SolverResult {
    const started = Date.now();
    const rules = { ...DEFAULT_RULES, ...input.rules };
    const random = rng(rules.seed);
    const dayCount = input.days.length;

    // Teaching slots per day, and which neighbours may form a double.
    const teaching = input.periods.filter(p => !p.isBreak).map(p => p.index).sort((a, b) => a - b);
    const slotCount = teaching.length;
    const breakIndexes = new Set(input.periods.filter(p => p.isBreak).map(p => p.index));
    const canPair = teaching.map((p, i) => i + 1 < slotCount && teaching[i + 1] === p + 1 && !breakIndexes.has(p + 1));
    // "Morning" is before the day's last break (lunch), or its only break.
    const lastBreak = breakIndexes.size > 0 ? Math.max(...breakIndexes) : Infinity;
    const isMorning = teaching.map(p => p < lastBreak);

    // Occupancy: owner id -> flat array [day * slotCount + slot] of session key (or -1).
    const cells = dayCount * slotCount;
    const grids = new Map<string, Int32Array>();
    const grid = (owner: string) => {
        let g = grids.get(owner);
        if (!g) { g = new Int32Array(cells).fill(-1); grids.set(owner, g); }
        return g;
    };
    const streamKey = (id: string) => `s:${id}`;
    const teacherKey = (id: string) => `t:${id}`;
    const roomKey = (id: string) => `r:${id}`;

    const roomsByType = new Map<string, SolverRoom[]>();
    input.rooms.forEach(r => roomsByType.set(r.type, [...(roomsByType.get(r.type) ?? []), r]));

    // Build sessions: doubles first so they claim paired slots early.
    const sessions: Session[] = [];
    for (const req of input.requirements) {
        const doubles = Math.max(0, Math.min(req.doubles, Math.floor(req.lessons / 2)));
        for (let i = 0; i < doubles; i++) sessions.push({ key: sessions.length, req, length: 2, pinned: false, day: -1, slot: -1, roomId: null });
        for (let i = 0; i < req.lessons - doubles * 2; i++) sessions.push({ key: sessions.length, req, length: 1, pinned: false, day: -1, slot: -1, roomId: null });
    }

    const owners = (s: Session, roomId: string | null) => [
        streamKey(s.req.streamId),
        ...(s.req.teacherId ? [teacherKey(s.req.teacherId)] : []),
        ...(roomId ? [roomKey(roomId)] : []),
    ];

    const place = (s: Session, day: number, slot: number, roomId: string | null) => {
        s.day = day; s.slot = slot; s.roomId = roomId;
        for (const o of owners(s, roomId)) for (let k = 0; k < s.length; k++) grid(o)[day * slotCount + slot + k] = s.key;
    };
    const unplace = (s: Session) => {
        if (s.day < 0) return;
        for (const o of owners(s, s.roomId)) for (let k = 0; k < s.length; k++) grid(o)[s.day * slotCount + s.slot + k] = -1;
        s.day = -1; s.slot = -1; s.roomId = null;
    };

    const shapeFits = (s: Session, slot: number) => (s.length === 1 ? slot < slotCount : canPair[slot]);

    /** Sessions blocking `s` at (day, slot), and a free room if one is needed. */
    const conflictsAt = (s: Session, day: number, slot: number): { blockers: Set<number>; roomId: string | null; roomBlocked: boolean } => {
        const blockers = new Set<number>();
        const check = (owner: string) => {
            const g = grids.get(owner);
            if (!g) return;
            for (let k = 0; k < s.length; k++) { const hit = g[day * slotCount + slot + k]; if (hit >= 0 && hit !== s.key) blockers.add(hit); }
        };
        check(streamKey(s.req.streamId));
        if (s.req.teacherId) check(teacherKey(s.req.teacherId));
        let roomId: string | null = null;
        let roomBlocked = false;
        const typed = s.req.roomType ? roomsByType.get(s.req.roomType) : undefined;
        if (typed && typed.length > 0) {
            roomId = typed.find(r => {
                const g = grids.get(roomKey(r.id));
                if (!g) return true;
                for (let k = 0; k < s.length; k++) { const hit = g[day * slotCount + slot + k]; if (hit >= 0 && hit !== s.key) return false; }
                return true;
            })?.id ?? null;
            roomBlocked = roomId === null;
        }
        return { blockers, roomId, roomBlocked };
    };

    // ── Soft cost, by bucket (a class's day, a teacher's day) ───────────
    const byKey = sessions;
    const streamDayCost = (streamId: string, day: number): number => {
        const g = grids.get(streamKey(streamId));
        if (!g) return 0;
        const seen = new Map<string, number>();
        let cost = 0;
        let last = -1;
        for (let slot = 0; slot < slotCount; slot++) {
            const key = g[day * slotCount + slot];
            if (key < 0 || key === last) { last = key; continue; }
            last = key;
            const s = byKey[key];
            const n = (seen.get(s.req.subjectId) ?? 0) + 1;
            seen.set(s.req.subjectId, n);
            if (n > 1) cost += COST.sameSubjectSameDay;
            if (s.req.preferMorning && !isMorning[slot]) cost += COST.morningMiss;
        }
        return cost;
    };
    const teacherDayCost = (teacherId: string | null, day: number): number => {
        if (!teacherId) return 0;
        const g = grids.get(teacherKey(teacherId));
        if (!g) return 0;
        let cost = 0; let run = 0; let load = 0;
        for (let slot = 0; slot < slotCount; slot++) {
            const busy = g[day * slotCount + slot] >= 0;
            if (busy) { run++; load++; } else run = 0;
            if (run > rules.maxConsecutive) cost += COST.consecutiveOver;
            // A break before the next teaching slot ends the run.
            if (slot + 1 < slotCount && teaching[slot + 1] !== teaching[slot] + 1) run = 0;
        }
        return cost + load * load * COST.imbalance / Math.max(1, slotCount);
    };
    const localCost = (s: Session, day: number) => streamDayCost(s.req.streamId, day) + teacherDayCost(s.req.teacherId, day);

    const candidateOrder = () => {
        const all: [number, number][] = [];
        for (let d = 0; d < dayCount; d++) for (let t = 0; t < slotCount; t++) all.push([d, t]);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        return all;
    };

    // ── Pinned lessons first ─────────────────────────────────────────────
    const dayIndex = new Map(input.days.map((d, i) => [d, i]));
    const slotIndex = new Map(teaching.map((p, i) => [p, i]));
    for (const pin of input.pinned ?? []) {
        const d = dayIndex.get(pin.day);
        const t = slotIndex.get(pin.period);
        if (d === undefined || t === undefined) continue;
        const s = sessions.find(x => x.req.id === pin.requirementId && x.day < 0 && x.length === 1)
            ?? sessions.find(x => x.req.id === pin.requirementId && x.day < 0 && shapeFits(x, t));
        if (!s || !shapeFits(s, t)) continue;
        const { blockers } = conflictsAt(s, d, t);
        if (blockers.size > 0) continue;
        s.pinned = true;
        place(s, d, t, pin.roomId);
    }

    // ── Greedy construction with ejection ────────────────────────────────
    const teacherLoad = new Map<string, number>();
    input.requirements.forEach(r => { if (r.teacherId) teacherLoad.set(r.teacherId, (teacherLoad.get(r.teacherId) ?? 0) + r.lessons); });
    const difficulty = (s: Session) => (s.length === 2 ? 1000 : 0) + (s.req.roomType ? 500 : 0) + (s.req.teacherId ? teacherLoad.get(s.req.teacherId) ?? 0 : 0);
    const queue = sessions.filter(s => s.day < 0).sort((a, b) => difficulty(b) - difficulty(a));
    const ejections = new Map<number, number>();
    const maxEjections = sessions.length * 6;
    let ejected = 0;

    while (queue.length > 0) {
        const s = queue.shift()!;
        let best: { day: number; slot: number; roomId: string | null; cost: number } | null = null;
        let fallback: { day: number; slot: number; roomId: string | null; victim: Session } | null = null;

        for (const [d, t] of candidateOrder()) {
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

    // ── Improvement: simulated annealing on unpinned single lessons ──────
    // A move takes a lesson to another slot of its class: an empty one, or
    // one held by another single lesson, which then swaps places with it (in
    // a full timetable swaps are the only moves there are).
    const movable = sessions.filter(s => s.day >= 0 && !s.pinned && s.length === 1);
    let iterations = 0;
    let temperature = 8;
    const deadline = started + rules.timeBudgetMs;
    const daysCost = (touched: readonly Session[], days: readonly number[]) => {
        let total = 0;
        const seenStream = new Set<string>();
        const seenTeacher = new Set<string>();
        for (const d of new Set(days)) {
            for (const x of touched) {
                const sk = `${x.req.streamId}|${d}`;
                if (!seenStream.has(sk)) { seenStream.add(sk); total += streamDayCost(x.req.streamId, d); }
                const tk = `${x.req.teacherId}|${d}`;
                if (x.req.teacherId && !seenTeacher.has(tk)) { seenTeacher.add(tk); total += teacherDayCost(x.req.teacherId, d); }
            }
        }
        return total;
    };
    while (movable.length > 0 && Date.now() < deadline && iterations < 3_000_000) {
        iterations++;
        const a = movable[Math.floor(random() * movable.length)];
        const d = Math.floor(random() * dayCount);
        const t = Math.floor(random() * slotCount);
        if (d === a.day && t === a.slot) continue;
        const occupant = grid(streamKey(a.req.streamId))[d * slotCount + t];
        const b = occupant >= 0 ? byKey[occupant] : null;
        if (b && (b.pinned || b.length !== 1)) continue;

        const fromA = { day: a.day, slot: a.slot, roomId: a.roomId };
        const fromB = b ? { day: b.day, slot: b.slot, roomId: b.roomId } : null;
        const touched = b ? [a, b] : [a];
        const days = [fromA.day, d];
        const before = daysCost(touched, days);

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
            const delta = daysCost(touched, days) - before;
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
            lessons.push({ requirementId: s.req.id, day: input.days[s.day], period: teaching[s.slot + k], roomId: s.roomId, pinned: s.pinned });
        }
    }
    let cost = 0;
    const streams = new Set(input.requirements.map(r => r.streamId));
    const teachers = new Set(input.requirements.map(r => r.teacherId).filter((t): t is string => !!t));
    for (let d = 0; d < dayCount; d++) {
        streams.forEach(id => { cost += streamDayCost(id, d); });
        teachers.forEach(id => { cost += teacherDayCost(id, d); });
    }
    const required = input.requirements.reduce((n, r) => n + r.lessons, 0);
    return {
        lessons,
        unplaced: [...missing.entries()].map(([requirementId, n]) => ({ requirementId, lessons: n })),
        stats: { placed: lessons.length, required, cost: Math.round(cost), iterations, ms: Date.now() - started },
    };
}
