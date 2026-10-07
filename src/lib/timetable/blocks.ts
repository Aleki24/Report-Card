/**
 * Option blocks: how a class with more subjects than periods still fits.
 *
 * Kenyan secondary and senior schools teach core subjects to the whole class
 * and run electives in parallel blocks: Biology, Geography and Computer
 * Studies at the same time, each learner in the one they chose, each with its
 * own teacher. A class's week is then its core lessons plus, for each block,
 * the longest subject in it.
 *
 * A school can put a load in a block by hand (`option_block`); the rest of the
 * electives are blocked automatically, but only when the class would not fit
 * otherwise, so Form 1 and 2 that take every subject stay whole-class. Shared
 * by the generator, the web and the app, so what the loads page promises is
 * what the generator builds.
 */

import { KCSE_GROUP_LABEL, kcseGroup, type KcseGroup } from '../kcse';

export interface BlockLoad {
    id: string;
    streamId: string;
    subjectId: string;
    subjectName: string;
    /** `CORE` subjects are taught to the whole class; anything else is an elective. */
    subjectType: string | null;
    category: string | null;
    teacherId: string | null;
    lessons: number;
    doubles: number;
    /** Set by the school: this load runs in that block. Null: decided here. */
    optionBlock: number | null;
}

export interface OptionBlock<L extends BlockLoad = BlockLoad> {
    /** 1, 2, 3… shown as Option A, B, C. */
    number: number;
    label: string;
    loads: L[];
    /** Periods the block takes each week: its longest subject. */
    lessons: number;
    /** Chosen by the school rather than worked out. */
    manual: boolean;
    /** A teacher with two subjects in the block cannot teach both at once. */
    teacherClash: boolean;
}

export interface ClassPlan<L extends BlockLoad = BlockLoad> {
    streamId: string;
    capacity: number;
    core: L[];
    blocks: OptionBlock<L>[];
    /** Periods the week needs: core plus each block's longest subject. */
    needed: number;
    fits: boolean;
    /**
     * What the blocks rest on: learners' recorded subject choices (no learner
     * has two subjects in one block), or, without them, the subjects' types.
     */
    basis: 'choices' | 'groups' | 'subjects' | 'none';
    /** Learners with recorded choices, when the blocks rest on them. */
    learnersWithChoices: number;
    /**
     * With subject groups: learners whose choices put two subjects in one
     * group, so they must change one (or take it outside the timetable).
     */
    unfit: { learnerId: string; subjects: [string, string] }[];
}

/** A class's recorded elective choices: subject id → the learners taking it. */
export type ClassChoices = ReadonlyMap<string, ReadonlySet<string>>;

export const blockLabel = (n: number) => `Option ${String.fromCharCode(64 + Math.min(Math.max(n, 1), 26))}`;

const isElective = (l: BlockLoad) => (l.subjectType ?? 'CORE').toUpperCase() !== 'CORE';
const isMaths = (l: BlockLoad) => /mathematic/i.test(l.subjectName);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function block<L extends BlockLoad>(number: number, loads: L[], manual: boolean): OptionBlock<L> {
    const teachers = loads.map(l => l.teacherId).filter((t): t is string => !!t);
    return {
        number,
        label: blockLabel(number),
        loads,
        lessons: Math.max(0, ...loads.map(l => l.lessons)),
        manual,
        teacherClash: new Set(teachers).size < teachers.length,
    };
}

/**
 * Spread electives over `k` blocks: no teacher twice in a block, subjects of
 * one category (the sciences, say) apart so a learner can take several, and
 * blocks kept about the same size.
 */
function spread<L extends BlockLoad>(electives: readonly L[], k: number): L[][] {
    const bins: L[][] = Array.from({ length: k }, () => []);
    const order = [...electives].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || b.lessons - a.lessons || a.subjectName.localeCompare(b.subjectName));
    for (const l of order) {
        let best = 0;
        let bestScore = Infinity;
        bins.forEach((bin, i) => {
            const clash = !!l.teacherId && bin.some(x => x.teacherId === l.teacherId);
            const sameCategory = bin.filter(x => x.category && x.category === l.category).length;
            const score = (clash ? 1000 : 0) + sameCategory * 10 + bin.length;
            if (score < bestScore) { bestScore = score; best = i; }
        });
        bins[best].push(l);
    }
    return bins.filter(b => b.length > 0);
}

/**
 * Blocks from learners' choices: two electives any learner takes together, or
 * one teacher's two subjects, never share a block. Searched exhaustively
 * (branch and bound, most constrained subject first) for the fewest periods —
 * each block costs its longest subject — with a step limit, so a large class
 * still returns the best found.
 */
