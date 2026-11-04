"use client";

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BookOpenCheck, Check, ChevronDown, Download, RotateCcw, Sun, Sunset } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, InputField } from '@/components/ui/FormField';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { TaughtTogether } from '@/components/academics/timetable/TaughtTogether';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize, personName } from '@/lib/ops/format';
import {
    IMPORT_LOADS_NOTE, LOAD_DEFAULTS, LOAD_FIELDS, MINISTRY_LOADS_NOTE, importLoadsMessage, loadLessonsLabel,
    type ImportLoadsResult, type TeachingLoad as Load,
} from '@/lib/ops/forms/academics';
import { basisLine, overloadMessage, type PlanClass, type PlanLoad, type TimetablePlan } from '@/lib/timetable/readiness';
import { fewerGroupsLines, longerDayLines } from '@/lib/timetable/fit';
import { SUBJECT_TIME_LABELS } from '@/lib/timetable/checks';
import { SUBJECT_TIMES, type SubjectTime } from '@/lib/timetable/config';
import { cn } from '@/lib/utils';

type FitFix = 'longer-day' | 'fewer-lessons' | 'fewer-groups' | 'auto-groups';

const applyFix = async (streamId: string, fix: FitFix) =>
    opsFetch<{ message: string }>('/api/academics/timetable/fit', { method: 'POST', json: { stream_id: streamId, fix } });

/** One ready-made way to make a class fit, with what it changes and a button. */
function FitOption({ title, recommended, lines, busy, onUse }: { title: string; recommended?: boolean; lines: string[]; busy: boolean; onUse: () => void }) {
    return (
        <div className={cn('flex flex-col gap-1 rounded-xl border bg-card p-3', recommended ? 'border-primary/60' : 'border-border')}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {recommended && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Recommended</span>}
            </div>
            {lines.map((l, i) => <p key={i} className="text-xs text-muted-foreground">{l}</p>)}
            <Button size="sm" variant={recommended ? 'default' : 'outline'} onClick={onUse} disabled={busy} className="mt-auto self-end">{busy ? 'Applying…' : 'Use this'}</Button>
        </div>
    );
}

/** A class with more lessons than its week, as a choice between ready-made fixes. */
function FitChooser({ c, onApplied }: { c: PlanClass; onApplied: () => void }) {
    const confirm = useConfirm();
    const [busy, setBusy] = useState<FitFix | null>(null);
    const over = c.needed - c.capacity;
    const day = c.fixes?.longerDay ?? null;
    const cuts = c.fixes?.fewerLessons ?? null;
    const groups = c.fixes?.fewerGroups ?? null;
    const apply = async (fix: FitFix, question: string) => {
        if (!(await confirm({ title: question, confirmText: 'Apply' }))) return;
        setBusy(fix);
        try {
            const r = await applyFix(c.streamId, fix);
            toast.success(`${r.message} Generate a new draft to see it.`);
            onApplied();
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(null); }
    };
    return (
        <div className="@container mt-3 flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{over} lesson{over === 1 ? '' : 's'} more than the week holds ({c.needed} needed, {c.capacity} periods). Pick one way to fix it:</p>
            <div className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
                {day && <FitOption title="Make the day longer" recommended lines={longerDayLines(day)} busy={busy === 'longer-day'} onUse={() => void apply('longer-day', `Make the day longer for ${day.level}?`)} />}
                {groups && <FitOption title="Fewer elective groups" lines={fewerGroupsLines(groups)} busy={busy === 'fewer-groups'} onUse={() => void apply('fewer-groups', `Run ${c.name}’s electives in ${groups.groups.length} groups?`)} />}
                {cuts && (
                    <FitOption
                        title="Teach fewer lessons a week"
                        lines={[cuts.map(x => `${x.subject} ${x.from} → ${x.to}`).join(' · '), 'The day stays as it is. Some subjects go below the Ministry’s figure.']}
                        busy={busy === 'fewer-lessons'}
                        onUse={() => void apply('fewer-lessons', `Give ${cuts.length} subjects in ${c.name} fewer lessons a week?`)}
                    />
                )}
            </div>
            {groups && groups.unfit.length > 0 && (
                <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-primary">Who would change a subject ({groups.unfit.length})</summary>
                    <ul className="mt-1 grid gap-x-4 text-muted-foreground @xl:grid-cols-2 @4xl:grid-cols-3">{groups.unfit.map((u, i) => <li key={i}>{u.name}: {u.subjects.join(' and ')}</li>)}</ul>
                </details>
            )}
            <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-primary">Why doesn’t it fit?</summary>
                <p className="mt-1">{overloadMessage(c)}</p>
                {basisLine(c) && <p className="mt-1">{basisLine(c)}</p>}
            </details>
        </div>
    );
}

