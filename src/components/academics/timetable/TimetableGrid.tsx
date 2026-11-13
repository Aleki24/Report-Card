"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Clock, Coffee, Flag, Lock, MoveRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, type TimetableConfig, type TimetableLesson } from '@/lib/timetable/config';
import { shortSubject, slotLines, subjectCode, subjectKey, type GridMode } from '@/lib/ops/forms/academics';
import { dayCells, gridRows, lessonsAt, rowRunsOn, subjectColours, type DayCell, type GridRow } from '@/lib/timetable/layout';
import { schoolWeekMinute } from '@/lib/dates';
import type { CellHint } from '@/lib/timetable/moves';

export type { GridMode };

interface Props {
    config: TimetableConfig;
    lessons: readonly TimetableLesson[];
    mode: GridMode;
    /** Editing: the lesson picked to move, and what a click on a cell does. */
    selectedId?: string | null;
    onCellClick?: (day: number, row: GridRow, lesson: TimetableLesson | null) => void;
    /** While a lesson is picked: each cell's move, to highlight where it can go. */
    hintAt?: (day: number, row: GridRow) => CellHint | null;
}

/**
 * One colour per subject, as a timetable board is coloured: a soft wash, a
 * strong edge and readable text in both themes. Full class strings so
 * Tailwind's scanner sees them.
 */
