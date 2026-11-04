"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpenCheck, CalendarClock, Check, FlaskConical, Layers, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TimetableBuilder } from '@/components/academics/timetable/TimetableBuilder';
import { DayStructureEditor } from '@/components/academics/timetable/DayStructureEditor';
import { HoursStep } from '@/components/academics/timetable/HoursStep';
import { TeachersStep } from '@/components/academics/timetable/TeachersStep';
import type { TimetableConfig } from '@/lib/timetable/config';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize } from '@/lib/ops/format';
import { ROOM_DEFAULTS, ROOM_FIELDS, newDraftName, withBreaksFixed, type Room } from '@/lib/ops/forms/academics';
import { daySummary, firstCard, loadsSummary, type Blocker, type StudioCard as StepId, type TimetablePlan } from '@/lib/timetable/readiness';
import { cn } from '@/lib/utils';
import { STEP_TONES } from '@/components/ui/tones';

function Rooms() {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Add labs, the computer room or the hall only if some lessons need them (set <em>Needs a room type</em> on those loads). Every other lesson stays in the class’s own room, and no room is ever booked twice.</p>
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
        </div>
    );
}

type StepState = 'done' | 'attention' | 'optional' | 'todo';
const STATE_LABEL: Record<StepState, string> = { done: 'Done', attention: 'Needs attention', optional: 'Optional', todo: 'To do' };

interface StepDef { id: StepId; title: string; icon: LucideIcon; intro: string }

/** The studio's steps, in the order a timetable is made. */
const STEPS: readonly StepDef[] = [
    { id: 'day', title: 'School day', icon: CalendarClock, intro: 'The days the school runs, when lessons and breaks are, and any levels with their own bell.' },
    { id: 'loads', title: 'Subjects & hours', icon: BookOpenCheck, intro: 'Each class’s subjects and lessons a week, checked against the Ministry (KICD) figures, with elective groups and when subjects are best taught.' },
    { id: 'teachers', title: 'Teachers', icon: Users, intro: 'Each teacher’s week across every class they teach, and the times they cannot teach.' },
    { id: 'rooms', title: 'Labs & rooms', icon: FlaskConical, intro: 'Special rooms some lessons need. Optional.' },
    { id: 'drafts', title: 'Generate & publish', icon: Layers, intro: 'Generate a draft, check it, adjust anything by hand, then publish it to teachers and learners.' },
];

