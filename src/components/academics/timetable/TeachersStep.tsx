"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField, SelectField } from '@/components/ui/FormField';
import { errorText, opsFetch } from '@/lib/ops/client';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, type TeacherOff, type TimetableConfig } from '@/lib/timetable/config';
import { LIGHT_LOAD, isLightLoad, type TimetablePlan } from '@/lib/timetable/readiness';
import { dayParts, offLabel, offPhrase, schoolDaySpan, type DayPart } from '@/lib/timetable/away';
import { cn } from '@/lib/utils';

const CONFIG_URL = '/api/academics/timetable/config';

/** A time a teacher cannot teach, added in one line: the day and which part of it. */
function AddAway({ config, onAdd, onCancel }: { config: TimetableConfig; onAdd: (t: Omit<TeacherOff, 'teacher_id'>) => void; onCancel: () => void }) {
    const parts = dayParts(config);
    const [day, setDay] = useState(String(config.days[0] ?? 1));
    const [part, setPart] = useState<DayPart>('day');
    const span = schoolDaySpan(config);
    const [start, setStart] = useState(parts.afternoon.start);
    const [end, setEnd] = useState(span.end);
    const range = part === 'custom' ? { start, end } : parts[part];
    return (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/40 p-2.5">
            <div className="grid grid-cols-2 gap-2">
                <FormField label="Day" htmlFor="away-day"><SelectField id="away-day" value={day} placeholder={null} onChange={setDay} options={config.days.map(d => ({ id: String(d), label: WEEKDAY_NAMES[d] }))} /></FormField>
                <FormField label="When" htmlFor="away-part">
                    <SelectField id="away-part" value={part} placeholder={null} onChange={v => setPart(v as DayPart)} options={[
                        { id: 'day', label: 'Whole day' }, { id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'custom', label: 'Set times' },
                    ]} />
                </FormField>
                {part === 'custom' && <>
                    <FormField label="From" htmlFor="away-from"><InputField id="away-from" type="time" value={start} onChange={e => setStart(e.target.value)} /></FormField>
                    <FormField label="To" htmlFor="away-to"><InputField id="away-to" type="time" value={end} onChange={e => setEnd(e.target.value)} /></FormField>
                </>}
            </div>
            <p className="text-xs text-muted-foreground">Not timetabled on {offPhrase(config, { day: Number(day), ...range })}.</p>
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button size="sm" disabled={range.end <= range.start} onClick={() => onAdd({ day: Number(day), start: range.start, end: range.end })}>Add</Button>
            </div>
        </div>
    );
}

/**
 * Teachers: each one's week across every class and level against the periods
 * they can teach, and the times they cannot (a part-time teacher, a shared
 * BOM teacher, a deputy's admin morning). The generator never books a
 * teacher then; a move or a cover that would is refused.
 */
export function TeachersStep({ plan, config, onChange }: { plan: TimetablePlan; config: TimetableConfig; onChange: () => void }) {
    const [adding, setAdding] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [run, setRun] = useState(String(config.rules.max_consecutive));
    const awayOf = (id: string) => config.rules.teacher_off.filter(t => t.teacher_id === id);

    const saveAway = async (teacherId: string, times: Omit<TeacherOff, 'teacher_id'>[], message: string) => {
        setSaving(teacherId);
        try {
            await opsFetch(CONFIG_URL, { method: 'PATCH', json: { teacher_off: { teacher_ids: [teacherId], times: times.map(t => ({ ...t, teacher_id: teacherId })) } } });
            toast.success(message);
            setAdding(null);
            onChange();
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(null); }
    };
    const saveRun = async () => {
        try {
            await opsFetch(CONFIG_URL, { method: 'PATCH', json: { max_consecutive: Math.max(1, Math.min(12, Number(run) || 4)) } });
            toast.success('Saved.');
            onChange();
        } catch (err) { toast.error(errorText(err)); }
    };

    if (plan.teachers.length === 0) {
        return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No teacher has a teaching load yet. Import loads in Subjects &amp; hours first.</p>;
    }
    return (
        <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-5">
                <div>
                    <h3 className="text-sm font-semibold">No teacher is ever booked twice</h3>
                    <p className="text-sm text-muted-foreground">Add the times a teacher can’t teach.</p>
                </div>
                <div className="flex items-end gap-2">
                    <FormField label="Most lessons in a row" htmlFor="max-run" className="w-40"><InputField id="max-run" type="number" min={1} max={12} value={run} onChange={e => setRun(e.target.value)} /></FormField>
                    <Button variant="outline" onClick={() => void saveRun()} disabled={Number(run) === config.rules.max_consecutive}>Save</Button>
                </div>
            </section>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plan.teachers.map(t => {
                    const over = t.lessons > t.capacity;
                    const light = isLightLoad(t);
                    const away = awayOf(t.id);
                    return (
                        <li key={t.id} className={cn('flex flex-col rounded-2xl border bg-card p-3 shadow-sm', over ? 'border-rose-500/50' : light ? 'border-amber-500/40' : 'border-border/70')}>
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate font-semibold">{t.name}</span>
                                <span className={cn('shrink-0 text-sm tabular-nums', over ? 'font-semibold text-rose-600' : light ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{t.lessons} / {t.capacity}</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', over ? 'bg-rose-500' : light ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (t.lessons / Math.max(1, t.capacity)) * 100)}%` }} /></div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {over ? `${t.lessons - t.capacity} lessons more than they can teach` : light ? `A light week (under ${LIGHT_LOAD} lessons)` : `${t.capacity - t.lessons} free periods a week`}
                                {t.away > 0 ? ` · ${t.away} periods away` : ''}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{t.classes.join(' · ')}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {away.map((a, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/12 py-0.5 pr-1 pl-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                        <CalendarOff className="size-3" aria-hidden />{WEEKDAY_LABELS[a.day]} · {offLabel(config, a)}
                                        <button type="button" aria-label={`Remove ${WEEKDAY_NAMES[a.day]} ${offLabel(config, a)}`} disabled={saving === t.id}
                                            onClick={() => void saveAway(t.id, away.filter((_, j) => j !== i), `${t.name} can be timetabled then again.`)}
                                            className="rounded p-0.5 hover:bg-amber-500/20"><X className="size-3" /></button>
                                    </span>
                                ))}
                                {adding !== t.id && <Button size="xs" variant="ghost" onClick={() => setAdding(t.id)}><Plus />Time away</Button>}
                            </div>
                            {adding === t.id && (
                                <AddAway config={config} onCancel={() => setAdding(null)}
                                    onAdd={a => void saveAway(t.id, [...away, a], `${t.name} will not be timetabled on ${offPhrase(config, a)}.`)} />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
