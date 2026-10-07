"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Check, ChevronDown, Download, FlaskConical, Layers, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TimetableBuilder } from '@/components/academics/timetable/TimetableBuilder';
import { DayStructureEditor } from '@/components/academics/timetable/DayStructureEditor';
import type { TimetableConfig } from '@/lib/timetable/config';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, personName } from '@/lib/ops/format';
import {
    IMPORT_LOADS_NOTE, LOAD_DEFAULTS, LOAD_FIELDS, MINISTRY_LOADS_NOTE, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, newDraftName, withBreaksFixed,
    type ImportLoadsResult, type Room, type TeachingLoad as Load,
} from '@/lib/ops/forms/academics';
import {
    basisLine, daySummary, firstCard, isLightLoad, loadsSummary, overloadMessage, type Blocker, type StudioCard as StudioCardId, type TimetablePlan,
} from '@/lib/timetable/readiness';
import { cn } from '@/lib/utils';

function Loads({ onChange }: { onChange: () => void }) {
    const [perWeek, setPerWeek] = useState('5');
    const [importing, setImporting] = useState<'import' | 'reset' | null>(null);
    const [key, setKey] = useState(0);

    const importLoads = async (mode: 'import' | 'reset') => {
        setImporting(mode);
        try {
            const r = await opsFetch<ImportLoadsResult>('/api/academics/timetable/requirements/import', {
                method: 'POST', json: { lessons_per_week: Number(perWeek) || 5, update_existing: mode === 'reset' },
            });
            toast.success(importLoadsMessage(r));
            setKey(k => k + 1);
            onChange();
        } catch (err) { toast.error(errorText(err)); }
        finally { setImporting(null); }
    };

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
                <div className="sm:flex-1">
                    <h2 className="text-base font-semibold">Start from subject assignments</h2>
                    <p className="text-sm text-muted-foreground">{IMPORT_LOADS_NOTE}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{MINISTRY_LOADS_NOTE}</p>
                </div>
                <FormField label="Other subjects" htmlFor="import-per-week" className="sm:w-36">
                    <InputField id="import-per-week" type="number" min={1} max={20} value={perWeek} onChange={e => setPerWeek(e.target.value)} />
                </FormField>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void importLoads('import')} disabled={importing !== null}><Download />{importing === 'import' ? 'Importing…' : 'Import'}</Button>
                    <Button variant="outline" onClick={() => void importLoads('reset')} disabled={importing !== null}>{importing === 'reset' ? 'Resetting…' : 'Reset to Ministry'}</Button>
                </div>
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

const CARD_TONE = {
    done: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    attention: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    optional: 'bg-muted text-muted-foreground',
    todo: 'bg-muted text-muted-foreground',
} as const;
type CardState = keyof typeof CARD_TONE;
const STATE_LABEL: Record<CardState, string> = { done: 'Done', attention: 'Needs attention', optional: 'Optional', todo: 'To do' };

/** One part of the studio: a summary line that opens into its editor. */
function StudioCard({ id, icon: Icon, title, summary, state, open, onToggle, children }: {
    id: StudioCardId; icon: LucideIcon; title: string; summary: string; state: CardState; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
    return (
        <section id={`studio-${id}`} className={cn('scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors', open ? 'border-primary/40' : 'border-border/70')}>
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', state === 'attention' ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary')}>
                    <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{summary}</span>
                </span>
                <span className={cn('hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold sm:inline-flex', CARD_TONE[state])}>
                    {state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : state === 'attention' ? <AlertTriangle className="size-3.5" /> : null}
                    {STATE_LABEL[state]}
                </span>
                <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
            {open ? <div className="border-t border-border/60 p-4 sm:p-5">{children}</div> : null}
        </section>
    );
}

type FitFix = 'longer-day' | 'fewer-lessons';

