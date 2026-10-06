"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TimetableBuilder } from '@/components/academics/timetable/TimetableBuilder';
import { DayStructureEditor } from '@/components/academics/timetable/DayStructureEditor';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, personName } from '@/lib/ops/format';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, weeklyLessonsPerClass,
    type Room, type TeachingLoad as Load,
} from '@/lib/ops/forms/academics';
import type { TimetableConfig, TimetableVersion } from '@/lib/timetable/config';
import {
    TIMETABLE_STEPS, firstOpenStep, isStepDone, stepStatus, timetableProgress, type TimetableProgress,
} from '@/lib/timetable/wizard';
import { cn } from '@/lib/utils';

function Loads({ onChange }: { onChange: () => void }) {
    const [perWeek, setPerWeek] = useState('5');
    const [importing, setImporting] = useState(false);
    const [key, setKey] = useState(0);

    const importLoads = async () => {
        setImporting(true);
        try {
            const r = await opsFetch<{ created: number }>('/api/academics/timetable/requirements/import', { method: 'POST', json: { lessons_per_week: Number(perWeek) || 5 } });
            toast.success(importLoadsMessage(r.created));
            setKey(k => k + 1);
            onChange();
        } catch (err) { toast.error(errorText(err)); }
        finally { setImporting(false); }
    };

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
                <div className="sm:flex-1">
                    <h2 className="text-base font-semibold">Start from subject assignments</h2>
                    <p className="text-sm text-muted-foreground">Creates a load for every subject each teacher is assigned to a class this year.</p>
                </div>
                <FormField label="Lessons a week" htmlFor="import-per-week" className="sm:w-36">
                    <InputField id="import-per-week" type="number" min={1} max={20} value={perWeek} onChange={e => setPerWeek(e.target.value)} />
                </FormField>
                <Button onClick={importLoads} disabled={importing}><Download />{importing ? 'Importing…' : 'Import'}</Button>
            </section>
            <ResourceManager<'timetable-requirements', Load>
                key={key}
                resource="timetable-requirements"
                fields={LOAD_FIELDS}
                canCreate
                canEdit
                canDelete
                defaults={LOAD_DEFAULTS}
                searchText={l => `${l.stream?.full_name} ${l.subject?.name} ${personName(l.teacher)}`}
                header={rows => (rows.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Weekly lessons per class: {weeklyLessonsPerClass(rows)}</p>
                ) : null)}
                columns={[
                    { key: 'class', header: 'Class', render: l => <span className="font-medium">{l.stream?.full_name}</span> },
                    { key: 'subject', header: 'Subject', render: l => l.subject?.name },
                    { key: 'teacher', header: 'Teacher', render: l => (l.teacher ? personName(l.teacher) : <span className="text-destructive">Unassigned</span>) },
                    { key: 'lessons', header: 'Lessons', numeric: true, render: l => loadLessonsLabel(l) },
                    { key: 'room', header: 'Room', hideOnMobile: true, render: l => (l.room_type ? humanize(l.room_type) : 'Any') },
                ]}
            />
        </div>
    );
}

function Rooms() {
    return (
        <ResourceManager<'rooms', Room>
            resource="rooms"
            fields={ROOM_FIELDS}
            canCreate
            canEdit
            canDelete
            defaults={ROOM_DEFAULTS}
            columns={[
                { key: 'name', header: 'Room', render: r => <span className="font-medium">{r.name}</span> },
                { key: 'type', header: 'Type', render: r => humanize(r.room_type) },
                { key: 'capacity', header: 'Seats', numeric: true, render: r => r.capacity ?? '—' },
            ]}
            emptyText="No rooms yet. Add labs so practicals get one; ordinary lessons run in the class's own room."
        />
    );
}

/** Numbered dots joined by a line; done steps tick, the current one is ringed. */
function Stepper({ current, progress, onPick }: { current: number; progress: TimetableProgress | null; onPick: (i: number) => void }) {
    return (
        <ol className="flex items-start" aria-label="Steps">
            {TIMETABLE_STEPS.map((s, i) => {
                const done = isStepDone(s.id, progress);
                const on = i === current;
                return (
                    <li key={s.id} className={cn('flex items-start', i > 0 && 'flex-1')}>
                        {i > 0 ? <span aria-hidden className={cn('mt-4 h-0.5 flex-1 rounded-full', done || i <= current ? 'bg-primary' : 'bg-border')} /> : null}
                        <button
                            type="button"
                            onClick={() => onPick(i)}
                            aria-current={on ? 'step' : undefined}
                            className="group flex w-16 flex-col items-center gap-1.5 rounded-xl px-1 py-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-24"
                        >
                            <span className={cn(
                                'flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                                on ? 'border-primary/30 bg-primary text-primary-foreground ring-4 ring-primary/15'
                                    : done ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-card text-muted-foreground group-hover:border-primary/50',
                            )}
                            >
                                {done && !on ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                            </span>
                            <span className={cn('text-center text-xs', on ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                <span className="sm:hidden">{s.short}</span>
                                <span className="hidden sm:inline">{s.title}</span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * Making a timetable, start to finish, in the order it has to happen: the
 * day, the rooms, the loads, then generate and publish. Each step says what
 * is done, and Next moves on, so nothing sends a school back to an earlier tab.
 */
export function TimetableWizard() {
    const [progress, setProgress] = useState<TimetableProgress | null>(null);
    const [step, setStep] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        const [config, rooms, loads, versions] = await Promise.all([
            opsFetch<TimetableConfig>('/api/academics/timetable/config').catch(() => null),
            opsFetch<{ id: string }[]>('/api/ops/rooms').catch(() => []),
            opsFetch<{ id: string }[]>('/api/ops/timetable-requirements').catch(() => []),
            opsFetch<TimetableVersion[]>('/api/academics/timetable/versions').catch(() => []),
        ]);
        const next = timetableProgress(config, rooms, loads, versions);
        setProgress(next);
        setStep(s => s ?? firstOpenStep(next));
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const current = step ?? 0;
    const s = TIMETABLE_STEPS[current];
    const prev = TIMETABLE_STEPS[current - 1];
    const next = TIMETABLE_STEPS[current + 1];
    const done = isStepDone(s.id, progress);
    const status = stepStatus(s.id, progress);
    const go = (i: number) => { setStep(i); void refresh(); };

    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <Stepper current={current} progress={progress} onPick={go} />
            </div>

            <header className="flex flex-col gap-1">
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                    Step {current + 1} of {TIMETABLE_STEPS.length}{s.optional ? ' · Optional' : ''}
                </p>
                <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">{s.why}</p>
                {status ? (
                    <span className={cn(
                        'mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                        done ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
                    )}
                    >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}{status}
                    </span>
                ) : null}
            </header>

            <div key={s.id}>
                {s.id === 'day' ? <DayStructureEditor onSaved={() => go(current + 1)} /> : null}
                {s.id === 'rooms' ? <Rooms /> : null}
                {s.id === 'loads' ? <Loads onChange={() => void refresh()} /> : null}
                {s.id === 'generate' ? <TimetableBuilder /> : null}
            </div>

            <nav className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-between" aria-label="Step navigation">
                {prev ? (
                    <Button variant="outline" onClick={() => go(current - 1)} className="h-10 sm:min-w-40">
                        <ChevronLeft />Back: {prev.short}
                    </Button>
                ) : <span />}
                {next ? (
                    <Button onClick={() => go(current + 1)} className="h-10 sm:min-w-40">
                        {s.optional && !done ? 'Skip' : 'Next'}: {next.short}<ChevronRight />
                    </Button>
                ) : null}
            </nav>
        </div>
    );
}