/** A subject's lessons a week, with the Ministry's figure beside it when they differ. */
function LessonsCell({ l }: { l: PlanLoad }) {
    const off = l.ministry !== null && l.ministry !== l.lessons;
    return (
        <span className="flex items-center justify-end gap-1.5 tabular-nums">
            <span className="font-semibold">{l.lessons}</span>
            {l.doubles > 0 && <span className="text-[11px] text-muted-foreground">({l.doubles}×2)</span>}
            {l.ministry === null ? null : off
                ? <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300" title={`The Ministry’s figure is ${l.ministry} a week`}>KICD {l.ministry}</span>
                : <Check className="size-3.5 text-emerald-600" aria-label="Matches the Ministry" />}
        </span>
    );
}

function SubjectRow({ l, indent }: { l: PlanLoad; indent?: boolean }) {
    return (
        <li className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto]', indent && 'pl-3')}>
            <span className="truncate">{l.subject}</span>
            <span className={cn('order-3 col-span-2 truncate text-xs sm:order-none sm:col-span-1 sm:text-sm', l.teacher ? 'text-muted-foreground' : 'font-medium text-amber-700 dark:text-amber-300')}>{l.teacher ?? 'No teacher yet'}</span>
            <LessonsCell l={l} />
        </li>
    );
}