/** One ready-made way to make a class fit, with what it changes and a button. */
function FitOption({ title, recommended, lines, busy, onUse }: { title: string; recommended?: boolean; lines: string[]; busy: boolean; onUse: () => void }) {
    return (
        <div className={cn('flex flex-col gap-1 rounded-xl border bg-card p-3', recommended ? 'border-primary/60' : 'border-border')}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {recommended && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Recommended</span>}
            </div>
            {lines.map(l => <p key={l} className="text-xs text-muted-foreground">{l}</p>)}
            <Button size="sm" variant={recommended ? 'default' : 'outline'} onClick={onUse} disabled={busy} className="mt-1 self-end">{busy ? 'Applying…' : 'Use this'}</Button>
        </div>
    );
}

/** A class with more lessons than its week, as a simple choice between two ready-made fixes. */
function FitChooser({ c, onApplied }: { c: TimetablePlan['classes'][number]; onApplied: () => void }) {
    const [busy, setBusy] = useState<FitFix | null>(null);
    const over = c.needed - c.capacity;
    const day = c.fixes?.longerDay ?? null;
    const cuts = c.fixes?.fewerLessons ?? null;
    const apply = async (fix: FitFix, question: string) => {
        if (!window.confirm(question)) return;
        setBusy(fix);
        try {
            const r = await opsFetch<{ message: string }>('/api/academics/timetable/fit', { method: 'POST', json: { stream_id: c.streamId, fix } });
            toast.success(`${r.message} Generate a new draft to see it.`);
            onApplied();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(null); }
    };
    return (
        <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm font-medium">{c.name} has {over} more lesson{over === 1 ? '' : 's'} than its week ({c.needed} needed, {c.capacity} periods). Pick one way to fix it:</p>
            <div className="grid gap-2 sm:grid-cols-2">
                {day && (
                    <FitOption
                        title="Make the day longer"
                        recommended
                        lines={[`${day.level} get ${day.perDay} more lesson${day.perDay === 1 ? '' : 's'} at the end of each day: ${day.times.join(', ')}.`, 'Every other class keeps its day. No lessons are cut.']}
                        busy={busy === 'longer-day'}
                        onUse={() => void apply('longer-day', `Make the day longer for ${day.level}?`)}
                    />
                )}
                {cuts && (
                    <FitOption
                        title="Teach fewer lessons a week"
                        lines={[cuts.map(x => `${x.subject} ${x.from} → ${x.to}`).join(' · '), 'The day stays as it is. Some subjects go below the Ministry’s figure.']}
                        busy={busy === 'fewer-lessons'}
                        onUse={() => void apply('fewer-lessons', `Give ${cuts.length} subjects in ${c.name} fewer lessons a week?`)}
                    />
                )}
            </div>
            <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-primary">Why doesn’t it fit?</summary>
                <p className="mt-1">{overloadMessage(c)}</p>
                {basisLine(c) && <p className="mt-1">{basisLine(c)}</p>}
            </details>
        </div>
    );
}

