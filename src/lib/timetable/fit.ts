/**
 * Two ready-made ways to make a class that does not fit its week fit, worked
 * out for the school so it only has to choose one:
 *
 * - a longer day: just the lessons the week is short, added for the class's
 *   level only (a Friday lesson for one, an extra lesson every day for five),
 *   every other class keeping its day;
 * - fewer lessons a week: the fewest cuts that make the week fit, taken from
 *   the subjects with the most lessons first, never below a floor.
 *
 * Pure, so the studio (web and app) shows exactly what the apply step does.
 */
import { BAND_LABELS, type CurriculumBand } from '../curriculum-bands';
import { ministryAllocation } from './allocations';
import { USUAL_LAST_END, daysLabel, hhmmOf, lessonLength, minutesOf, sectionFor, spreadDays, weeklyLessons, type TimetableConfig, type TimetablePeriod } from './config';

export interface FitLoad {
    id: string;
    subject: string;
    lessons: number;
    /** The Ministry's lessons a week for it at the class's level, when it sets one. */
    ministry?: number | null;
    /** `CORE` subjects are taught to the whole class; anything else is an elective. */
    subjectType?: string | null;
}

/** The parts of a class's plan the fixes need. */
export interface FitClass {
    capacity: number;
    needed: number;
    core: readonly FitLoad[];
    blocks: readonly { lessons: number; loads: readonly FitLoad[] }[];
}

/** A planned load as the fixes read it: its row, when there is one, names its level for the Ministry's figure. */
interface PlannedFitLoad {
    id: string;
    subjectName: string;
    lessons: number;
    subjectType?: string | null;
    row?: { subject?: { name: string | null; code?: string | null } | null; stream?: { grade?: { code: string | null; name_display: string | null } | null } | null };
}

/** A planned class as the fixes see it. */
export const fitClassOf = (p: { capacity: number; needed: number; core: readonly PlannedFitLoad[]; blocks: readonly { lessons: number; loads: readonly PlannedFitLoad[] }[] }): FitClass => {
    const load = (l: PlannedFitLoad): FitLoad => ({
        id: l.id, subject: l.subjectName, lessons: l.lessons, subjectType: l.subjectType ?? null,
        ministry: l.row?.subject ? ministryAllocation(l.row.stream?.grade ?? null, l.row.subject)?.lessons ?? null : null,
    });
    return { capacity: p.capacity, needed: p.needed, core: p.core.map(load), blocks: p.blocks.map(b => ({ lessons: b.lessons, loads: b.loads.map(load) })) };
};

export interface LessonCut { id: string; subject: string; from: number; to: number }

export interface LongerDay {
    /** Lessons added to the week. */
    extra: number;
    /** What changes in the bell: "P9 16:00–16:40 · Every day", "P9 15:20–16:00 · Fri". */
    changes: string[];
    /** Who the longer day is for: the level, or its classes ("Form 3 and Form 4"). */
    level: string;
}

/** Electives in fewer groups so the week fits, and the learners who must then change a subject. */
export interface FewerGroups {
    groups: { label: string; subjects: string[]; lessons: number }[];
    /** Learners (or offered combinations) with two subjects in one group. */
    unfit: { name: string; subjects: [string, string] }[];
    /** Suggested from the kinds of subject: no learner's choices are recorded to check them against. */
    guessed?: boolean;
}

export interface ClassFixes {
    longerDay: LongerDay | null;
    fewerLessons: LessonCut[] | null;
    /** Only for classes whose electives follow learners' choices. */
    fewerGroups?: FewerGroups | null;
}

/** The fewer-groups fix in words. */
export function fewerGroupsLines(f: FewerGroups): string[] {
    const pairs = new Map<string, number>();
    f.unfit.forEach(u => { const k = u.subjects.join(' and '); pairs.set(k, (pairs.get(k) ?? 0) + 1); });
    const who = [...pairs.entries()].map(([k, n]) => `${n} take${n === 1 ? 's' : ''} ${k}`).join(', ');
    const shared = f.groups.filter(g => g.subjects.length > 1).map(g => g.subjects.join(' / ')).join(' · ');
    if (f.guessed) {
        return [
            `Taught at the same time: ${shared}.`,
            'No subject choices are recorded for this class, so check each pair: a learner can take only one subject from each. Recording learners’ electives is the sure way.',
        ];
    }
    return [
        `Taught at the same time: ${shared}.`,
        f.unfit.length === 0 ? 'Every learner’s choices still fit.' : `${f.unfit.length} learner${f.unfit.length === 1 ? '' : 's'} must change one subject (${who}).`,
    ];
}