/** The top of the studio: ready or not, what is in the way (each with its step), and the button to generate. */
function Readiness({ plan, generating, fixing, onGenerate, onOpen, onSetBreaks }: {
    plan: TimetablePlan; generating: boolean; fixing: boolean; onGenerate: () => void; onOpen: (b: Blocker) => void; onSetBreaks: () => void;
}) {
    const ready = plan.blockers.length === 0;
    return (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">{plan.published ? `Live now · ${plan.published}` : 'Not published yet'}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', ready ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/12 text-amber-700 dark:text-amber-400')}>
                            {ready ? <Check className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
                            {ready ? 'Ready' : 'Not ready'}
                        </span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold tracking-tight">
                        {ready ? 'Ready to generate' : plan.blockers.length === 1 ? 'One thing to fix first' : `${plan.blockers.length} things to fix first`}
                    </h2>
                    <p className="text-sm text-muted-foreground">{ready ? 'Every class fits its week and no teacher has more lessons than periods. Generate a draft, check it, then publish.' : 'Each one opens the step where it is fixed.'}</p>
                </div>
                <Button onClick={onGenerate} disabled={!ready || generating} className="h-11 sm:min-w-48"><Sparkles />{generating ? 'Generating…' : plan.drafts > 0 ? 'Generate a new draft' : 'Generate timetable'}</Button>
            </div>
            {plan.blockers.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                    {plan.blockers.map((b, i) => (
                        <li key={i} className="flex flex-col gap-2 rounded-xl border border-border border-l-4 border-l-amber-500 p-3 text-sm sm:flex-row sm:items-center">
                            <span className="flex flex-1 items-start gap-2">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                                {b.message}
                            </span>
                            {b.fix === 'set-breaks'
                                ? <Button size="sm" onClick={onSetBreaks} disabled={fixing} className="self-end sm:self-auto">{fixing ? 'Saving…' : 'Set as breaks'}</Button>
                                : <Button size="sm" variant="outline" onClick={() => onOpen(b)} className="self-end sm:self-auto">Fix it</Button>}
                        </li>
                    ))}
                </ul>
            )}
            {plan.notes.length > 0 && (
                <details className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium">{plan.notes.length} {plan.notes.length === 1 ? 'tip' : 'tips'} worth a look</summary>
                    <ul className="mt-2 flex flex-col gap-2">
                        {plan.notes.map((n, i) => (
                            <li key={i}>
                                <button type="button" onClick={() => onOpen(n)} className="text-left font-medium hover:text-primary">{n.message}</button>
                                {n.details && <ul className="mt-1 list-disc pl-5 text-muted-foreground">{n.details.map((d, j) => <li key={j}>{d}</li>)}</ul>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}

/** The numbered steps across the top: each with its state, the open one marked. */
function StepNav({ current, stateOf, summaryOf, onSelect }: { current: StepId; stateOf: (id: StepId) => StepState; summaryOf: (id: StepId) => string; onSelect: (id: StepId) => void }) {
    return (
        <nav aria-label="Timetable steps" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <ol className="grid min-w-[44rem] grid-cols-5 gap-2">
                {STEPS.map((s, i) => {
                    const state = stateOf(s.id);
                    const tone = STEP_TONES[i % STEP_TONES.length];
                    const open = current === s.id;
                    return (
                        <li key={s.id}>
                            <button type="button" onClick={() => onSelect(s.id)} aria-current={open ? 'step' : undefined}
                                className={cn('flex h-full w-full flex-col gap-1.5 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50', open ? 'border-primary/60 bg-primary/[0.06] shadow-sm' : 'border-border/70 bg-card hover:bg-muted/50')}>
                                <span className="flex items-center gap-2">
                                    <span aria-hidden className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold', state === 'done' ? tone.solid : state === 'attention' ? 'bg-amber-500 text-white' : tone.tile)}>
                                        {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : state === 'attention' ? <AlertTriangle className="size-3.5" /> : i + 1}
                                    </span>
                                    <span className="text-sm font-semibold leading-tight">{s.title}</span>
                                </span>
                                <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{summaryOf(s.id)}</span>
                                <span className={cn('text-[10px] font-semibold tracking-wide uppercase', state === 'attention' ? 'text-amber-700 dark:text-amber-300' : state === 'done' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground')}>{STATE_LABEL[state]}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/**
 * The timetable studio, as five steps in the order a timetable is made: the
 * school day, subjects and hours (against the Ministry), teachers (and when
 * they can teach), rooms, then generate and publish. What blocks generating
 * is said up front with a button to the step that fixes it, and the studio
 * opens on the first step that needs attention.
 */
export function TimetableWizard() {
    const [plan, setPlan] = useState<TimetablePlan | null>(null);
    const [config, setConfig] = useState<TimetableConfig | null>(null);
    const [step, setStep] = useState<StepId | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [builderKey, setBuilderKey] = useState(0);
    const [dayKey, setDayKey] = useState(0);
    const [fixing, setFixing] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const [next, cfg] = await Promise.all([
                opsFetch<TimetablePlan>('/api/academics/timetable/plan'),
                opsFetch<TimetableConfig>('/api/academics/timetable/config'),
            ]);
            setPlan(next);
            setConfig(cfg);
            setStep(s => s ?? firstCard(next));
        } catch (err) { toast.error(errorText(err)); }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);

    const show = (id: StepId, streamId?: string) => {
        setStep(id);
        setFocus(streamId ?? null);
        requestAnimationFrame(() => document.getElementById('studio-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    const setBreaks = async () => {
        setFixing(true);
        try {
            const current = await opsFetch<TimetableConfig>('/api/academics/timetable/config');
            await opsFetch('/api/academics/timetable/config', { method: 'PUT', json: withBreaksFixed(current) });
            toast.success('Breaks set. No lessons will be put in them.');
            setDayKey(k => k + 1);
            await refresh();
        } catch (err) { toast.error(errorText(err)); }
        finally { setFixing(false); }
    };

    const generate = async () => {
        setGenerating(true);
        try {
            await opsFetch('/api/academics/timetable/generate', { method: 'POST', json: { name: newDraftName('') } });
            toast.success('Draft generated. Check it, move anything you like, then publish.');
            setBuilderKey(k => k + 1);
            await refresh();
            show('drafts');
        } catch (err) { toast.error(errorText(err)); }
        finally { setGenerating(false); }
    };

    if (!plan || !config || !step) return <div className="skeleton-bone h-96 rounded-2xl" />;

    const stateOf = (id: StepId): StepState => {
        if (plan.blockers.some(b => b.card === id)) return 'attention';
        if (id === 'day') return plan.day.days > 0 && plan.day.lessonsPerDay > 0 ? 'done' : 'todo';
        if (id === 'loads' || id === 'teachers') return plan.loads > 0 ? 'done' : 'todo';
        if (id === 'rooms') return plan.rooms > 0 ? 'done' : 'optional';
        return plan.published ? 'done' : 'todo';
    };
    const away = config.rules.teacher_off.length;
    const summaryOf = (id: StepId): string => {
        if (id === 'day') return daySummary(plan.day);
        if (id === 'loads') return loadsSummary(plan);
        if (id === 'teachers') return plan.teachers.length === 0 ? 'No teachers with loads yet' : `${plan.teachers.length} teachers${away ? ` · ${away} time${away === 1 ? '' : 's'} away` : ''}`;
        if (id === 'rooms') return plan.rooms > 0 ? `${plan.rooms} room${plan.rooms === 1 ? '' : 's'}` : 'Skip if lessons stay in class';
        return plan.published ? `Live: ${plan.published}` : plan.drafts > 0 ? `${plan.drafts} draft${plan.drafts === 1 ? '' : 's'} to check` : 'Generate your first draft';
    };
    const index = STEPS.findIndex(s => s.id === step);
    const def = STEPS[index];
    const prev = STEPS[index - 1];
    const next = STEPS[index + 1];

    return (
        <div className="flex flex-col gap-4">
            <Readiness plan={plan} generating={generating} fixing={fixing} onGenerate={() => void generate()} onOpen={b => show(b.card, b.streamId)} onSetBreaks={() => void setBreaks()} />
            <StepNav current={step} stateOf={stateOf} summaryOf={summaryOf} onSelect={id => show(id)} />

            <section id="studio-step" className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <header className="mb-4 flex items-start gap-3 border-b border-border/60 pb-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><def.icon className="size-5" aria-hidden /></span>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Step {index + 1} of {STEPS.length}</p>
                        <h2 className="text-lg font-bold tracking-tight">{def.title}</h2>
                        <p className="text-sm text-muted-foreground">{def.intro}</p>
                    </div>
                </header>
                {step === 'day' && <DayStructureEditor key={dayKey} onSaved={() => void refresh()} />}
                {step === 'loads' && <HoursStep plan={plan} focus={focus} onChange={() => { setDayKey(k => k + 1); void refresh(); }} />}
                {step === 'teachers' && <TeachersStep plan={plan} config={config} onChange={() => void refresh()} />}
                {step === 'rooms' && <Rooms />}
                {step === 'drafts' && <TimetableBuilder key={builderKey} plan={plan} onGenerated={() => void refresh()} />}
                <footer className="mt-5 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
                    {prev ? <Button variant="ghost" onClick={() => show(prev.id)}><ArrowLeft />{prev.title}</Button> : <span />}
                    {next && <Button variant="outline" onClick={() => show(next.id)}>Next: {next.title}<ArrowRight /></Button>}
                </footer>
            </section>
        </div>
    );
}
