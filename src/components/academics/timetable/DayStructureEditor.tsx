"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { errorText, opsFetch } from '@/lib/ops/client';
import { BAND_LABELS } from '@/lib/curriculum-bands';
import { CURRICULUM_BANDS, WEEKDAYS, WEEKDAY_LABELS, type TimetableConfig, type TimetablePeriod } from '@/lib/timetable/config';
import {
    SECTIONS_NOTE, openSectionPresets, withAddedPeriodTo, withPeriodPatched, withSectionAdded, withSectionBandToggled, withSectionPatched, withSectionRemoved,
} from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

const URL = '/api/academics/timetable/config';

const toggleClass = (on: boolean) => cn('min-h-10 rounded-xl border px-3 text-sm font-medium transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted');

/** One bell: its periods and breaks with their times. */
function PeriodsEditor({ id, periods, onChange }: { id: string; periods: readonly TimetablePeriod[]; onChange: (next: TimetablePeriod[]) => void }) {
    return (
        <>
            <ol className="flex flex-col gap-2">
                {periods.map((p, i) => (
                    <li key={i} className={cn('grid grid-cols-2 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_7rem_7rem_auto_auto] sm:items-end', p.is_break ? 'border-dashed border-border bg-muted/30' : 'border-border/70')}>
                        <FormField label="Name" htmlFor={`${id}-${i}-label`} span="full" className="col-span-2 sm:col-span-1">
                            <InputField id={`${id}-${i}-label`} value={p.label} onChange={e => onChange(withPeriodPatched(periods, i, { label: e.target.value }))} />
                        </FormField>
                        <FormField label="Starts" htmlFor={`${id}-${i}-start`}><InputField id={`${id}-${i}-start`} type="time" value={p.start} onChange={e => onChange(withPeriodPatched(periods, i, { start: e.target.value }))} /></FormField>
                        <FormField label="Ends" htmlFor={`${id}-${i}-end`}><InputField id={`${id}-${i}-end`} type="time" value={p.end} onChange={e => onChange(withPeriodPatched(periods, i, { end: e.target.value }))} /></FormField>
                        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={p.is_break} onChange={e => onChange(withPeriodPatched(periods, i, { is_break: e.target.checked }))} />Break</label>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.label}`} onClick={() => onChange(periods.filter((_, j) => j !== i))}><Trash2 className="text-destructive" /></Button>
                    </li>
                ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onChange(withAddedPeriodTo(periods, false))}><Plus />Lesson period</Button>
                <Button variant="outline" size="sm" onClick={() => onChange(withAddedPeriodTo(periods, true))}><Plus />Break</Button>
            </div>
        </>
    );
}

/** The school day: which weekdays run, the main bell, and sections with their own bells. */
export function DayStructureEditor({ onSaved }: { onSaved?: () => void } = {}) {
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        opsFetch<TimetableConfig>(URL).then(setConfig).catch(err => toast.error(errorText(err)));
    }, []);

    if (!config) return <div className="skeleton-bone h-64 rounded-2xl" />;

    const update = (fn: (c: TimetableConfig) => TimetableConfig) => setConfig(c => c && fn(c));

    const save = async () => {
        setSaving(true);
        try { setConfig(await opsFetch<TimetableConfig>(URL, { method: 'PUT', json: config })); toast.success('Day structure saved.'); onSaved?.(); }
        catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const presets = openSectionPresets(config);

    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div>
                <h2 className="text-base font-semibold">School days</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => {
                        const on = config.days.includes(d);
                        return (
                            <button key={d} type="button" aria-pressed={on} className={toggleClass(on)}
                                onClick={() => update(c => ({ ...c, days: on ? c.days.filter(x => x !== d) : [...c.days, d].sort() }))}>
                                {WEEKDAY_LABELS[d]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-base font-semibold">{config.sections.length > 0 ? 'Main school day' : 'Periods and breaks'}</h2>
                {config.sections.length > 0 && <p className="text-sm text-muted-foreground">For classes in no section below.</p>}
                <div className="mt-3"><PeriodsEditor id="main" periods={config.periods} onChange={periods => update(c => ({ ...c, periods }))} /></div>
            </div>

            <div className="flex flex-col gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold"><Layers className="size-4 text-primary" aria-hidden />Sections with their own bell</h2>
                    <p className="text-sm text-muted-foreground">{SECTIONS_NOTE}</p>
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
                                    return <button key={b} type="button" aria-pressed={on} className={toggleClass(on)} onClick={() => update(c => withSectionBandToggled(c, s.id, b))}>{BAND_LABELS[b]}</button>;
                                })}
                            </div>
                        </div>
                        <PeriodsEditor id={s.id} periods={s.periods} onChange={periods => update(c => withSectionPatched(c, s.id, { periods }))} />
                    </article>
                ))}
                <div className="flex flex-wrap gap-2">
                    {presets.map(p => <Button key={p.key} variant="outline" size="sm" onClick={() => update(c => withSectionAdded(c, p.key))}><Plus />{p.name}</Button>)}
                    <Button variant="ghost" size="sm" onClick={() => update(c => withSectionAdded(c, null))}><Plus />Custom section</Button>
                </div>
            </div>

            <FormField label="Most lessons in a row for one teacher" htmlFor="max-consec" className="max-w-xs">
                <InputField id="max-consec" type="number" min={1} max={12} value={config.rules.max_consecutive}
                    onChange={e => update(c => ({ ...c, rules: { ...c.rules, max_consecutive: Number(e.target.value) || 1 } }))} />
            </FormField>

            <div className="flex justify-end border-t border-border/60 pt-4">
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : onSaved ? 'Save and continue' : 'Save day structure'}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Changing periods after publishing? Generate the timetable again so lessons line up with the new day.</p>
        </section>
    );
}