function colourByChoices<L extends BlockLoad>(electives: readonly L[], choices: ClassChoices): L[][] {
    const n = electives.length;
    const clash: boolean[][] = electives.map(a => electives.map(b => {
        if (a === b) return false;
        if (a.teacherId && a.teacherId === b.teacherId) return true;
        const sa = choices.get(a.subjectId);
        const sb = choices.get(b.subjectId);
        if (!sa || !sb) return false;
        for (const x of sa) if (sb.has(x)) return true;
        return false;
    }));
    // Most clashes and longest first: decisions that matter are made early.
    const order = [...electives.keys()].sort((i, j) =>
        clash[j].filter(Boolean).length - clash[i].filter(Boolean).length || electives[j].lessons - electives[i].lessons);
    let best: number[][] | null = null;
    let bestCost = Infinity;
    let steps = 0;
    const bins: number[][] = [];
    const binMax: number[] = [];
    const search = (k: number, cost: number) => {
        if (cost >= bestCost || ++steps > 200_000) return;
        if (k === n) { bestCost = cost; best = bins.map(b => [...b]); return; }
        const i = order[k];
        const lessons = electives[i].lessons;
        for (let b = 0; b < bins.length; b++) {
            if (bins[b].some(j => clash[i][j])) continue;
            const before = binMax[b];
            bins[b].push(i);
            binMax[b] = Math.max(before, lessons);
            search(k + 1, cost - before + binMax[b]);
            bins[b].pop();
            binMax[b] = before;
        }
        bins.push([i]);
        binMax.push(lessons);
        search(k + 1, cost + lessons);
        bins.pop();
        binMax.pop();
    };
    search(0, 0);
    return (best ?? [electives.map((_, i) => i)]).map(b => b.map(i => electives[i]));
}

/** One class's week: whole-class subjects, then option blocks if the electives need them. */
export function planClass<L extends BlockLoad>(streamId: string, loads: readonly L[], capacity: number, choices?: ClassChoices): ClassPlan<L> {
    const learners = new Set([...(choices?.values() ?? [])].flatMap(s => [...s])).size;
    const manual = new Map<number, L[]>();
    const rest: L[] = [];
    for (const l of loads) {
        if (l.optionBlock) manual.set(l.optionBlock, [...(manual.get(l.optionBlock) ?? []), l]);
        else rest.push(l);
    }
    const blocks: OptionBlock<L>[] = [...manual.entries()].sort((a, b) => a[0] - b[0]).map(([n, ls]) => block(n, ls, true));
    let basis: ClassPlan['basis'] = 'none';
    let unfit: ClassPlan['unfit'] = [];
    const finish = (core: L[]): ClassPlan<L> => {
        const needed = sum(core.map(l => l.lessons)) + sum(blocks.map(b => b.lessons));
        return { streamId, capacity, core, blocks, needed, fits: needed <= capacity, basis, learnersWithChoices: basis === 'subjects' || basis === 'none' ? 0 : learners, unfit };
    };

    // Recorded choices say which subjects are electives: anything a learner chose.
    const chosen = (l: L) => !!choices?.get(l.subjectId)?.size;
    const useChoices = learners > 0 && rest.some(chosen);
    // Everyone takes everything while it fits and nobody has chosen: no blocks to work out.
    if (!useChoices && sum(rest.map(l => l.lessons)) + sum(blocks.map(b => b.lessons)) <= capacity) return finish(rest);

    const elective = (l: L) => (useChoices ? chosen(l) || isElective(l) : isElective(l));
    const core = rest.filter(l => !elective(l));
    let electives = rest.filter(elective);
    let next = Math.max(0, ...blocks.map(b => b.number)) + 1;

    // Core and Essential Mathematics are alternatives: one block between them,
    // unless learners' recorded choices already say who takes which.
    const maths = electives.filter(l => isMaths(l) && !chosen(l));
    if (maths.length > 1) {
        blocks.push(block(next++, maths, false));
        electives = electives.filter(l => !maths.includes(l));
    }

    if (useChoices && choices) {
        const exact = colourByChoices(electives, choices);
        const room = capacity - sum(core.map(l => l.lessons)) - sum(blocks.map(b => b.lessons));
        const exactLessons = sum(exact.map(bin => Math.max(...bin.map(l => l.lessons))));
        const grouped = exactLessons > room ? bestGroups(electives, choices, core.length + blocks.length, exact.length, room, learners) : null;
        if (grouped) {
            basis = 'groups';
            unfit = grouped.unfit;
            for (const g of grouped.groups) blocks.push({ ...block(next++, g.loads, false), label: g.label });
            return finish(core);
        }
        basis = 'choices';
        for (const bin of exact) blocks.push(block(next++, bin, false));
        return finish(core);
    }
    basis = 'subjects';
    if (electives.length === 0) return finish(core);

    // As many blocks as the week allows: more blocks, more combinations open to learners.
    const longest = Math.max(...electives.map(l => l.lessons));
    const room = capacity - sum(core.map(l => l.lessons)) - sum(blocks.map(b => b.lessons));
    const k = Math.min(electives.length, Math.max(1, Math.floor(room / longest)));
    for (const bin of spread(electives, k)) blocks.push(block(next++, bin, false));
    return finish(core);
}

