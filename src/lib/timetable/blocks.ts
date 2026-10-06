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
    basis: 'choices' | 'subjects' | 'none';
    /** Learners with recorded choices, when the blocks rest on them. */
    learnersWithChoices: number;
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
    const finish = (core: L[]): ClassPlan<L> => {
        const needed = sum(core.map(l => l.lessons)) + sum(blocks.map(b => b.lessons));
        return { streamId, capacity, core, blocks, needed, fits: needed <= capacity, basis, learnersWithChoices: basis === 'choices' ? learners : 0 };
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
        basis = 'choices';
        for (const bin of colourByChoices(electives, choices)) blocks.push(block(next++, bin, false));
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
