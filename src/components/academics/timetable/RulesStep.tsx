"use client";

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, SelectField } from '@/components/ui/FormField';
import { errorText, opsFetch } from '@/lib/ops/client';
import type { TimetableConfig } from '@/lib/timetable/config';
import { subjectTimeRows, type TimetablePlan } from '@/lib/timetable/readiness';
import {
    DOUBLE_RULE_COPY, MAX_RULES, RULE_KINDS, RULE_KIND_COPY, RULE_STRENGTHS, RULE_STRENGTH_COPY,
    newRuleId, ruleConflicts, ruleSentence, type DoubleRules, type RuleKind, type RuleStrength, type TimetableRule,
} from '@/lib/timetable/rules';
import { cn } from '@/lib/utils';

const CONFIG_URL = '/api/academics/timetable/config';

type Patch = { relations?: TimetableRule[]; doubles?: Partial<DoubleRules>; span_short_break?: string[] };

/** One titled block of the step. */
function Block({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            </div>
            {children}
        </section>
    );
}

/** A segmented choice: a row of buttons, one pressed. */
function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <span role="radiogroup" aria-label={label} className="flex w-full overflow-hidden rounded-xl border border-border text-sm sm:w-fit">
            {options.map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
                    className={cn('min-h-10 flex-1 px-3 font-medium transition-colors sm:flex-none', value === o.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    {o.label}
                </button>
            ))}
        </span>
    );
}

