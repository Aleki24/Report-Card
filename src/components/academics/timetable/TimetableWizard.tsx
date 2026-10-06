"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Check, ChevronDown, Download, FlaskConical, Layers, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TimetableBuilder } from '@/components/academics/timetable/TimetableBuilder';
import { DayStructureEditor } from '@/components/academics/timetable/DayStructureEditor';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, personName } from '@/lib/ops/format';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, MINISTRY_LOADS_NOTE, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, newDraftName,
    type ImportLoadsResult, type Room, type TeachingLoad as Load,
} from '@/lib/ops/forms/academics';
import {
    daySummary, firstCard, loadsSummary, type Blocker, type StudioCard as StudioCardId, type TimetablePlan,
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
                    <p className="text-sm text-muted-foreground">Creates a load for every subject each teacher is assigned to a class this year.</p>
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

/** Each class's week against its periods, with the option blocks its electives run in. */
function ClassFit({ plan, focus }: { plan: TimetablePlan; focus: string | null }) {
    if (plan.classes.length === 0) return null;
    return (
        <ul className="grid gap-3 lg:grid-cols-2">
            {plan.classes.map(c => {
                const pct = Math.min(100, Math.round((c.needed / Math.max(1, c.capacity)) * 100));
                return (
                    <li key={c.streamId} className={cn('rounded-xl border p-3', !c.fits ? 'border-rose-500/50 bg-rose-500/5' : focus === c.streamId ? 'border-primary/50' : 'border-border/70')}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold">{c.name}</span>
                            <span className={cn('text-sm tabular-nums', c.fits ? 'text-muted-foreground' : 'font-semibold text-rose-600')}>{c.needed} / {c.capacity} periods</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={c.needed} aria-valuemin={0} aria-valuemax={c.capacity} aria-label={`${c.name} week used`}>
                            <div className={cn('h-full rounded-full', c.fits ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Whole class: {c.core.map(l => `${l.subject} ${l.lessons}`).join(' · ') || '—'}</p>
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

/** The top of the studio: ready or not, what is in the way, and the button to generate. */
function Readiness({ plan, generating, onGenerate, onOpen }: { plan: TimetablePlan; generating: boolean; onGenerate: () => void; onOpen: (b: Blocker) => void }) {
    const ready = plan.blockers.length === 0;
    return (
        <section className={cn('rounded-2xl border p-4 shadow-sm sm:p-5', ready ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{plan.published ? `Published: ${plan.published}` : 'Not published yet'}</p>
                    <h2 className="mt-0.5 text-xl font-bold tracking-tight">
                        {ready ? 'Ready to generate' : `${plan.blockers.length} thing${plan.blockers.length === 1 ? '' : 's'} to sort first`}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {ready ? 'Every class fits its week. Generate a draft, check it, then publish.' : 'Fix these here — each opens the part of the setup it is about.'}
                    </p>
                </div>
                <Button onClick={onGenerate} disabled={!ready || generating} className="h-11 sm:min-w-48"><Sparkles />{generating ? 'Generating…' : plan.drafts > 0 ? 'Generate a new draft' : 'Generate timetable'}</Button>
            </div>
            {plan.blockers.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                    {plan.blockers.map((b, i) => (
                        <li key={i}>
                            <button type="button" onClick={() => onOpen(b)} className="flex w-full items-start gap-2 rounded-lg bg-card px-3 py-2 text-left text-sm hover:bg-muted">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                                <span className="flex-1">{b.message}</span>
                                <span className="shrink-0 text-xs font-semibold text-primary">Fix</span>
                            </button>
                        </li>
                    ))}
                </ul>
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
            <Readiness plan={plan} generating={generating} onGenerate={() => void generate()} onOpen={b => show(b.card, b.streamId)} />

            <StudioCard id="day" icon={CalendarClock} title="School day" summary={daySummary(plan.day)} state={stateOf('day')} open={open === 'day'} onToggle={() => toggle('day')}>
                <DayStructureEditor onSaved={() => { void refresh(); show('loads'); }} />
            </StudioCard>

            <StudioCard id="loads" icon={Users} title="Classes & teaching loads" summary={loadsSummary(plan)} state={stateOf('loads')} open={open === 'loads'} onToggle={() => toggle('loads')}>
                <div className="flex flex-col gap-5">
                    <div className="rounded-xl bg-violet-500/8 p-3 text-sm">
                        <p className="font-semibold">How electives fit: option blocks</p>
                        <p className="text-muted-foreground">Electives in one block run at the same time, each learner in the subject they chose. When a class has more subjects than periods, blocks are worked out for you; set a load’s <em>Option block</em> to choose them yourself.</p>
                    </div>
                    <ClassFit plan={plan} focus={focus} />
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
