"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { errorText, opsFetch } from '@/lib/ops/client';
import { WEEKDAYS, WEEKDAY_LABELS, type TimetableConfig } from '@/lib/timetable/config';
import { cn } from '@/lib/utils';

const URL = '/api/academics/timetable/config';

/** The school day: which weekdays run, and each period and break with its times. */
export function DayStructureEditor() {
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        opsFetch<TimetableConfig>(URL).then(setConfig).catch(err => toast.error(errorText(err)));
    }, []);

    if (!config) return <div className="skeleton-bone h-64 rounded-2xl" />;

    const setPeriod = (i: number, patch: Partial<TimetableConfig['periods'][number]>) =>
        setConfig(c => c && ({ ...c, periods: c.periods.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

    const save = async () => {
        setSaving(true);
        try { setConfig(await opsFetch<TimetableConfig>(URL, { method: 'PUT', json: config })); toast.success('Day structure saved.'); }
        catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const addPeriod = (isBreak: boolean) => setConfig(c => {
        if (!c) return c;
        const last = c.periods[c.periods.length - 1];
        const start = last?.end ?? '08:00';
        const [h, m] = start.split(':').map(Number);
        const endMin = h * 60 + m + (isBreak ? 20 : 40);
        const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        const teaching = c.periods.filter(p => !p.is_break).length;
        return { ...c, periods: [...c.periods, { label: isBreak ? 'Break' : `P${teaching + 1}`, start, end, is_break: isBreak }] };
    });

    return (
        <section className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div>
                <h2 className="text-base font-semibold">School days</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => {
                        const on = config.days.includes(d);
                        return (
                            <button key={d} type="button" aria-pressed={on}
                                onClick={() => setConfig(c => c && ({ ...c, days: on ? c.days.filter(x => x !== d) : [...c.days, d].sort() }))}
                                className={cn('min-h-10 rounded-xl border px-3 text-sm font-medium transition-colors', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground')}>
                                {WEEKDAY_LABELS[d]}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-base font-semibold">Periods and breaks</h2>
                <ol className="mt-3 flex flex-col gap-2">
                    {config.periods.map((p, i) => (
                        <li key={i} className={cn('grid grid-cols-2 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_7rem_7rem_auto_auto] sm:items-end', p.is_break ? 'border-dashed border-border bg-muted/30' : 'border-border/70')}>
                            <FormField label="Name" htmlFor={`p-${i}-label`} span="full" className="col-span-2 sm:col-span-1">
                                <InputField id={`p-${i}-label`} value={p.label} onChange={e => setPeriod(i, { label: e.target.value })} />
                            </FormField>
                            <FormField label="Starts" htmlFor={`p-${i}-start`}><InputField id={`p-${i}-start`} type="time" value={p.start} onChange={e => setPeriod(i, { start: e.target.value })} /></FormField>
                            <FormField label="Ends" htmlFor={`p-${i}-end`}><InputField id={`p-${i}-end`} type="time" value={p.end} onChange={e => setPeriod(i, { end: e.target.value })} /></FormField>
                            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={p.is_break} onChange={e => setPeriod(i, { is_break: e.target.checked })} />Break</label>
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.label}`} onClick={() => setConfig(c => c && ({ ...c, periods: c.periods.filter((_, j) => j !== i) }))}><Trash2 className="text-destructive" /></Button>
                        </li>
                    ))}
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => addPeriod(false)}><Plus />Lesson period</Button>
                    <Button variant="outline" size="sm" onClick={() => addPeriod(true)}><Plus />Break</Button>
                </div>
            </div>

            <FormField label="Most lessons in a row for one teacher" htmlFor="max-consec" className="max-w-xs">
                <InputField id="max-consec" type="number" min={1} max={12} value={config.rules.max_consecutive}
                    onChange={e => setConfig(c => c && ({ ...c, rules: { ...c.rules, max_consecutive: Number(e.target.value) || 1 } }))} />
            </FormField>

            <div className="flex justify-end border-t border-border/60 pt-4">
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save day structure'}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Changing periods after publishing? Generate the timetable again so lessons line up with the new day.</p>
        </section>
    );
}