/** Lessons that are not examined: the first to give way after anything above the Ministry's figure. */
const NOT_EXAMINED = /physical education|^p\.?e\.?$|life skills|pastoral|\bppi\b|guidance|community service|\bict skills?\b|games|clubs|library/i;
/** The subjects every learner sits: never cut below four lessons. */
const COMPULSORY = /english|kiswahili|math/i;
/** How far below its usual figure a subject may be cut. */
const MOST_BELOW = 2;

/**
 * The gentlest one-lesson cuts that bring the week within its periods, the
 * way a deputy would make them:
 *
 * 1. anything above the Ministry's figure, back down to it;
 * 2. lessons that are not examined (PE, Life Skills), down to one;
 * 3. electives (a block shortens when its longest subjects do);
 * 4. whole-class subjects last.
 *
 * Within each, the subject with the most lessons first, and one cut each
 * before any subject gives a second. None goes more than `MOST_BELOW` under
 * its usual figure (the Ministry's, else the school's own), and English,
 * Kiswahili and Mathematics never under four.
 */
export function fewerLessons(c: FitClass): LessonCut[] | null {
    let over = c.needed - c.capacity;
    if (over <= 0) return [];
    const lessons = new Map<string, number>();
    [...c.core, ...c.blocks.flatMap(b => b.loads)].forEach(l => lessons.set(l.id, l.lessons));
    const valueOf = (ls: readonly FitLoad[]) => Math.max(...ls.map(l => lessons.get(l.id) ?? 0));
    const usual = (l: FitLoad) => Math.min(l.lessons, l.ministry ?? l.lessons);
    const floorOf = (l: FitLoad) => NOT_EXAMINED.test(l.subject.trim()) ? 1
        : Math.max(COMPULSORY.test(l.subject) ? 4 : 2, usual(l) - MOST_BELOW);
    const items = [
        ...c.blocks.map(b => ({ loads: b.loads, elective: true })),
        ...c.core.map(l => ({ loads: [l], elective: l.subjectType != null && l.subjectType !== 'CORE' })),
    ];
    /** What one more cut to an item costs the class: lower is gentler. */
    const harm = (it: (typeof items)[number], value: number) => {
        const longest = it.loads.filter(l => (lessons.get(l.id) ?? 0) === value);
        if (longest.every(l => l.ministry != null && value > l.ministry)) return 0;
        const cut = Math.max(...longest.map(l => l.lessons - value));
        const kind = longest.every(l => NOT_EXAMINED.test(l.subject.trim())) ? 1 : it.elective ? 3 : 6;
        return kind + cut * 4;
    };
    while (over > 0) {
        const candidates = items
            .map(it => ({ it, value: valueOf(it.loads) }))
            .filter(x => cuttable(x.it.loads, x.value))
            .map(x => ({ ...x, harm: harm(x.it, x.value) }))
            .sort((a, b) => a.harm - b.harm || b.value - a.value || Number(b.it.elective) - Number(a.it.elective));
        const pick = candidates[0];
        if (!pick) return null;
        pick.it.loads.forEach(l => { if (lessons.get(l.id) === pick.value) lessons.set(l.id, pick.value - 1); });
        over--;
    }
    return [...c.core, ...c.blocks.flatMap(b => b.loads)]
        .filter(l => lessons.get(l.id) !== l.lessons)
        .map(l => ({ id: l.id, subject: l.subject, from: l.lessons, to: lessons.get(l.id) ?? l.lessons }));

    /** Whether the item's longest subjects can each lose a lesson and stay at or above their floor. */
    function cuttable(loads: readonly FitLoad[], value: number) {
        return loads.filter(l => (lessons.get(l.id) ?? 0) === value).every(l => value - 1 >= floorOf(l));
    }
}

/**
 * A bell with up to `extra` more lessons a week: a period that runs on some
 * days only runs on more of them first, then new periods follow the last one,
 * each as long as the bell's usual lesson, the last on only the days it
 * takes. Never past `USUAL_LAST_END`: a school day in Kenya ends by 16:40.
 */