const SWATCHES = [
    { card: 'bg-sky-500/12 border-sky-500 text-sky-950 dark:text-sky-50', dot: 'bg-sky-500' },
    { card: 'bg-violet-500/12 border-violet-500 text-violet-950 dark:text-violet-50', dot: 'bg-violet-500' },
    { card: 'bg-emerald-500/12 border-emerald-500 text-emerald-950 dark:text-emerald-50', dot: 'bg-emerald-500' },
    { card: 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-50', dot: 'bg-amber-500' },
    { card: 'bg-rose-500/12 border-rose-500 text-rose-950 dark:text-rose-50', dot: 'bg-rose-500' },
    { card: 'bg-teal-500/12 border-teal-500 text-teal-950 dark:text-teal-50', dot: 'bg-teal-500' },
    { card: 'bg-orange-500/12 border-orange-500 text-orange-950 dark:text-orange-50', dot: 'bg-orange-500' },
    { card: 'bg-indigo-500/12 border-indigo-500 text-indigo-950 dark:text-indigo-50', dot: 'bg-indigo-500' },
    { card: 'bg-lime-500/15 border-lime-600 text-lime-950 dark:text-lime-50', dot: 'bg-lime-600' },
    { card: 'bg-fuchsia-500/12 border-fuchsia-500 text-fuchsia-950 dark:text-fuchsia-50', dot: 'bg-fuchsia-500' },
    { card: 'bg-cyan-500/12 border-cyan-500 text-cyan-950 dark:text-cyan-50', dot: 'bg-cyan-500' },
    { card: 'bg-pink-500/12 border-pink-500 text-pink-950 dark:text-pink-50', dot: 'bg-pink-500' },
] as const;
/** An option block: several subjects at once, so no one subject's colour. */
const BLOCK_SWATCH = { card: 'bg-slate-500/10 border-slate-400 border-dashed text-foreground', dot: 'bg-slate-400' } as const;

const HINT_TONE: Record<CellHint['state'], string> = {
    free: 'ring-2 ring-emerald-500/70 ring-inset',
    swap: 'ring-2 ring-sky-500/70 ring-inset',
    blocked: 'opacity-35',
};

const codeOf = (l: TimetableLesson) => subjectCode(l.subject?.name, l.subject?.code);

/** The school's weekday and minute, ticking each minute, for "today" and "now". */
function useSchoolNow() {
    const [now, setNow] = useState<{ day: number; minutes: number } | null>(null);
    useEffect(() => {
        const tick = () => setNow(schoolWeekMinute());
        tick();
        const id = window.setInterval(tick, 60_000);
        return () => window.clearInterval(id);
    }, []);
    return now;
}

type Swatch = (typeof SWATCHES)[number] | typeof BLOCK_SWATCH;

function LessonCard({ lessons, mode, swatch, selected, isNow, span, time }: {
    lessons: readonly TimetableLesson[]; mode: GridMode; swatch: Swatch; selected: boolean; isNow: boolean; span: number; time?: string;
}) {
    const unique = lessons.filter((l, i) => lessons.findIndex(x => x.subject_id === l.subject_id && x.teacher_id === l.teacher_id) === i);
    const [code, bottom] = slotLines(unique, mode);
    // A list (phones, today) has room for the subject's name; the week grid keeps to codes.
    const top = time && unique.length === 1 ? shortSubject(unique[0].subject?.name) : code;
    return (
        <div className={cn(
            'relative flex h-full flex-col justify-center gap-0.5 rounded-xl border-l-4 px-2.5 py-1.5 text-left transition-shadow',
            selected ? 'border-primary bg-primary text-primary-foreground' : swatch.card,
            isNow && !selected && 'shadow-md ring-2 ring-primary ring-offset-2 ring-offset-card',
        )}>
            <span className="flex items-center gap-1.5">
                {lessons.some(l => l.locked) && <Lock className="size-3 shrink-0" aria-label="Pinned" />}
                <span className="truncate text-sm font-bold tracking-tight">{top}</span>
                {span > 1 && <span className={cn('shrink-0 rounded-md px-1.5 text-[10px] font-semibold', selected ? 'bg-primary-foreground/20' : 'bg-background/70')}>Double</span>}
                {isNow && <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">Now</span>}
            </span>
            {bottom && <span className={cn('truncate text-[11px]', selected ? 'text-primary-foreground/80' : 'opacity-75')}>{bottom}</span>}
            {time && <span className={cn('text-[11px] tabular-nums', selected ? 'text-primary-foreground/80' : 'opacity-60')}>{time}</span>}
        </div>
    );
}

/** Today at a glance: the lesson on now and the one after it, or how long until the first. */
function NowNext({ cells, minutes, mode, swatchOf }: { cells: readonly DayCell[]; minutes: number; mode: GridMode; swatchOf: (here: readonly TimetableLesson[]) => Swatch }) {
    const taught = cells.filter(c => c.lessons.length > 0);
    const end = (c: DayCell) => c.rows[c.rows.length - 1].end;
    const current = taught.find(c => c.rows[0].start <= minutes && minutes < end(c)) ?? null;
    const next = taught.find(c => c.rows[0].start > minutes) ?? null;
    if (!current && !next) return null;
    const span = (c: DayCell) => `${c.rows[0].time.split('–')[0]}–${c.rows[c.rows.length - 1].time.split('–')[1]}`;
    const slot = (label: string, c: DayCell) => (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
            <div className="h-[4.25rem]"><LessonCard lessons={c.lessons} mode={mode} swatch={swatchOf(c.lessons)} selected={false} isNow={false} span={c.rows.length} time={span(c)} /></div>
        </div>
    );
    return (
        <section aria-label="Today" className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:flex-row sm:items-end sm:p-4">
            <div className="flex items-center gap-2 sm:w-36 sm:flex-col sm:items-start">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock className="size-4.5" aria-hidden /></span>
                <span className="text-sm font-semibold">Today</span>
            </div>
            {current ? slot('On now', current) : null}
            {next ? slot(current ? 'Next' : 'First up', next) : null}
        </section>
    );
}

type PhoneItem = (DayCell & { kind: 'cell' }) | { kind: 'activity'; key: string; label: string; time: string };

/**
 * A phone's day as a list: the periods that run, and an activity (Games) in
 * place of the lesson periods it takes, once for its whole time.
 */
function phoneItems(cells: readonly DayCell[], day: number): PhoneItem[] {
    const out: PhoneItem[] = [];
    for (const c of cells) {
        const row = c.rows[0];
        if (row.activity && rowRunsOn(row, day)) { out.push({ kind: 'activity', key: row.key, label: row.label, time: row.time }); continue; }
        if (rowRunsOn(row, day)) { out.push({ ...c, kind: 'cell' }); continue; }
        const label = row.taken?.[day];
        if (!label) continue;
        const last = out[out.length - 1];
        if (last?.kind === 'activity' && last.label === label) { last.time = `${last.time.split('–')[0]}–${row.time.split('–')[1]}`; continue; }
        out.push({ kind: 'activity', key: `${row.key}-${day}`, label, time: row.time });
    }
    return out;
}

/**
 * The week as a timetable board: each subject in its own colour, a double
 * one long card, today's row and the lesson on now marked. From `md` up the
 * whole week (days down, periods across, breaks as narrow columns); on phones
 * one day at a time as a list, so nothing scrolls sideways. A class shows its
 * section's bell; a teacher or room across sections shows each lesson time.
 * While a lesson is picked to move, cells show where it can go (doubles then
 * show as their two periods, each a place to click).
 */
export function TimetableGrid({ config, lessons, mode, selectedId, onCellClick, hintAt }: Props) {
    const now = useSchoolNow();
    const [phoneDay, setPhoneDay] = useState<number | null>(null);
    const rows = React.useMemo(() => gridRows(config, lessons), [config, lessons]);
    const codes = React.useMemo(() => subjectKey(lessons), [lessons]);
    const colours = React.useMemo(() => subjectColours(codes.map(c => c.code), SWATCHES.length), [codes]);
    const interactive = !!onCellClick;
    const today = now && config.days.includes(now.day) ? now.day : null;
    // Phones open on today, or the next school day after it.
    const shownDay = phoneDay ?? (now ? config.days.find(d => d >= now.day) ?? config.days[0] : config.days[0]);

    const swatchOf = (here: readonly TimetableLesson[]): Swatch => {
        const subjects = new Set(here.map(codeOf));
        return subjects.size > 1 ? BLOCK_SWATCH : SWATCHES[colours.get([...subjects][0]) ?? 0];
    };
    const cellsOf = (day: number): DayCell[] => (interactive
        ? rows.map(r => ({ rows: [r], lessons: r.isBreak || !rowRunsOn(r, day) ? [] : lessonsAt(config, lessons, day, r) }))
        : dayCells(config, lessons, day, rows));
    const isNow = (day: number, cell: DayCell) => !!now && now.day === day && cell.rows[0].start <= now.minutes && now.minutes < cell.rows[cell.rows.length - 1].end;

    const notRunning = (row: GridRow, day: number) => row.taken?.[day] ? (
        <span className="flex h-full min-h-12 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200" title={`${row.taken[day]} on ${WEEKDAY_NAMES[day]}`}>
            <Flag className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{row.taken[day]}</span>
        </span>
    ) : (
        <span className="flex h-full min-h-12 items-center justify-center rounded-xl bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_12px)] text-[10px] font-medium text-muted-foreground" title={`${row.label} does not run on ${WEEKDAY_NAMES[day]}`}>
            Not on {WEEKDAY_LABELS[day]}
        </span>
    );

    const cellBody = (day: number, cell: DayCell, withTime: boolean) => {
        const row = cell.rows[0];
        if (!rowRunsOn(row, day)) return notRunning(row, day);
        const here = cell.lessons;
        const lesson = here[0] ?? null;
        const hint = hintAt?.(day, row) ?? null;
        const selected = here.some(l => l.id === selectedId);
        const time = withTime ? `${row.time.split('–')[0]}–${cell.rows[cell.rows.length - 1].time.split('–')[1]}` : undefined;
        const content = lesson
            ? <LessonCard lessons={here} mode={mode} swatch={swatchOf(here)} selected={selected} isNow={isNow(day, cell)} span={cell.rows.length} time={time} />
            : hint?.state === 'free'
                ? <span className="flex h-full items-center justify-center gap-1 rounded-xl border border-dashed border-emerald-500/60 bg-emerald-500/8 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><MoveRight className="size-3.5" aria-hidden />Move here</span>
                : <span className={cn('flex h-full items-center rounded-xl px-2.5 text-xs text-muted-foreground/70', interactive ? 'border border-dashed border-border/60' : 'bg-muted/30')}>{withTime ? 'Free' : ''}</span>;
        if (!interactive) return <div className="h-full min-h-12">{content}</div>;
        const label = `${WEEKDAY_LABELS[day]} ${row.label}${lesson ? `: ${here.map(l => l.subject?.name ?? '').join(', ')}` : ': free'}${hint ? ` · ${hint.state === 'free' ? 'can move here' : hint.state === 'swap' ? 'can swap here' : hint.reason ?? 'cannot move here'}` : ''}`;
        return (
            <button
                type="button"
                onClick={() => onCellClick(day, row, lesson)}
                title={hint?.state === 'blocked' ? hint.reason : hint?.state === 'swap' ? 'Swap with this lesson' : undefined}
                className={cn('relative block h-full min-h-12 w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', hint && !selected && HINT_TONE[hint.state])}
                aria-label={label}
            >
                {content}
                {hint?.state === 'swap' && lesson && !selected && (
                    <span className="absolute top-1 right-1 rounded-md bg-sky-500 p-0.5 text-white" aria-hidden><ArrowLeftRight className="size-3" /></span>
                )}
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {!interactive && today && now && <NowNext cells={cellsOf(today)} minutes={now.minutes} mode={mode} swatchOf={swatchOf} />}

            {/* Phones: one day at a time */}
            <div className="md:hidden">
                <div role="tablist" aria-label="Day" className="mb-3 grid gap-1 rounded-2xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${config.days.length}, minmax(0, 1fr))` }}>
                    {config.days.map(d => (
                        <button key={d} type="button" role="tab" aria-selected={shownDay === d} onClick={() => setPhoneDay(d)}
                            className={cn('relative min-h-10 rounded-xl text-sm font-semibold transition-colors', shownDay === d ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                            {WEEKDAY_LABELS[d]}
                            {today === d && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" aria-label="Today" />}
                        </button>
                    ))}
                </div>
                <ol className="flex flex-col gap-2">
                    {phoneItems(cellsOf(shownDay), shownDay).map(c => c.kind === 'activity' ? (
                        <li key={c.key} className="flex min-h-12 items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                            <Flag className="size-4 shrink-0" aria-hidden />{c.label}
                            <span className="ml-auto text-xs font-medium tabular-nums opacity-75">{c.time}</span>
                        </li>
                    ) : c.rows[0].isBreak ? (
                        <li key={c.rows[0].key} className="flex items-center gap-2 px-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <Coffee className="size-3.5" aria-hidden />{c.rows[0].label}
                            <span className="h-px flex-1 bg-amber-500/30" aria-hidden />
                            <span className="tabular-nums">{c.rows[0].time}</span>
                        </li>
                    ) : (
                        <li key={c.rows[0].key} className={cn(c.rows.length > 1 ? 'min-h-24' : 'min-h-16')}>
                            {cellBody(shownDay, c, true)}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Tablets and up: the whole week, days down the side and periods across, as schools pin it up */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm md:block">
                <div className="grid min-w-[48rem] gap-x-1 p-2" style={{ gridTemplateColumns: `4rem ${rows.map(r => (r.isBreak && !r.activity ? '1.5rem' : 'minmax(5.5rem, 1fr)')).join(' ')}` }}>
                    <div />
                    {rows.map(r => r.isBreak && !r.activity ? <div key={r.key} aria-hidden /> : (
                        <div key={r.key} className="px-1 pb-2 text-center">
                            <span className="block text-xs font-semibold">{r.label}</span>
                            <span className="block text-[10px] text-muted-foreground tabular-nums">{r.time}</span>
                        </div>
                    ))}
                    {config.days.map((d, di) => (
                        <React.Fragment key={d}>
                            <div className={cn('flex items-center py-1', di > 0 && 'border-t border-border/40')}>
                                <span className={cn('rounded-lg px-2 py-1 text-sm font-semibold', today === d ? 'bg-primary text-primary-foreground' : 'text-foreground')} title={today === d ? 'Today' : WEEKDAY_NAMES[d]}>{WEEKDAY_LABELS[d]}</span>
                            </div>
                            {cellsOf(d).map(c => c.rows[0].activity ? (
                                <div key={c.rows[0].key} className={cn('h-[4.75rem] py-1', di > 0 && 'border-t border-border/40', today === d && 'bg-primary/[0.03]')}>
                                    {rowRunsOn(c.rows[0], d)
                                        ? <span className="flex h-full items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200"><span className="truncate">{c.rows[0].label}</span></span>
                                        : <span className="block h-full rounded-xl bg-muted/30" />}
                                </div>
                            ) : c.rows[0].isBreak ? (
                                <div key={c.rows[0].key} className={cn('relative my-1 rounded-md bg-amber-500/10', di > 0 && 'mt-2')} title={`${c.rows[0].label} · ${c.rows[0].time}`}>
                                    {di === 0 && <span className="absolute inset-x-0 top-2 mx-auto block w-fit text-[9px] font-semibold tracking-wider text-amber-700 uppercase [writing-mode:vertical-rl] dark:text-amber-300">{c.rows[0].label}</span>}
                                </div>
                            ) : (
                                <div key={c.rows[0].key} className={cn('h-[4.75rem] py-1', di > 0 && 'border-t border-border/40', today === d && 'bg-primary/[0.03]')} style={c.rows.length > 1 ? { gridColumn: `span ${c.rows.length}` } : undefined}>
                                    {cellBody(d, c, false)}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* What each subject code stands for, in its colour */}
            {codes.length > 0 && (
                <dl aria-label="Subject codes" className="flex flex-wrap gap-1.5">
                    {codes.map(c => (
                        <div key={c.code} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs">
                            <span className={cn('size-2.5 rounded-full', SWATCHES[colours.get(c.code) ?? 0].dot)} aria-hidden />
                            <dt className="font-bold">{c.code}</dt>
                            <dd className="text-muted-foreground">{c.name}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
