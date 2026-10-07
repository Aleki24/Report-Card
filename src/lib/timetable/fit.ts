/**
 * Two ready-made ways to make a class that does not fit its week fit, worked
 * out for the school so it only has to choose one:
 *
 * - a longer day: lessons added after the last period for the class's level
 *   only, every other class keeping its day;
 * - fewer lessons a week: the fewest cuts that make the week fit, taken from
 *   the subjects with the most lessons first, never below a floor.
 *
 * Pure, so the studio (web and app) shows exactly what the apply step does.
 */
import { BAND_LABELS, type CurriculumBand } from '../curriculum-bands';
import { hhmmOf, minutesOf, sectionFor, type TimetableConfig, type TimetablePeriod } from './config';

export interface FitLoad { id: string; subject: string; lessons: number }

/** The parts of a class's plan the fixes need. */
export interface FitClass {
    capacity: number;
    needed: number;
    core: readonly FitLoad[];
    blocks: readonly { lessons: number; loads: readonly FitLoad[] }[];
}

/** A planned class as the fixes see it. */
export const fitClassOf = (p: { capacity: number; needed: number; core: readonly { id: string; subjectName: string; lessons: number }[]; blocks: readonly { lessons: number; loads: readonly { id: string; subjectName: string; lessons: number }[] }[] }): FitClass => {
    const load = (l: { id: string; subjectName: string; lessons: number }) => ({ id: l.id, subject: l.subjectName, lessons: l.lessons });
    return { capacity: p.capacity, needed: p.needed, core: p.core.map(load), blocks: p.blocks.map(b => ({ lessons: b.lessons, loads: b.loads.map(load) })) };
};

export interface LessonCut { id: string; subject: string; from: number; to: number }

export interface LongerDay {
    /** Lessons added to each school day. */
    perDay: number;
    /** "16:00–16:40". */
    times: string[];
    /** Who the longer day is for: the level, or its classes ("Form 3 and Form 4"). */
    level: string;
}

export interface ClassFixes {
    longerDay: LongerDay | null;
    fewerLessons: LessonCut[] | null;
}

/** Compulsory subjects keep at least four lessons a week, others three. */
const floorOf = (subject: string) => (/english|kiswahili|math/i.test(subject) ? 4 : 3);

/**
 * The fewest one-lesson cuts that bring the week within its periods. A block
 * shortens when its longest subjects do; the subject (or block) with the most
 * lessons is cut first, electives before whole-class subjects on a tie.
 */
export function fewerLessons(c: FitClass): LessonCut[] | null {
    let over = c.needed - c.capacity;
    if (over <= 0) return [];
    const lessons = new Map<string, number>();
    [...c.core, ...c.blocks.flatMap(b => b.loads)].forEach(l => lessons.set(l.id, l.lessons));
    const valueOf = (ls: readonly FitLoad[]) => Math.max(...ls.map(l => lessons.get(l.id) ?? 0));
    const items = [
        ...c.blocks.map(b => ({ loads: b.loads, elective: true })),
        ...c.core.map(l => ({ loads: [l], elective: false })),
    ];
    while (over > 0) {
        const candidates = items
            .map(it => ({ it, value: valueOf(it.loads), floor: Math.max(...it.loads.map(l => floorOf(l.subject))) }))
            .filter(x => x.value > x.floor)
            .sort((a, b) => b.value - a.value || Number(b.it.elective) - Number(a.it.elective));
        const pick = candidates[0];
        if (!pick) return null;
        pick.it.loads.forEach(l => { if (lessons.get(l.id) === pick.value) lessons.set(l.id, pick.value - 1); });
        over--;
    }
    return [...c.core, ...c.blocks.flatMap(b => b.loads)]
        .filter(l => lessons.get(l.id) !== l.lessons)
        .map(l => ({ id: l.id, subject: l.subject, from: l.lessons, to: lessons.get(l.id) ?? l.lessons }));
}

/** Lessons appended after a bell's last period, each as long as its usual lesson. */
function extendedPeriods(periods: readonly TimetablePeriod[], extra: number): TimetablePeriod[] {
    const lessons = periods.filter(p => !p.is_break);
    const lengths = lessons.map(p => minutesOf(p.end) - minutesOf(p.start)).sort((a, b) => a - b);
    const length = lengths[Math.floor(lengths.length / 2)] ?? 40;
    let t = minutesOf(periods[periods.length - 1]?.end ?? '16:00');
    const added = Array.from({ length: extra }, (_, i) => {
        const p = { label: `P${lessons.length + i + 1}`, start: hhmmOf(t), end: hhmmOf(t + length), is_break: false };
        t += length;
        return p;
    });
    return [...periods, ...added];
}

/**
 * The school's day with this level given `extra` more lessons a day. A level
 * sharing its bell with others gets a bell of its own, copied from the shared
 * one, so nobody else's day changes.
 */
export function withLongerDay(config: TimetableConfig, band: CurriculumBand, extra: number): TimetableConfig {
    const current = sectionFor(config, band);
    const own = config.sections.find(s => s.id === current.id);
    if (own && own.bands.length === 1) {
        return { ...config, sections: config.sections.map(s => (s.id === own.id ? { ...s, periods: extendedPeriods(s.periods, extra) } : s)) };
    }
    const sections = config.sections.map(s => ({ ...s, bands: s.bands.filter(b => b !== band) })).filter(s => s.bands.length > 0);
    return {
        ...config,
        sections: [...sections, { id: `longer-${band}`.toLowerCase().slice(0, 40), name: BAND_LABELS[band], bands: [band], periods: extendedPeriods(current.periods, extra) }],
    };
}

/** How much longer this class's day must be to fit, as the times it would add. */
export function longerDay(config: TimetableConfig, band: CurriculumBand | null, c: FitClass): LongerDay | null {
    const over = c.needed - c.capacity;
    if (over <= 0 || !band || config.days.length === 0) return null;
    const perDay = Math.ceil(over / config.days.length);
    const before = sectionFor(config, band).periods.length;
    const added = sectionFor(withLongerDay(config, band, perDay), band).periods.slice(before);
    return { perDay, times: added.map(p => `${p.start}–${p.end}`), level: BAND_LABELS[band] };
}

export function classFixes(config: TimetableConfig, band: CurriculumBand | null, c: FitClass): ClassFixes {
    return { longerDay: longerDay(config, band, c), fewerLessons: fewerLessons(c) };
}