export function extendedPeriods(periods: readonly TimetablePeriod[], extra: number, schoolDays: readonly number[]): TimetablePeriod[] {
    const out = periods.map(p => ({ ...p }));
    let left = extra;
    for (let i = out.length - 1; i >= 0 && left > 0; i--) {
        const p = out[i];
        if (p.is_break || !p.days) continue;
        const missing = schoolDays.filter(d => !p.days!.includes(d));
        if (missing.length === 0) continue;
        const take = spreadDays(Math.min(left, missing.length), missing);
        const days = schoolDays.filter(d => p.days!.includes(d) || take.includes(d));
        out[i] = days.length === schoolDays.length ? { label: p.label, start: p.start, end: p.end, is_break: p.is_break } : { ...p, days };
        left -= take.length;
    }
    const length = lessonLength(periods);
    let t = minutesOf(periods[periods.length - 1]?.end ?? '16:00');
    let n = periods.filter(p => !p.is_break).length;
    const latest = minutesOf(USUAL_LAST_END);
    while (left > 0 && schoolDays.length > 0 && t + length <= latest) {
        const on = Math.min(left, schoolDays.length);
        out.push({ label: `P${++n}`, start: hhmmOf(t), end: hhmmOf(t + length), is_break: false, ...(on < schoolDays.length ? { days: spreadDays(on, schoolDays) } : {}) });
        t += length;
        left -= on;
    }
    return out;
}

/**
 * The school's day with `extra` more lessons a week for this level. A level
 * sharing its bell with others gets a bell of its own, copied from the shared
 * one, so nobody else's day changes.
 */
export function withLongerDay(config: TimetableConfig, band: CurriculumBand, extra: number): TimetableConfig {
    const current = sectionFor(config, band);
    const own = config.sections.find(s => s.id === current.id);
    if (own && own.bands.length === 1) {
        return { ...config, sections: config.sections.map(s => (s.id === own.id ? { ...s, periods: extendedPeriods(s.periods, extra, config.days) } : s)) };
    }
    const sections = config.sections.map(s => ({ ...s, bands: s.bands.filter(b => b !== band) })).filter(s => s.bands.length > 0);
    return {
        ...config,
        sections: [...sections, { id: `longer-${band}`.toLowerCase().slice(0, 40), name: BAND_LABELS[band], bands: [band], periods: extendedPeriods(current.periods, extra, config.days) }],
    };
}

/** What the longer day changes in a bell, period by period: "P9 15:20–16:00 · Fri". */
export function bellChanges(before: readonly TimetablePeriod[], after: readonly TimetablePeriod[], schoolDays: readonly number[]): string[] {
    return after.flatMap((p, i) => {
        const old = before[i];
        if (old && old.start === p.start && old.end === p.end && daysLabel(old.days, schoolDays) === daysLabel(p.days, schoolDays)) return [];
        return [`${p.label} ${p.start}–${p.end} · ${daysLabel(p.days, schoolDays)}`];
    });
}

/** How much longer this class's day must be to fit, as the lessons it would add. */
export function longerDay(config: TimetableConfig, band: CurriculumBand | null, c: FitClass): LongerDay | null {
    const over = c.needed - c.capacity;
    if (over <= 0 || !band || config.days.length === 0) return null;
    const before = sectionFor(config, band).periods;
    const after = sectionFor(withLongerDay(config, band, over), band).periods;
    // Only a fix if the week fits by 16:40; past that, fewer lessons or groups it is.
    if (weeklyLessons(after, config.days) - weeklyLessons(before, config.days) < over) return null;
    return { extra: over, changes: bellChanges(before, after, config.days), level: BAND_LABELS[band] };
}

/** The longer-day fix in words, for the studio on the web and in the app. */
export const longerDayLines = (day: LongerDay): string[] => [
    `${day.level} get ${day.extra} more lesson${day.extra === 1 ? '' : 's'} a week: ${day.changes.join('; ')}.`,
    'Every other class keeps its day. No lessons are cut.',
];

export function classFixes(config: TimetableConfig, band: CurriculumBand | null, c: FitClass): ClassFixes {
    return { longerDay: longerDay(config, band, c), fewerLessons: fewerLessons(c) };
}
