/**
 * The parts of a school day a teacher can be away for, in the school's own
 * times: the whole day, the morning (until lunch) or the afternoon (after
 * it). Shared by the studio on the web and in the app. Client-safe.
 */
import { hhmmOf, minutesOf, type TeacherOff, type TimetableConfig, type TimetablePeriod } from './config';

export type DayPart = 'day' | 'morning' | 'afternoon' | 'custom';

type Range = { start: string; end: string };

/** Every bell the school runs: the main day and each section's. */
const bells = (config: TimetableConfig): readonly (readonly TimetablePeriod[])[] =>
    [config.periods, ...config.sections.map(s => s.periods)].filter(b => b.length > 0);

/**
 * A time away for each part of the day, as stored: open-ended, so a day made
 * longer later is still covered. The morning runs until the main bell's lunch
 * (its longest break), the afternoon from its end.
 */
export function dayParts(config: TimetableConfig): Record<Exclude<DayPart, 'custom'>, Range> {
    const breaks = config.periods.filter(p => p.is_break);
    const lunch = [...breaks].sort((a, b) => (minutesOf(b.end) - minutesOf(b.start)) - (minutesOf(a.end) - minutesOf(a.start)))[0];
    const noon = lunch ?? { start: '12:40', end: '14:00' };
    return { day: { start: '00:00', end: '23:59' }, morning: { start: '00:00', end: noon.start }, afternoon: { start: noon.end, end: '23:59' } };
}

/** The school's whole day across every bell: earliest start to latest end. */
export function schoolDaySpan(config: TimetableConfig): Range {
    const all = bells(config);
    if (all.length === 0) return { start: '08:00', end: '16:00' };
    return { start: hhmmOf(Math.min(...all.map(b => minutesOf(b[0].start)))), end: hhmmOf(Math.max(...all.map(b => minutesOf(b[b.length - 1].end)))) };
}

/** "Whole day", "Morning", "Afternoon", "From 13:00", "Until 10:00" or the times: how a time away reads on a teacher's card. */
export function offLabel(config: TimetableConfig, off: Pick<TeacherOff, 'start' | 'end'>): string {
    const parts = dayParts(config);
    const span = schoolDaySpan(config);
    const fromStart = minutesOf(off.start) <= minutesOf(span.start);
    const toEnd = minutesOf(off.end) >= minutesOf(span.end);
    if (fromStart && toEnd) return 'Whole day';
    if (fromStart) return off.end === parts.morning.end ? 'Morning' : `Until ${off.end}`;
    if (toEnd) return off.start === parts.afternoon.start ? 'Afternoon' : `From ${off.start}`;
    return `${off.start}–${off.end}`;
}
