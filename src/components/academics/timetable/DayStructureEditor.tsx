"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock3, Layers, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { errorText, opsFetch } from '@/lib/ops/client';
import { BAND_LABELS } from '@/lib/curriculum-bands';
import {
    CURRICULUM_BANDS, WEEKDAYS, WEEKDAY_LABELS, buildDay, lessonLength, minutesOf, runsOn, withDayStart, withLessonLength, withPeriodRetimed,
    type TimetableConfig, type TimetablePeriod,
} from '@/lib/timetable/config';
import {
    PERIOD_KINDS, SECTIONS_NOTE, activityProblem, bellOrderProblem, bellSummary, openSectionPresets, periodKind, periodKindMismatch, quickDayOf,
    withAddedPeriodTo, withPeriodDayToggled, withPeriodPatched, withSectionAdded, withSectionBandToggled, withSectionPatched, withSectionRemoved,
    type QuickDay,
} from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';
import { ActivitiesEditor } from './ActivitiesEditor';

const URL = '/api/academics/timetable/config';

const chip = (on: boolean) => cn('min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted');

/** The quick way to set a bell: when it starts, how long lessons are, how many, and where the breaks fall. */
function QuickSetup({ periods, onBuild }: { periods: readonly TimetablePeriod[]; onBuild: (next: TimetablePeriod[]) => void }) {
    const [form, setForm] = useState<QuickDay>(() => quickDayOf(periods));
    const set = <K extends keyof QuickDay>(k: K, v: QuickDay[K]) => setForm(f => ({ ...f, [k]: v }));
    const setBreak = (i: number, patch: Partial<QuickDay['breaks'][number]>) => set('breaks', form.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const preview = buildDay(form);
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
            <div className="grid grid-cols-3 gap-2">
                <FormField label="Day starts" htmlFor="qd-start"><InputField id="qd-start" type="time" value={form.start} onChange={e => set('start', e.target.value)} /></FormField>
                <FormField label="Lesson (min)" htmlFor="qd-len"><InputField id="qd-len" type="number" min={20} max={90} value={form.lessonMinutes} onChange={e => set('lessonMinutes', Number(e.target.value) || 40)} /></FormField>
                <FormField label="Lessons a day" htmlFor="qd-n"><InputField id="qd-n" type="number" min={1} max={14} value={form.lessons} onChange={e => set('lessons', Math.max(1, Math.min(14, Number(e.target.value) || 1)))} /></FormField>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Breaks</p>
                {form.breaks.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_5.5rem_5.5rem_auto] items-end gap-2">
                        <FormField label="Name" htmlFor={`qd-b${i}-name`}><InputField id={`qd-b${i}-name`} value={b.label} onChange={e => setBreak(i, { label: e.target.value })} /></FormField>
                        <FormField label="After lesson" htmlFor={`qd-b${i}-after`}><InputField id={`qd-b${i}-after`} type="number" min={1} max={13} value={b.after} onChange={e => setBreak(i, { after: Number(e.target.value) || 1 })} /></FormField>
                        <FormField label="Minutes" htmlFor={`qd-b${i}-min`}><InputField id={`qd-b${i}-min`} type="number" min={5} max={120} value={b.minutes} onChange={e => setBreak(i, { minutes: Number(e.target.value) || 10 })} /></FormField>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${b.label}`} onClick={() => set('breaks', form.breaks.filter((_, j) => j !== i))}><Trash2 className="text-destructive" /></Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" className="self-start" onClick={() => set('breaks', [...form.breaks, { after: Math.min(form.lessons - 1, (form.breaks.at(-1)?.after ?? 0) + 2), minutes: 10, label: 'Break' }])}><Plus />Break</Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Builds {form.lessons} lessons of {form.lessonMinutes} minutes, {preview[0]?.start}–{preview.at(-1)?.end}.</p>
                <Button size="sm" onClick={() => onBuild(preview)}><Wand2 />Build this day</Button>
            </div>
        </div>
    );
}

/**
 * A period row's layout: on phones the name, then the times, then the days;
 * with more room the days go under the rest; on a wide screen one line, under
 * column heads. Grid areas keep the inputs in reading order for keyboards.
 */
const PERIOD_GRID = [
    "grid items-end gap-2 grid-cols-[minmax(0,1fr)_7.5rem_minmax(2.25rem,auto)] [grid-template-areas:'name_kind_del'_'start_end_len'_'days_days_days']",
    "@2xl:grid-cols-[minmax(6rem,1fr)_7.5rem_7.5rem_3.5rem_8.5rem_2.25rem] @2xl:[grid-template-areas:'name_start_end_len_kind_del'_'days_days_days_days_days_days']",
    "@4xl:grid-cols-[8rem_7.5rem_7.5rem_3.5rem_8.5rem_minmax(0,1fr)_2.25rem] @4xl:[grid-template-areas:'name_start_end_len_kind_days_del']",
].join(' ');

/** A field's label: shown until the column heads are (wide screens), then for screen readers only. */
const CELL_LABEL = 'text-[11px] font-medium text-muted-foreground @4xl:sr-only';

interface PeriodRowProps {
    id: string;
    period: TimetablePeriod;
    schoolDays: readonly number[];
    onLabel: (label: string) => void;
    onRetime: (patch: { start?: string; end?: string }) => void;
    onKind: (isBreak: boolean) => void;
    onToggleDay: (day: number) => void;
    onRemove: () => void;
}

/** One period or break: its name, times, length, kind and the days it runs. */
function PeriodRow({ id, period: p, schoolDays, onLabel, onRetime, onKind, onToggleDay, onRemove }: PeriodRowProps) {
    const minutes = minutesOf(p.end) - minutesOf(p.start);
    const allDays = schoolDays.every(d => runsOn(p, d));
    const mismatch = periodKindMismatch(p);
    return (
        <li className={cn('px-3 py-2.5', p.is_break && 'bg-amber-500/[0.07]')}>
            <div className={PERIOD_GRID}>
                <label className="min-w-0 [grid-area:name]">
                    <span className="sr-only">Period name</span>
                    <InputField id={`${id}-label`} value={p.label} onChange={e => onLabel(e.target.value)} className="h-9 px-2.5 font-medium" />
                </label>
                <label className="flex flex-col gap-1 [grid-area:start]">
                    <span className={CELL_LABEL}>Starts</span>
                    <InputField id={`${id}-start`} type="time" value={p.start} onChange={e => e.target.value && onRetime({ start: e.target.value })} className="h-9 w-[7.5rem] px-2.5" />
                </label>
                <label className="flex flex-col gap-1 [grid-area:end]">
                    <span className={CELL_LABEL}>Ends</span>
                    <InputField id={`${id}-end`} type="time" value={p.end} onChange={e => e.target.value && onRetime({ end: e.target.value })} className="h-9 w-[7.5rem] px-2.5" />
                </label>
                <span className="flex flex-col gap-1 [grid-area:len]">
                    <span className={CELL_LABEL} aria-hidden>Length</span>
                    <span className="flex h-9 items-center text-xs whitespace-nowrap text-muted-foreground tabular-nums">{minutes > 0 ? `${minutes} min` : '—'}</span>
                </span>
                <div role="radiogroup" aria-label={`${p.label}: lesson or break`} className="flex h-9 overflow-hidden rounded-lg border border-border text-sm [grid-area:kind]">
                    {PERIOD_KINDS.map(k => {
                        const on = periodKind(p) === k.value;
                        return (
                            <button key={k.value} type="button" role="radio" aria-checked={on} onClick={() => onKind(k.value === 'break')}
                                className={cn('flex-1 font-medium transition-colors', on ? (k.value === 'break' ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:bg-muted')}>
                                {k.label}
                            </button>
                        );
                    })}
                </div>
                <div role="group" aria-label={`${p.label}: days it runs`} className="flex flex-wrap items-center gap-1.5 [grid-area:days]">
                    <span className="mr-1 text-xs font-medium text-muted-foreground @4xl:sr-only">{allDays ? 'Every day' : 'Only on'}</span>
                    {schoolDays.map(d => (
                        <button key={d} type="button" aria-pressed={runsOn(p, d)} onClick={() => onToggleDay(d)} className={cn(chip(runsOn(p, d)), 'px-2')}>
                            {WEEKDAY_LABELS[d]}
                        </button>
                    ))}
                </div>
                <Button variant="ghost" size="icon" aria-label={`Remove ${p.label}`} onClick={onRemove} className="size-9 [grid-area:del]"><Trash2 className="text-destructive" /></Button>
            </div>
            {mismatch && <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">{mismatch}</p>}
        </li>
    );
}

/**
 * One bell: its periods and breaks with their times. Changing a time moves
 * every later period with it; a period can run on some days only (a Friday
 * ninth lesson, afternoons off for games on Wednesday).
 */
function BellEditor({ id, periods, schoolDays, onChange }: { id: string; periods: readonly TimetablePeriod[]; schoolDays: readonly number[]; onChange: (next: TimetablePeriod[]) => void }) {
    const confirm = useConfirm();
    const [quick, setQuick] = useState(periods.length === 0);
    const [length, setLength] = useState(String(lessonLength(periods)));
    const [start, setStart] = useState(periods[0]?.start ?? '08:00');
    const problem = bellOrderProblem(periods);
    const rebuild = async (next: TimetablePeriod[]) => {
        if (periods.length > 0 && !(await confirm({ title: 'Replace this day?', message: 'Its periods and breaks are replaced by the new ones. Generate the timetable again afterwards.', confirmText: 'Replace' }))) return;
        onChange(next);
        setQuick(false);
    };
    const retime = (i: number, patch: { start?: string; end?: string }) => {
        const next = withPeriodRetimed(periods, i, patch);
        onChange(next[next.length - 1] && minutesOf(next[next.length - 1].end) <= 24 * 60 - 1 ? next : withPeriodPatched(periods, i, patch));
    };
    return (
        <div className="@container flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl bg-muted/50 px-3 py-2 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                <p className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4 shrink-0 text-primary" aria-hidden />{bellSummary(periods, schoolDays)}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Starts
                        <InputField aria-label="Day starts at" type="time" value={start} onChange={e => setStart(e.target.value)} className="h-8 w-[7rem] px-2.5 text-xs" />
                    </label>
                    <Button size="xs" variant="outline" onClick={() => /^\d{2}:\d{2}$/.test(start) && onChange(withDayStart(periods, start))} disabled={periods.length === 0 || start === periods[0]?.start}>Move day</Button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Lessons of
                        <InputField aria-label="Lesson length in minutes" type="number" min={20} max={90} value={length} onChange={e => setLength(e.target.value)} className="h-8 w-16 px-2.5 text-xs" />
                        min
                    </label>
                    <Button size="xs" variant="outline" onClick={() => onChange(withLessonLength(periods, Number(length) || 40))} disabled={periods.length === 0 || Number(length) === lessonLength(periods)}>Apply</Button>
                    <Button size="xs" variant={quick ? 'default' : 'outline'} onClick={() => setQuick(q => !q)}><Sparkles />Quick setup</Button>
                </div>
            </div>
            {quick && <QuickSetup periods={periods} onBuild={next => void rebuild(next)} />}
            {problem && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{problem} Fix the times before saving.</p>}
            {periods.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border/70">
                    <div aria-hidden className={cn(PERIOD_GRID, 'hidden border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase @4xl:grid')}>
                        <span className="[grid-area:name]">Period</span>
                        <span className="[grid-area:start]">Starts</span>
                        <span className="[grid-area:end]">Ends</span>
                        <span className="[grid-area:len]">Length</span>
                        <span className="[grid-area:kind]">Lesson or break</span>
                        <span className="[grid-area:days]">Days it runs</span>
                    </div>
                    <ol className="divide-y divide-border/60">
                        {periods.map((p, i) => (
                            <PeriodRow
                                key={i}
                                id={`${id}-${i}`}
                                period={p}
                                schoolDays={schoolDays}
                                onLabel={label => onChange(withPeriodPatched(periods, i, { label }))}
                                onRetime={patch => retime(i, patch)}
                                onKind={is_break => onChange(withPeriodPatched(periods, i, { is_break }))}
                                onToggleDay={d => onChange(withPeriodDayToggled(periods, i, d, schoolDays))}
                                onRemove={() => onChange(periods.filter((_, j) => j !== i))}
                            />
                        ))}
                    </ol>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onChange(withAddedPeriodTo(periods, false))}><Plus />Lesson period</Button>
                <Button variant="outline" size="sm" onClick={() => onChange(withAddedPeriodTo(periods, true))}><Plus />Break</Button>
            </div>
        </div>
    );
}

/** The school day: which weekdays run, the main bell, and sections with their own bells. */
export function DayStructureEditor({ onSaved }: { onSaved?: () => void } = {}) {
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    // Bumped on each load, so the bells' own fields start again from the saved day.
    const [rev, setRev] = useState(0);

    const load = useCallback(() => {
        opsFetch<TimetableConfig>(URL).then(c => { setConfig(c); setDirty(false); setRev(r => r + 1); }).catch(err => toast.error(errorText(err)));
    }, []);
    useEffect(load, [load]);

    if (!config) return <div className="skeleton-bone h-64 rounded-2xl" />;

    const update = (fn: (c: TimetableConfig) => TimetableConfig) => { setConfig(c => c && fn(c)); setDirty(true); };
    const problem = [config.periods, ...config.sections.map(s => s.periods)].map(bellOrderProblem).find(Boolean)
        ?? config.rules.activities.map(activityProblem).find(Boolean);

    const save = async () => {
        setSaving(true);
        try { setConfig(await opsFetch<TimetableConfig>(URL, { method: 'PUT', json: config })); setDirty(false); toast.success('School day saved.'); onSaved?.(); }
        catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const presets = openSectionPresets(config);

    return (
        <section className="flex flex-col gap-6">
            <div>
                <h3 className="text-sm font-semibold">School days</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => {
                        const on = config.days.includes(d);
                        return (
                            <button key={d} type="button" aria-pressed={on} className={cn(chip(on), 'min-h-10 px-3 text-sm')}
                                onClick={() => update(c => ({ ...c, days: on ? c.days.filter(x => x !== d) : [...c.days, d].sort() }))}>
                                {WEEKDAY_LABELS[d]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold">{config.sections.length > 0 ? 'Main school day' : 'Periods and breaks'}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{config.sections.length > 0 ? 'For classes in no section below. ' : ''}Change a time and every later period moves with it. Untick a day to run a period only on some days, e.g. a ninth lesson on Friday.</p>
                <BellEditor key={`main-${rev}`} id="main" periods={config.periods} schoolDays={config.days} onChange={periods => update(c => ({ ...c, periods }))} />
            </div>

            <div className="flex flex-col gap-3">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4 text-primary" aria-hidden />Levels with their own bell</h3>
                    <p className="text-xs text-muted-foreground">{SECTIONS_NOTE}</p>
                </div>
                {config.sections.map(s => (
                    <article key={s.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-3 sm:p-4">
                        <div className="flex items-end gap-2">
                            <FormField label="Section name" htmlFor={`${s.id}-name`} className="flex-1">
                                <InputField id={`${s.id}-name`} value={s.name} onChange={e => update(c => withSectionPatched(c, s.id, { name: e.target.value }))} />
                            </FormField>
                            <Button variant="ghost" size="icon" aria-label={`Remove ${s.name}`} onClick={() => update(c => withSectionRemoved(c, s.id))}><Trash2 className="text-destructive" /></Button>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">Levels on this bell</p>
                            <div className="flex flex-wrap gap-2">
                                {CURRICULUM_BANDS.map(b => {
                                    const on = s.bands.includes(b);
                                    return <button key={b} type="button" aria-pressed={on} className={chip(on)} onClick={() => update(c => withSectionBandToggled(c, s.id, b))}>{BAND_LABELS[b]}</button>;
                                })}
                            </div>
                        </div>
                        <BellEditor key={`${s.id}-${rev}`} id={s.id} periods={s.periods} schoolDays={config.days} onChange={periods => update(c => withSectionPatched(c, s.id, { periods }))} />
                    </article>
                ))}
                <div className="flex flex-wrap gap-2">
                    {presets.map(p => <Button key={p.key} variant="outline" size="sm" onClick={() => update(c => withSectionAdded(c, p.key))}><Plus />{p.name}</Button>)}
                    <Button variant="ghost" size="sm" onClick={() => update(c => withSectionAdded(c, null))}><Plus />Custom section</Button>
                </div>
            </div>

            <ActivitiesEditor config={config} update={update} />

            {dirty ? (
                <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-primary/40 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm"><span className="font-semibold">Unsaved changes.</span> <span className="text-muted-foreground">Generate the timetable again after saving, so lessons follow the new day.</span></p>
                    <div className="flex shrink-0 justify-end gap-2">
                        <Button variant="ghost" onClick={load} disabled={saving}>Discard</Button>
                        <Button onClick={save} disabled={saving || !!problem}>{saving ? 'Saving…' : 'Save school day'}</Button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