/** A learner in ten may have to change a subject before groups are worth it over exact choices. */
const MAX_UNFIT_SHARE = 0.15;

/**
 * When learners' exact choices need more periods than the week has, the way
 * schools solve it: subject groups learners pick one subject from each
 * (KCSE groups kept together where they can be). Tries from the number of
 * electives most learners take up to one fewer group than exact choices
 * need, and keeps the plan that fits the week, else the shortest, as long
 * as few learners have to change a subject.
 */
function bestGroups<L extends BlockLoad>(electives: readonly L[], choices: ClassChoices, coreCount: number, exactBlocks: number, room: number, learners: number) {
    const allowed = Math.max(1, Math.floor(learners * MAX_UNFIT_SHARE));
    let best: { plan: SubjectGroupsPlan<L>; lessons: number } | null = null;
    for (let k = electiveSlots(coreCount, choices); k < exactBlocks; k++) {
        const plan = groupElectives(electives, k, choices, kcseGroup, g => KCSE_GROUP_LABEL[g as KcseGroup]);
        if (!plan || plan.unfit.length > allowed) continue;
        const lessons = sum(plan.groups.map(g => g.lessons));
        const fits = lessons <= room;
        const better = !best
            || (fits && best.lessons > room)
            || (fits === best.lessons <= room && (lessons < best.lessons || (lessons === best.lessons && plan.unfit.length < best.plan.unfit.length)));
        if (better) best = { plan, lessons };
        if (lessons <= room) break;
    }
    return best?.plan ?? null;
}

/** Every class's plan, given each class's teaching periods and its learners' recorded choices. */
export function planClasses<L extends BlockLoad>(
    loads: readonly L[],
    capacityOf: (streamId: string) => number,
    choicesOf: (streamId: string) => ClassChoices | undefined = () => undefined,
): Map<string, ClassPlan<L>> {
    const byClass = new Map<string, L[]>();
    loads.forEach(l => byClass.set(l.streamId, [...(byClass.get(l.streamId) ?? []), l]));
    return new Map([...byClass.entries()].map(([id, ls]) => [id, planClass(id, ls, capacityOf(id), choicesOf(id))]));
}

/**
 * Each teacher's lessons in the week, across every class and level: whole-class
 * loads plus their subjects in option blocks. A teacher in Junior and Senior
 * Secondary alike is counted once, so an overload shows before generating.
 */
export function teacherWeeks(plans: Iterable<ClassPlan>): Map<string, number> {
    const week = new Map<string, number>();
    const add = (t: string | null, n: number) => { if (t) week.set(t, (week.get(t) ?? 0) + n); };
    for (const p of plans) {
        p.core.forEach(l => add(l.teacherId, l.lessons));
        p.blocks.forEach(b => b.loads.forEach(l => add(l.teacherId, l.lessons)));
    }
    return week;
}

/** What stops a class being timetabled, in words, or null when it fits. */
export function planProblem(plan: ClassPlan, className: string): string | null {
    if (plan.fits) return null;
    const over = plan.needed - plan.capacity;
    return `${className} needs ${plan.needed} lessons a week but has ${plan.capacity} periods. Remove ${over} lesson${over === 1 ? '' : 's'}, move an elective into an option block, or add a period to the day.`;
}

// ── Subject groups (the KCSE way) ─────────────────────────────────────

export interface SubjectGroup<L extends BlockLoad = BlockLoad> {
    label: string;
    loads: L[];
    /** Periods a week: its longest subject. */
    lessons: number;
}

export interface SubjectGroupsPlan<L extends BlockLoad = BlockLoad> {
    groups: SubjectGroup<L>[];
    /** Learners whose recorded choices put two subjects in one group, and which two. */
    unfit: { learnerId: string; subjects: [string, string] }[];
}

/**
 * How many electives a class's learners take: what most of them chose, or,
 * with no choices recorded, what KCSE's seven subjects leave after the
 * whole-class ones.
 */
