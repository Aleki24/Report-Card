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
 * A week grid from `md` up (periods down, days across); on phones one day at
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
                        <li key={r.key} className="rounded-lg bg-muted/60 px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">{r.label} · {r.time}</li>
                    ) : (
                        <li key={r.key} className="grid grid-cols-[4.5rem_1fr] items-stretch gap-2">
                            <span className="flex flex-col justify-center text-xs"><span className="font-semibold">{r.label}</span><span className="text-muted-foreground tabular-nums">{r.time}</span></span>
                            {cell(phoneDay, r)}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Tablets and up: the whole week */}
            <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
                <table className="w-full table-fixed border-collapse">
                    <thead>
                        <tr>
                            <th className="w-24 border-b border-border/60 px-2 py-2 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Period</th>
                            {config.days.map(d => (
                                <th key={d} className="border-b border-border/60 px-2 py-2 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{WEEKDAY_LABELS[d]}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => r.isBreak ? (
                            <tr key={r.key}>
                                <td colSpan={config.days.length + 1} className="bg-muted/40 px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">{r.label} · {r.time}</td>
                            </tr>
                        ) : (
                            <tr key={r.key}>
                                <td className="border-t border-border/40 px-2 py-1.5 align-middle text-xs">
                                    <span className="block font-semibold">{r.label}</span>
                                    <span className="text-muted-foreground tabular-nums">{r.time}</span>
                                </td>
                                {config.days.map(d => <td key={d} className="h-14 border-t border-l border-border/40 p-1 align-stretch">{cell(d, r)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
