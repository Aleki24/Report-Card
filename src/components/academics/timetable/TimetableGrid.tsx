"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, type TimetableConfig, type TimetableLesson } from '@/lib/timetable/config';
import { slotLines, type GridMode } from '@/lib/ops/forms/academics';
import { gridRows, lessonsAt, type GridRow } from '@/lib/timetable/layout';

export type { GridMode };

interface Props {
    config: TimetableConfig;
    lessons: readonly TimetableLesson[];
    mode: GridMode;
    /** Editing: the lesson picked to move, and what a click on a cell does. */
    selectedId?: string | null;
    onCellClick?: (day: number, row: GridRow, lesson: TimetableLesson | null) => void;
}

function LessonCell({ lessons, mode, selected }: { lessons: readonly TimetableLesson[]; mode: GridMode; selected: boolean }) {
    const [top, bottom] = slotLines(lessons, mode);
    const block = lessons.length > 1;
    return (
        <div className={cn('flex h-full flex-col justify-center rounded-lg px-2 py-1.5 text-left', selected ? 'bg-primary text-primary-foreground' : block ? 'bg-violet-500/12 ring-1 ring-violet-500/25' : 'bg-primary/10')}>
            <span className="flex items-center gap-1 truncate text-xs font-semibold">
                {lessons.some(l => l.locked) && <Lock className="size-3 shrink-0" aria-label="Pinned" />}
                {top}
            </span>
            {bottom && <span className={cn('truncate text-[10px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{bottom}</span>}
        </div>
    );
}

/**
 * A week grid from `md` up (days down, periods across, breaks as shaded
 * columns); on phones one day at
 * a time, so nothing scrolls sideways. A class shows its section's bell; a
 * teacher or room teaching across sections shows each lesson time.
 */
export function TimetableGrid({ config, lessons, mode, selectedId, onCellClick }: Props) {
    const [phoneDay, setPhoneDay] = useState(config.days[0]);
    const rows = React.useMemo(() => gridRows(config, lessons), [config, lessons]);
    const interactive = !!onCellClick;

    const cell = (day: number, row: GridRow) => {
        const here = lessonsAt(config, lessons, day, row);
        const lesson = here[0] ?? null;
        const content = lesson ? <LessonCell lessons={here} mode={mode} selected={here.some(l => l.id === selectedId)} /> : <span className="block h-full rounded-lg border border-dashed border-border/60" />;
        return interactive ? (
            <button type="button" onClick={() => onCellClick(day, row, lesson)} className="block h-full min-h-12 w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${WEEKDAY_LABELS[day]} ${row.label}${lesson ? `: ${here.map(l => l.subject?.name ?? '').join(', ')}` : ': free'}`}>
                {content}
            </button>
        ) : <div className="h-full min-h-12">{content}</div>;
    };

    return (
        <>
            {/* Phones: one day at a time */}
            <div className="md:hidden">
                <div role="tablist" aria-label="Day" className="mb-3 flex gap-1 overflow-x-auto">
                    {config.days.map(d => (
                        <button key={d} type="button" role="tab" aria-selected={phoneDay === d} onClick={() => setPhoneDay(d)}
                            className={cn('min-h-10 rounded-xl px-3 text-sm font-medium', phoneDay === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                            {WEEKDAY_LABELS[d]}
                        </button>
                    ))}
                </div>
                <ol className="flex flex-col gap-2">
                    {rows.map(r => r.isBreak ? (
                        <li key={r.key} className="rounded-lg bg-amber-500/12 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-800 dark:text-amber-200">{r.label} · {r.time}</li>
                    ) : (
                        <li key={r.key} className="grid grid-cols-[4.5rem_1fr] items-stretch gap-2">
                            <span className="flex flex-col justify-center text-xs"><span className="font-semibold">{r.label}</span><span className="text-muted-foreground tabular-nums">{r.time}</span></span>
                            {cell(phoneDay, r)}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Tablets and up: the whole week, days down the side and periods across, as schools pin it up */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm md:block">
                <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: `5.5rem ${rows.map(r => (r.isBreak ? '1.75rem' : 'minmax(6.5rem, 1fr)')).join(' ')}` }}>
                    <div className="border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Day</div>
                    {rows.map(r => r.isBreak ? (
                        <div key={r.key} className="border-b border-l border-border/60 bg-amber-500/15" aria-hidden />
                    ) : (
                        <div key={r.key} className="border-b border-l border-border/60 bg-muted/40 px-2 py-2 text-center">
                            <span className="block text-xs font-semibold">{r.label}</span>
                            <span className="block text-[10px] text-muted-foreground tabular-nums">{r.time}</span>
                        </div>
                    ))}
                    {config.days.map((d, di) => (
                        <React.Fragment key={d}>
                            <div className={cn('flex items-center px-3 text-sm font-semibold', di > 0 && 'border-t border-border/40')}>{WEEKDAY_LABELS[d]}</div>
                            {rows.map(r => r.isBreak ? (
                                <div key={r.key} className={cn('relative border-l border-border/40 bg-amber-500/10', di > 0 && 'border-t border-amber-500/10')}>
                                    {di === 0 && <span className="absolute inset-x-0 top-2 mx-auto block w-fit text-[9px] font-semibold tracking-wider text-amber-700 uppercase [writing-mode:vertical-rl] dark:text-amber-300">{r.label}</span>}
                                </div>
                            ) : (
                                <div key={r.key} className={cn('h-16 border-l border-border/40 p-1', di > 0 && 'border-t')}>{cell(d, r)}</div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </>
    );
}