/** Each class's week against its periods, with the option blocks its electives run in. */
function ClassFit({ plan, focus, onApplied }: { plan: TimetablePlan; focus: string | null; onApplied: () => void }) {
    if (plan.classes.length === 0) return null;
    return (
        <ul className="grid gap-3 lg:grid-cols-2">
            {plan.classes.map(c => {
                const pct = Math.min(100, Math.round((c.needed / Math.max(1, c.capacity)) * 100));
                return (
                    <li key={c.streamId} className={cn('rounded-xl border p-3', !c.fits ? 'border-rose-500/50' : focus === c.streamId ? 'border-primary/50' : 'border-border/70')}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold">{c.name}</span>
                            <span className={cn('text-sm tabular-nums', c.fits ? 'text-muted-foreground' : 'font-semibold text-rose-600')}>{c.needed} / {c.capacity} periods</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={c.needed} aria-valuemin={0} aria-valuemax={c.capacity} aria-label={`${c.name} week used`}>
                            <div className={cn('h-full rounded-full', c.fits ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Whole class: {c.core.map(l => `${l.subject} ${l.lessons}`).join(' · ') || '—'}</p>
                        {c.fits && basisLine(c) && <p className="mt-1 text-xs text-muted-foreground">{basisLine(c)}</p>}
                        {!c.fits && <FitChooser c={c} onApplied={onApplied} />}
                        {c.blocks.length > 0 && (
                            <ul className="mt-2 flex flex-col gap-1.5">
                                {c.blocks.map(b => (
                                    <li key={b.number} className={cn('rounded-lg px-2.5 py-1.5 text-xs', b.teacherClash ? 'bg-amber-500/15' : 'bg-violet-500/10')}>
                                        <span className="font-semibold text-violet-700 dark:text-violet-300">{b.label}{b.manual ? '' : ' (auto)'} · {b.lessons}/wk</span>
                                        <span className="text-muted-foreground"> — {b.loads.map(l => l.subject).join(' · ')}</span>
                                        {b.teacherClash && <span className="block font-medium text-amber-700 dark:text-amber-300">One teacher has two of these at once: move one to another block.</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {c.unassigned > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{c.unassigned} load{c.unassigned === 1 ? '' : 's'} without a teacher.</p>}
                    </li>
                );
            })}
        </ul>
    );
}

/** Every teacher's week across all their classes and levels, light and over-full loads marked. */
function TeacherLoads({ plan }: { plan: TimetablePlan }) {
    if (plan.teachers.length === 0) return null;
    return (
        <div>
            <h3 className="mb-2 text-sm font-semibold">Teacher loads <span className="font-normal text-muted-foreground">· lessons a week across every class</span></h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {plan.teachers.map(t => {
                    const over = t.lessons > t.capacity;
                    const light = isLightLoad(t);
                    return (
                        <li key={t.name} className={cn('rounded-xl border px-3 py-2', over ? 'border-rose-500/50' : light ? 'border-amber-500/50' : 'border-border/70')}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="truncate font-medium">{t.name}</span>
                                <span className={cn('shrink-0 tabular-nums', over ? 'font-semibold text-rose-600' : light ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{t.lessons} / {t.capacity}</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', over ? 'bg-rose-500' : light ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (t.lessons / Math.max(1, t.capacity)) * 100)}%` }} /></div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{t.classes.join(' · ')}</p>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/** The top of the studio: ready or not, what is in the way (with its fix), and the button to generate. */
function Readiness({ plan, generating, fixing, onGenerate, onOpen, onSetBreaks }: {
    plan: TimetablePlan; generating: boolean; fixing: boolean; onGenerate: () => void; onOpen: (b: Blocker) => void; onSetBreaks: () => void;
}) {
    const ready = plan.blockers.length === 0;
    return (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">{plan.published ? `Published · ${plan.published}` : 'Not published yet'}</p>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', ready ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/12 text-amber-700 dark:text-amber-400')}>
                            {ready ? <Check className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
                            {ready ? 'Ready' : 'Not ready'}
                        </span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold tracking-tight">
                        {ready ? 'Ready to generate' : plan.blockers.length === 1 ? 'One thing to fix first' : `${plan.blockers.length} things to fix first`}
                    </h2>
                    <p className="text-sm text-muted-foreground">{ready ? 'Every class fits its week. Generate a draft, check it, then publish.' : 'Fix these, then generate.'}</p>
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
                                : <Button size="sm" variant="outline" onClick={() => onOpen(b)} className="self-end sm:self-auto">Open</Button>}
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
                                {n.details && (
                                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                                        {n.details.map(d => <li key={d}>{d}</li>)}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}

/**
 * The timetable studio: the whole setup on one page, in the order it has to
 * happen, with what blocks generating said up front instead of at the end.
 * Each part opens in place, the first one that needs attention already open,
 * so nothing sends a school back through earlier steps.
 */
export function TimetableWizard() {
    const [plan, setPlan] = useState<TimetablePlan | null>(null);
    const [open, setOpen] = useState<StudioCardId | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [builderKey, setBuilderKey] = useState(0);

    const refresh = useCallback(async () => {
        try {
            const next = await opsFetch<TimetablePlan>('/api/academics/timetable/plan');
            setPlan(next);
            setOpen(o => o ?? firstCard(next));
        } catch (err) { toast.error(errorText(err)); }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);

    const show = (card: StudioCardId, streamId?: string) => {
        setOpen(card);
        setFocus(streamId ?? null);
        requestAnimationFrame(() => document.getElementById(`studio-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const toggle = (card: StudioCardId) => (open === card ? setOpen(null) : show(card));

    const [fixing, setFixing] = useState(false);
    const [dayKey, setDayKey] = useState(0);
    const setBreaks = async () => {
        setFixing(true);
        try {
            const config = await opsFetch<TimetableConfig>('/api/academics/timetable/config');
            await opsFetch('/api/academics/timetable/config', { method: 'PUT', json: withBreaksFixed(config) });
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

    if (!plan) return <div className="skeleton-bone h-96 rounded-2xl" />;
    const stateOf = (card: StudioCardId): CardState => {
        if (plan.blockers.some(b => b.card === card)) return 'attention';
        if (card === 'day') return 'done';
        if (card === 'loads') return plan.loads > 0 ? 'done' : 'todo';
        if (card === 'rooms') return plan.rooms > 0 ? 'done' : 'optional';
        return plan.published ? 'done' : 'todo';
    };

    return (
        <div className="flex flex-col gap-4">
            <Readiness plan={plan} generating={generating} fixing={fixing} onGenerate={() => void generate()} onOpen={b => show(b.card, b.streamId)} onSetBreaks={() => void setBreaks()} />

            <StudioCard id="day" icon={CalendarClock} title="School day" summary={daySummary(plan.day)} state={stateOf('day')} open={open === 'day'} onToggle={() => toggle('day')}>
                <DayStructureEditor key={dayKey} onSaved={() => { void refresh(); show('loads'); }} />
            </StudioCard>

            <StudioCard id="loads" icon={Users} title="Classes & teaching loads" summary={loadsSummary(plan)} state={stateOf('loads')} open={open === 'loads'} onToggle={() => toggle('loads')}>
                <div className="flex flex-col gap-5">
                    <div className="rounded-xl bg-violet-500/8 p-3 text-sm">
                        <p className="font-semibold">How electives fit: option blocks</p>
                        <p className="text-muted-foreground">Electives in one block run at the same time, each learner in the subject they chose. When a class has more subjects than periods, blocks are worked out for you; set a load’s <em>Option block</em> to choose them yourself.</p>
                    </div>
                    <ClassFit plan={plan} focus={focus} onApplied={() => { setDayKey(k => k + 1); void refresh(); }} />
                    <TeacherLoads plan={plan} />
                    <Loads onChange={() => void refresh()} />
                </div>
            </StudioCard>

            <StudioCard id="rooms" icon={FlaskConical} title="Labs & special rooms" summary={plan.rooms > 0 ? `${plan.rooms} room${plan.rooms === 1 ? '' : 's'}` : 'Optional — skip if lessons stay in class'} state={stateOf('rooms')} open={open === 'rooms'} onToggle={() => toggle('rooms')}>
                <Rooms />
            </StudioCard>

            <StudioCard id="drafts" icon={Layers} title="Drafts & publish" summary={plan.published ? `Published: ${plan.published}` : plan.drafts > 0 ? `${plan.drafts} draft${plan.drafts === 1 ? '' : 's'} — check one and publish` : 'Generate your first draft above'} state={stateOf('drafts')} open={open === 'drafts'} onToggle={() => toggle('drafts')}>
                <TimetableBuilder key={builderKey} />
            </StudioCard>
        </div>
    );
}
