"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, type TimetableConfig, type TimetableLesson } from '@/lib/timetable/config';
import { personName } from '@/lib/ops/format';

export type GridMode = 'class' | 'teacher' | 'room';

interface Props {
    config: TimetableConfig;
    lessons: readonly TimetableLesson[];
    mode: GridMode;
    /** Editing: the lesson picked to move, and what a click on a cell does. */
    selectedId?: string | null;
    onCellClick?: (day: number, period: number, lesson: TimetableLesson | null) => void;
}

/** What a cell shows depends on whose timetable it is. */
function cellLines(l: TimetableLesson, mode: GridMode): [string, string] {
    const subject = l.subject?.code || l.subject?.name || 'Lesson';
    if (mode === 'class') return [subject, [l.teacher ? personName(l.teacher) : '', l.room?.name ?? ''].filter(Boolean).join(' · ')];
    if (mode === 'teacher') return [subject, [l.stream?.full_name ?? '', l.room?.name ?? ''].filter(Boolean).join(' · ')];
    return [subject, [l.stream?.full_name ?? '', l.teacher ? personName(l.teacher) : ''].filter(Boolean).join(' · ')];
}

function LessonCell({ lesson, mode, selected }: { lesson: TimetableLesson; mode: GridMode; selected: boolean }) {
    const [top, bottom] = cellLines(lesson, mode);
    return (
        <div className={cn('flex h-full flex-col justify-center rounded-lg px-2 py-1.5 text-left', selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10')}>
            <span className="flex items-center gap-1 truncate text-xs font-semibold">
                {lesson.locked && <Lock className="size-3 shrink-0" aria-label="Pinned" />}
                {top}
            </span>
            {bottom && <span className={cn('truncate text-[10px]', selected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{bottom}</span>}
        </div>
    );
}

/**
 * A week grid from `md` up (periods down, days across); on phones one day at
 * a time, so nothing scrolls sideways.
 */
export function TimetableGrid({ config, lessons, mode, selectedId, onCellClick }: Props) {
    const [phoneDay, setPhoneDay] = useState(config.days[0]);
    const at = (day: number, period: number) => lessons.find(l => l.day === day && l.period === period) ?? null;
    const interactive = !!onCellClick;

    const cell = (day: number, period: number) => {
        const lesson = at(day, period);
        const content = lesson ? <LessonCell lesson={lesson} mode={mode} selected={lesson.id === selectedId} /> : <span className="block h-full rounded-lg border border-dashed border-border/60" />;
        return interactive ? (
            <button type="button" onClick={() => onCellClick(day, period, lesson)} className="block h-full min-h-12 w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${WEEKDAY_LABELS[day]} ${config.periods[period]?.label ?? ''}${lesson ? `: ${lesson.subject?.name ?? ''}` : ': free'}`}>
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
                    {config.periods.map((p, i) => p.is_break ? (
                        <li key={i} className="rounded-lg bg-muted/60 px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground">{p.label} · {p.start}–{p.end}</li>
                    ) : (
                        <li key={i} className="grid grid-cols-[4.5rem_1fr] items-stretch gap-2">
                            <span className="flex flex-col justify-center text-xs"><span className="font-semibold">{p.label}</span><span className="text-muted-foreground tabular-nums">{p.start}</span></span>
                            {cell(phoneDay, i)}
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
                        {config.periods.map((p, i) => p.is_break ? (
                            <tr key={i}>
                                <td colSpan={config.days.length + 1} className="bg-muted/40 px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">{p.label} · {p.start}–{p.end}</td>
                            </tr>
                        ) : (
                            <tr key={i}>
                                <td className="border-t border-border/40 px-2 py-1.5 align-middle text-xs">
                                    <span className="block font-semibold">{p.label}</span>
                                    <span className="text-muted-foreground tabular-nums">{p.start}–{p.end}</span>
                                </td>
                                {config.days.map(d => <td key={d} className="h-14 border-t border-l border-border/40 p-1 align-stretch">{cell(d, i)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