/** One class: its subjects' lessons a week against the Ministry, how full its week is, and its elective groups. */
function ClassCard({ c, onApplied }: { c: PlanClass; onApplied: () => void }) {
    const pct = Math.min(100, Math.round((c.needed / Math.max(1, c.capacity)) * 100));
    const loads = [...c.core, ...c.blocks.flatMap(b => b.loads)];
    const offMinistry = loads.filter(l => l.ministry !== null && l.ministry !== l.lessons).length;
    const handPicked = c.blocks.some(b => b.manual && b.label.startsWith('Option '));
    const [busy, setBusy] = useState(false);
    const automatic = async () => {
        setBusy(true);
        try { toast.success((await applyFix(c.streamId, 'auto-groups')).message); onApplied(); }
        catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };
    return (
        <li className={cn('rounded-2xl border bg-card p-3 shadow-sm sm:p-4', c.fits ? 'border-border/70' : 'border-rose-500/50 lg:col-span-2')}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold">{c.name} {c.level && <span className="ml-1 text-xs font-normal text-muted-foreground">{c.level}</span>}</span>
                <span className={cn('text-sm tabular-nums', c.fits ? 'text-muted-foreground' : 'font-semibold text-rose-600')}>{c.needed} of {c.capacity} periods</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={c.needed} aria-valuemin={0} aria-valuemax={c.capacity} aria-label={`${c.name} week used`}>
                <div className={cn('h-full rounded-full', c.fits ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs">
                {offMinistry === 0
                    ? <><Check className="size-3.5 text-emerald-600" aria-hidden /><span className="text-emerald-700 dark:text-emerald-300">Every subject matches the Ministry’s lessons a week</span></>
                    : <><AlertTriangle className="size-3.5 text-amber-600" aria-hidden /><span className="text-amber-700 dark:text-amber-300">{offMinistry} subject{offMinistry === 1 ? '' : 's'} differ{offMinistry === 1 ? 's' : ''} from the Ministry</span></>}
            </p>
            {/* A class that does not fit spans the row: its subjects and groups side by side above the fixes. */}
            <div className={cn(!c.fits && c.blocks.length > 0 && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6')}>
                <ul className="mt-2 divide-y divide-border/50">
                    {c.core.map(l => <SubjectRow key={l.id} l={l} />)}
                </ul>
                {c.blocks.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                        {c.blocks.map(b => (
                            <div key={b.number} className={cn('rounded-xl px-2.5 py-1.5', b.teacherClash ? 'bg-amber-500/12' : 'bg-violet-500/8')}>
                                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">{b.label} · {b.lessons} a week, taught at the same time</p>
                                <ul className="divide-y divide-border/40">{b.loads.map(l => <SubjectRow key={l.id} l={l} indent />)}</ul>
                                {b.teacherClash && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">One teacher has two of these at once: move one to another group.</p>}
                            </div>
                        ))}
                        {handPicked && (
                            <Button size="xs" variant="ghost" className="self-start" onClick={() => void automatic()} disabled={busy}><RotateCcw />{busy ? 'Resetting…' : 'Work groups out from learners’ choices again'}</Button>
                        )}
                    </div>
                )}
            </div>
            {c.fits && basisLine(c) && <p className="mt-2 text-xs text-muted-foreground">{basisLine(c)}</p>}
            {!c.fits && <FitChooser c={c} onApplied={onApplied} />}
            {c.unfit.length > 0 && (
                <details className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs">
                    <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">{c.unfit.length} learner{c.unfit.length === 1 ? ' has' : 's have'} two subjects in one group</summary>
                    <ul className="mt-1 text-muted-foreground">{c.unfit.map((u, i) => <li key={i}>{u.name}: {u.subjects.join(' and ')}</li>)}</ul>
                </details>
            )}
        </li>
    );
}

/** A subject's time of day across every level that teaches it (each level has its own Mathematics). */
interface SubjectTimeRow { key: string; name: string; ids: string[]; time: SubjectTime | null }

/** One row per subject name, with every level's subject id; `time` is null when the levels differ. */
function subjectTimeRows(plan: TimetablePlan): SubjectTimeRow[] {
    const rows = new Map<string, { name: string; ids: Set<string>; times: Set<SubjectTime> }>();
    for (const c of plan.classes) {
        for (const l of [...c.core, ...c.blocks.flatMap(b => b.loads)]) {
            const key = l.subject.trim().toLowerCase();
            const row = rows.get(key) ?? { name: l.subject.trim(), ids: new Set<string>(), times: new Set<SubjectTime>() };
            row.ids.add(l.subjectId);
            row.times.add(l.time);
            rows.set(key, row);
        }
    }
    return [...rows.entries()]
        .map(([key, r]) => ({ key, name: r.name, ids: [...r.ids], time: r.times.size === 1 ? [...r.times][0] : null }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** When each subject is best taught, across every class: the school's choice, else the usual for its kind. */
function SubjectTimes({ plan, onChange }: { plan: TimetablePlan; onChange: () => void }) {
    const subjects = useMemo(() => subjectTimeRows(plan), [plan]);
    const [saving, setSaving] = useState<string | null>(null);
    const choose = async (row: SubjectTimeRow, time: SubjectTime) => {
        setSaving(row.key);
        try {
            await opsFetch('/api/academics/timetable/config', { method: 'PATCH', json: { subject_times: Object.fromEntries(row.ids.map(id => [id, time])) } });
            onChange();
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(null); }
    };
    if (subjects.length === 0) return null;
    return (
        <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {subjects.map(row => (
                <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-border/70 px-3 py-2">
                    <span className="min-w-[8rem] flex-1 truncate text-sm font-medium" title={row.name}>{row.name}</span>
                    <span role="radiogroup" aria-label={`${row.name}: best time`} className="flex shrink-0 overflow-hidden rounded-lg border border-border text-xs">
                        {SUBJECT_TIMES.map(t => (
                            <button key={t} type="button" role="radio" aria-checked={row.time === t} disabled={saving === row.key}
                                onClick={() => row.time !== t && void choose(row, t)}
                                className={cn('flex min-h-8 items-center gap-1 px-2 font-medium transition-colors', row.time === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                                {t === 'morning' ? <Sun className="size-3" aria-hidden /> : t === 'afternoon' ? <Sunset className="size-3" aria-hidden /> : null}
                                {SUBJECT_TIME_LABELS[t]}
                            </button>
                        ))}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** The teaching loads behind the cards: start them from subject assignments, match the Ministry, or edit one by one. */
function Loads({ onChange }: { onChange: () => void }) {
    const [perWeek, setPerWeek] = useState('5');
    const [importing, setImporting] = useState<'import' | 'reset' | null>(null);
    const [key, setKey] = useState(0);
    const confirm = useConfirm();

    const importLoads = async (mode: 'import' | 'reset') => {
        if (mode === 'reset' && !(await confirm({ title: 'Match the Ministry for every class?', message: 'Every subject the Ministry sets lessons for gets its figure, doubles included. Subjects it does not cover keep theirs.', confirmText: 'Match the Ministry' }))) return;
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
                    <h3 className="text-sm font-semibold">Start from who teaches what</h3>
                    <p className="text-sm text-muted-foreground">{IMPORT_LOADS_NOTE}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{MINISTRY_LOADS_NOTE}</p>
                </div>
                <FormField label="Other subjects a week" htmlFor="import-per-week" className="sm:w-40">
                    <InputField id="import-per-week" type="number" min={1} max={20} value={perWeek} onChange={e => setPerWeek(e.target.value)} />
                </FormField>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void importLoads('import')} disabled={importing !== null}><Download />{importing === 'import' ? 'Importing…' : 'Import'}</Button>
                    <Button variant="outline" onClick={() => void importLoads('reset')} disabled={importing !== null}><BookOpenCheck />{importing === 'reset' ? 'Matching…' : 'Match the Ministry'}</Button>
                </div>
            </section>
            <details className="group rounded-2xl border border-border/70 bg-card shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-semibold sm:p-5">
                    Edit teaching loads one by one
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-border/60 p-3 sm:p-4">
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
            </details>
        </div>
    );
}

/**
 * Subjects & hours: every class's subjects and lessons a week against the
 * Ministry (KICD) figures, how full its week is, its elective groups, and a
 * ready-made fix when it does not fit. Then when subjects are best taught,
 * subjects taught at the same time, and the loads themselves.
 */
export function HoursStep({ plan, focus, onChange }: { plan: TimetablePlan; focus: string | null; onChange: () => void }) {
    const over = plan.classes.filter(c => !c.fits).length;
    const differing = plan.classes.filter(c => c.offMinistry.length > 0).length;
    const ordered = useMemo(() => [...plan.classes].sort((a, b) => Number(a.fits) - Number(b.fits) || Number(b.streamId === focus) - Number(a.streamId === focus)), [plan.classes, focus]);
    return (
        <div className="flex flex-col gap-6">
            {plan.classes.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={cn('rounded-full px-2.5 py-1 font-semibold', over ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300')}>{over ? `${over} class${over === 1 ? '' : 'es'} over the week` : 'Every class fits its week'}</span>
                        <span className={cn('rounded-full px-2.5 py-1 font-semibold', differing ? 'bg-amber-500/12 text-amber-800 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300')}>{differing ? `${differing} class${differing === 1 ? '' : 'es'} differ from the Ministry` : 'Lessons match the Ministry'}</span>
                    </div>
                    <ul className="grid gap-3 lg:grid-cols-2">{ordered.map(c => <ClassCard key={c.streamId} c={c} onApplied={onChange} />)}</ul>
                </div>
            )}
            <section className="flex flex-col gap-3">
                <div>
                    <h3 className="text-sm font-semibold">When subjects are best taught</h3>
                    <p className="text-xs text-muted-foreground">Mathematics and sciences go before lunch and PE and the arts later, unless you choose otherwise. The timetable follows these where it can.</p>
                </div>
                <SubjectTimes plan={plan} onChange={onChange} />
            </section>
            <TaughtTogether onChange={onChange} />
            <Loads onChange={onChange} />
        </div>
    );
}