export function electiveSlots(coreCount: number, choices?: ClassChoices, minSubjects = 7): number {
    const perLearner = new Map<string, number>();
    choices?.forEach(learners => learners.forEach(id => perLearner.set(id, (perLearner.get(id) ?? 0) + 1)));
    const counts = [...perLearner.values()].sort((a, b) => a - b);
    if (counts.length > 0) return Math.max(1, counts[Math.floor((counts.length - 1) / 2)]);
    return Math.max(1, minSubjects - coreCount);
}

/**
 * Electives in `k` subject groups, each learner taking one subject from each,
 * as schools publish them ("pick one from each group"). Searched over every
 * way to split the electives: the most learners whose choices fit, then the
 * fewest periods, then subjects of one KCSE group together (Sciences,
 * Humanities…) — never one teacher twice in a group.
 */
export function groupElectives<L extends BlockLoad>(
    electives: readonly L[],
    k: number,
    choices: ClassChoices | undefined,
    groupOf: (subjectName: string) => string | null,
    groupLabel: (group: string) => string,
): SubjectGroupsPlan<L> | null {
    const n = electives.length;
    if (n === 0 || k < 1) return null;
    const index = new Map(electives.map((l, i) => [l.subjectId, i]));
    // Each learner's chosen electives, as indices.
    const byLearner = new Map<string, number[]>();
    choices?.forEach((learners, subjectId) => {
        const i = index.get(subjectId);
        if (i === undefined) return;
        learners.forEach(id => byLearner.set(id, [...(byLearner.get(id) ?? []), i]));
    });
    const learners = [...byLearner.entries()];
    const kind = electives.map(l => groupOf(l.subjectName));

    const bin: number[] = new Array(n).fill(-1);
    let best: { bins: number[]; fit: number; lessons: number; cohesion: number } | null = null;
    let steps = 0;
    const evaluate = (used: number) => {
        const maxOf = new Array(used).fill(0);
        electives.forEach((l, i) => { maxOf[bin[i]] = Math.max(maxOf[bin[i]], l.lessons); });
        const lessons = maxOf.reduce((a, b) => a + b, 0);
        let fit = 0;
        for (const [, picks] of learners) if (new Set(picks.map(i => bin[i])).size === picks.length) fit++;
        let cohesion = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (bin[i] === bin[j] && kind[i] && kind[i] === kind[j]) cohesion++;
        if (!best || fit > best.fit || (fit === best.fit && (lessons < best.lessons || (lessons === best.lessons && cohesion > best.cohesion)))) {
            best = { bins: [...bin], fit, lessons, cohesion };
        }
    };
    const place = (i: number, used: number) => {
        if (++steps > 400_000) return;
        if (i === n) { evaluate(used); return; }
        const teacher = electives[i].teacherId;
        // Canonical order: a subject joins an open group or opens the next one.
        for (let b = 0; b < Math.min(used + 1, k); b++) {
            if (teacher && electives.some((l, j) => j < i && bin[j] === b && l.teacherId === teacher)) continue;
            bin[i] = b;
            place(i + 1, Math.max(used, b + 1));
            bin[i] = -1;
        }
    };
    place(0, 0);
    const chosen = best as { bins: number[] } | null;
    if (!chosen) return null;

    const used = Math.max(...chosen.bins) + 1;
    const groups: SubjectGroup<L>[] = Array.from({ length: used }, (_, b) => {
        const loads = electives.filter((_, i) => chosen.bins[i] === b);
        const kinds = new Set(loads.map(l => groupOf(l.subjectName)));
        const only = kinds.size === 1 ? [...kinds][0] : null;
        // Technical subjects and Business/languages are often offered as one option group.
        const applied = !only && [...kinds].every(k => k === 'technical' || k === 'languages');
        const label = only ? groupLabel(only) : applied ? 'Technical & Business' : `Group ${b + 1}`;
        return { label, loads, lessons: Math.max(...loads.map(l => l.lessons)) };
    });
    // Two groups of one kind ("Humanities", "Humanities") are told apart by number.
    const seen = new Map<string, number>();
    groups.forEach(g => seen.set(g.label, (seen.get(g.label) ?? 0) + 1));
    const nth = new Map<string, number>();
    groups.forEach(g => {
        if ((seen.get(g.label) ?? 0) < 2) return;
        const i = (nth.get(g.label) ?? 0) + 1;
        nth.set(g.label, i);
        g.label = `${g.label} ${i}`;
    });

    const unfit = learners.flatMap(([learnerId, picks]) => {
        for (let x = 0; x < picks.length; x++) for (let y = x + 1; y < picks.length; y++) {
            if (chosen.bins[picks[x]] === chosen.bins[picks[y]]) return [{ learnerId, subjects: [electives[picks[x]].subjectName, electives[picks[y]].subjectName] as [string, string] }];
        }
        return [];
    });
    return { groups, unfit };
}
