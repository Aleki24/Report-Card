"use client";

import React from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { ACTIVITY_KINDS, ACTIVITY_LABELS, WEEKDAY_LABELS, type TimetableConfig } from '@/lib/timetable/config';
import {
    activityBells, activityLine, activityProblem, lessonsTakenBy, withActivityAdded, withActivityPatched, withActivityRemoved,
} from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

const chip = (on: boolean) => cn('min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted');

/**
 * Assembly, games and clubs on the school day: when each runs and for whom.
 * No lesson is timetabled in their time; one that falls inside the lessons
 * takes those periods on its days, and the editor says how many.
 */
export function ActivitiesEditor({ config, update }: { config: TimetableConfig; update: (fn: (c: TimetableConfig) => TimetableConfig) => void }) {
    const bells = activityBells(config);
    const activities = config.rules.activities;
    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Flag className="size-4 text-primary" aria-hidden />Assembly, games and clubs</h3>
                <p className="text-xs text-muted-foreground">They show on every timetable, and no lesson is put in their time. One inside the school day takes those lesson periods on its days.</p>
            </div>
            {activities.map(a => {
                const taken = lessonsTakenBy(config, a);
                const problem = activityProblem(a);
                const toggleDay = (d: number) => update(c => withActivityPatched(c, a.id, { days: a.days.includes(d) ? a.days.filter(x => x !== d) : [...a.days, d].sort((x, y) => x - y) }));
                const toggleBell = (id: string) => update(c => withActivityPatched(c, a.id, { section_ids: a.section_ids.includes(id) ? a.section_ids.filter(x => x !== id) : [...a.section_ids, id] }));
                return (
                    <article key={a.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-3 sm:p-4">
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">{a.label}</p>
                                <p className="text-xs text-muted-foreground">{activityLine(config, a)}</p>
                            </div>
                            <Button variant="ghost" size="icon" aria-label={`Remove ${a.label}`} onClick={() => update(c => withActivityRemoved(c, a.id))}><Trash2 className="text-destructive" /></Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <FormField label="Name" htmlFor={`${a.id}-label`}>
                                <InputField id={`${a.id}-label`} value={a.label} maxLength={40} onChange={e => update(c => withActivityPatched(c, a.id, { label: e.target.value }))} />
                            </FormField>
                            <FormField label="From" htmlFor={`${a.id}-start`}>
                                <InputField id={`${a.id}-start`} type="time" value={a.start} onChange={e => update(c => withActivityPatched(c, a.id, { start: e.target.value }))} />
                            </FormField>
                            <FormField label="To" htmlFor={`${a.id}-end`}>
                                <InputField id={`${a.id}-end`} type="time" value={a.end} onChange={e => update(c => withActivityPatched(c, a.id, { end: e.target.value }))} />
                            </FormField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Days</span>
                            <div className="flex flex-wrap gap-1.5">
                                {config.days.map(d => <button key={d} type="button" aria-pressed={a.days.includes(d)} className={chip(a.days.includes(d))} onClick={() => toggleDay(d)}>{WEEKDAY_LABELS[d]}</button>)}
                            </div>
                        </div>
                        {bells.length > 1 && (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Who</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button type="button" aria-pressed={a.section_ids.length === 0} className={chip(a.section_ids.length === 0)} onClick={() => update(c => withActivityPatched(c, a.id, { section_ids: [] }))}>Whole school</button>
                                    {bells.map(b => <button key={b.id} type="button" aria-pressed={a.section_ids.includes(b.id)} className={chip(a.section_ids.includes(b.id))} onClick={() => toggleBell(b.id)}>{b.name}</button>)}
                                </div>
                            </div>
                        )}
                        {problem
                            ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{problem}</p>
                            : taken.length > 0
                                ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">Takes {taken.map(t => `${t.lessons} lesson${t.lessons === 1 ? '' : 's'} a week from ${t.name}`).join(', ')}. Check those classes still fit in Subjects &amp; hours.</p>
                                : <p className="text-xs text-muted-foreground">Outside the lessons: no lesson time is lost.</p>}
                    </article>
                );
            })}
            <div className="flex flex-wrap gap-2">
                {ACTIVITY_KINDS.map(k => (
                    <Button key={k} variant={activities.length === 0 && k !== 'other' ? 'outline' : 'ghost'} size="sm" onClick={() => update(c => withActivityAdded(c, k))}>
                        <Plus />{k === 'other' ? 'Something else' : ACTIVITY_LABELS[k]}
                    </Button>
                ))}
            </div>
        </div>
    );
}