/** The form for one new rule: its kind, its subjects, which classes, and how firmly. */
function AddRule({ plan, subjects, onAdd, onCancel, saving }: {
    plan: TimetablePlan;
    subjects: readonly { key: string; name: string; ids: string[] }[];
    onAdd: (rule: TimetableRule) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [kind, setKind] = useState<RuleKind>('not_same_day');
    const [a, setA] = useState('');
    const [b, setB] = useState('');
    const [classes, setClasses] = useState<string[]>([]);
    const [strength, setStrength] = useState<RuleStrength>('prefer');
    const needs = RULE_KIND_COPY[kind].subjects;
    const idsOf = (key: string) => subjects.find(s => s.key === key)?.ids ?? [];
    const picked = needs === 2 ? [a, b] : [a];
    const ready = picked.every(Boolean) && new Set(picked).size === picked.length;
    const draft: TimetableRule | null = ready ? { id: newRuleId(), kind, subject_ids: picked.map(idsOf), stream_ids: classes, strength } : null;
    const conflicts = draft ? ruleConflicts(draft, plan.classes, plan.day.days) : [];
    const options = subjects.map(s => ({ id: s.key, label: s.name }));
    const toggleClass = (id: string) => setClasses(cs => (cs.includes(id) ? cs.filter(c => c !== id) : [...cs, id]));

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/[0.03] p-3 sm:p-4">
            <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-semibold text-muted-foreground">Kind of rule</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                    {RULE_KINDS.map(k => (
                        <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                            className={cn('flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors', kind === k ? 'border-primary bg-primary/[0.07] ring-1 ring-primary/40' : 'border-border/70 bg-card hover:bg-muted/50')}>
                            <span className="text-sm font-semibold">{RULE_KIND_COPY[k].label}</span>
                            <span className="text-xs text-muted-foreground">{RULE_KIND_COPY[k].hint}</span>
                        </button>
                    ))}
                </div>
            </fieldset>
            <div className={cn('grid gap-3', needs === 2 && 'sm:grid-cols-2')}>
                <FormField label={needs === 2 ? 'First subject' : 'Subject'} htmlFor="rule-a"><SelectField id="rule-a" value={a} onChange={setA} options={options} placeholder="Choose a subject" /></FormField>
                {needs === 2 && <FormField label="Second subject" htmlFor="rule-b"><SelectField id="rule-b" value={b} onChange={setB} options={options.map(o => ({ ...o, disabled: o.id === a }))} placeholder="Choose a subject" /></FormField>}
            </div>
            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold text-muted-foreground">Classes</legend>
                <div className="flex flex-wrap gap-1.5">
                    <button type="button" aria-pressed={classes.length === 0} onClick={() => setClasses([])}
                        className={cn('min-h-9 rounded-full border px-3 text-sm font-medium', classes.length === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
                        Every class
                    </button>
                    {plan.classes.map(c => (
                        <button key={c.streamId} type="button" aria-pressed={classes.includes(c.streamId)} onClick={() => toggleClass(c.streamId)}
                            className={cn('min-h-9 rounded-full border px-3 text-sm font-medium', classes.includes(c.streamId) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
                            {c.name}
                        </button>
                    ))}
                </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">How firm</span>
                <Segmented label="How firm" options={RULE_STRENGTHS.map(s => ({ id: s, label: RULE_STRENGTH_COPY[s].label }))} value={strength} onChange={setStrength} />
                <span className="text-xs text-muted-foreground">{RULE_STRENGTH_COPY[strength].hint}.</span>
            </div>
            {conflicts.length > 0 && <Conflicts lines={conflicts} />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button disabled={!draft || saving} onClick={() => draft && onAdd(draft)}><Plus />{saving ? 'Saving…' : 'Add rule'}</Button>
            </div>
        </div>
    );
}

/** Why a rule cannot be kept in some classes, whatever the timetable. */
function Conflicts({ lines }: { lines: readonly string[] }) {
    return (
        <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
                <p className="font-medium">Cannot be kept everywhere</p>
                <ul className="mt-1 list-disc pl-4 text-xs">{lines.map(l => <li key={l}>{l}</li>)}</ul>
            </div>
        </div>
    );
}

/**
 * Rules: the school's own, as a timetabler sets them (two subjects not on
 * the same day, not one after the other, a subject not on days in a row),
 * each a must or a preference; switches for the built-in rules on doubles;
 * and the subjects whose doubles may run across a short break.
 */
export function RulesStep({ plan, config, onChange }: { plan: TimetablePlan; config: TimetableConfig; onChange: () => void }) {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const subjects = useMemo(() => subjectTimeRows(plan), [plan]);
    const { relations, doubles, span_short_break: spans } = config.rules;
    const nameOf = (ids: readonly string[]) => subjects.find(s => s.ids.some(id => ids.includes(id)))?.name ?? 'A removed subject';
    const classNames = new Map(plan.classes.map(c => [c.streamId, c.name]));
    const withDoubles = useMemo(() => {
        const ids = new Set(plan.classes.flatMap(c => [...c.core, ...c.blocks.flatMap(b => b.loads)]).filter(l => l.doubles > 0).map(l => l.subjectId));
        return subjects.filter(s => s.ids.some(id => ids.has(id)));
    }, [plan, subjects]);

    const save = async (key: string, patch: Patch, message: string) => {
        setSaving(key);
        try {
            await opsFetch(CONFIG_URL, { method: 'PATCH', json: patch });
            toast.success(message);
            onChange();
            return true;
        } catch (err) { toast.error(errorText(err)); return false; }
        finally { setSaving(null); }
    };
    const add = async (rule: TimetableRule) => {
        if (await save('add', { relations: [...relations, rule] }, 'Rule added. It applies to the next draft you generate.')) setAdding(false);
    };
    const remove = (id: string) => void save(id, { relations: relations.filter(r => r.id !== id) }, 'Rule removed.');
    const toggleSpan = (ids: readonly string[], on: boolean) => {
        const next = on ? [...spans, ...ids] : spans.filter(id => !ids.includes(id));
        void save('span', { span_short_break: next }, on ? 'Its doubles may now run across a short break.' : 'Its doubles stay within one block of lessons.');
    };

    return (
        <div className="flex flex-col gap-6">
            <Block title="Double lessons" hint="">
                <ul className="grid gap-2 md:grid-cols-3">
                    {DOUBLE_RULE_COPY.map(r => (
                        <li key={r.key}>
                            <label className="flex h-full cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-3 hover:bg-muted/40">
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{r.label}</span>
                                    <span className="block text-xs text-muted-foreground">{r.hint}</span>
                                </span>
                                <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-primary" checked={doubles[r.key]} disabled={saving === r.key}
                                    onChange={e => void save(r.key, { doubles: { [r.key]: e.target.checked } }, e.target.checked ? `${r.label}: on.` : `${r.label}: off.`)} />
                            </label>
                        </li>
                    ))}
                </ul>
            </Block>

            <Block title="Your rules" hint="">
                {relations.length === 0 && !adding && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No rules yet.</p>
                )}
                {relations.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {relations.map(r => {
                            const conflicts = ruleConflicts(r, plan.classes, plan.day.days);
                            return (
                                <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
                                    <div className="flex items-start gap-3">
                                        <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', r.strength === 'must' ? 'bg-rose-500/12 text-rose-700 dark:text-rose-300' : 'bg-sky-500/12 text-sky-700 dark:text-sky-300')}>
                                            {RULE_STRENGTH_COPY[r.strength].label}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{ruleSentence(r, nameOf)}</p>
                                            <p className="text-xs text-muted-foreground">{r.stream_ids.length === 0 ? 'Every class' : r.stream_ids.map(id => classNames.get(id) ?? 'A removed class').join(', ')}</p>
                                        </div>
                                        <Button size="icon" variant="ghost" aria-label={`Remove: ${ruleSentence(r, nameOf)}`} disabled={saving === r.id} onClick={() => remove(r.id)}><Trash2 /></Button>
                                    </div>
                                    {conflicts.length > 0 && <Conflicts lines={conflicts} />}
                                </li>
                            );
                        })}
                    </ul>
                )}
                {adding
                    ? <AddRule plan={plan} subjects={subjects} saving={saving === 'add'} onAdd={rule => void add(rule)} onCancel={() => setAdding(false)} />
                    : <Button variant="outline" className="self-start" disabled={relations.length >= MAX_RULES || subjects.length === 0} onClick={() => setAdding(true)}><Plus />Add a rule</Button>}
            </Block>

            {withDoubles.length > 0 && (
                <Block title="Doubles across a short break" hint="Never across lunch.">
                    <ul className="flex flex-wrap gap-2">
                        {withDoubles.map(s => {
                            const on = s.ids.every(id => spans.includes(id));
                            return (
                                <li key={s.key}>
                                    <label className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
                                        <input type="checkbox" className="size-4 accent-primary" checked={on} disabled={saving === 'span'} onChange={e => toggleSpan(s.ids, e.target.checked)} />
                                        {s.name}
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </Block>
            )}
        </div>
    );
}
