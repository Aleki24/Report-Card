"use client";

import React, { useId, useState } from 'react';
import { CalendarDays, CalendarRange, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { CardHeading, FormField, InputField } from '@/components/ui';
import { formatIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface AcademicYear { id: string; name: string; start_date: string; end_date: string }
export interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; midterm_reopening_date?: string | null; reopening_date?: string | null }

type CalendarKind = 'academic_year' | 'term';

interface AcademicCalendarTabProps {
    academicYears: AcademicYear[];
    terms: Term[];
    saving: boolean;
    /** Resolves to the created row, or null when it failed (already reported). */
    onCreate: (type: CalendarKind, payload: Record<string, unknown>) => Promise<{ id: string } | null>;
    /** Asks first, then deletes. */
    onDelete: (type: CalendarKind, id: string, label: string) => void;
    onSetCurrentTerm: (term: Term) => void;
    onUpdateTermDates: (termId: string, field: 'midterm_reopening_date' | 'reopening_date', value: string) => void;
}

const EMPTY_YEAR = { name: '', start_date: '', end_date: '' };
const EMPTY_TERM = { name: '', start_date: '', end_date: '', midterm_reopening_date: '', reopening_date: '' };

const shortDate = (value: string) => formatIsoDate(value, { day: 'numeric', month: 'short', year: 'numeric' });

/** Why a start/end pair can't be saved, or null. */
function spanProblem(start: string, end: string): string | null {
    if (!start || !end) return null;
    return end <= start ? 'The end date must be after the start date.' : null;
}

function AddYearForm({ saving, onCreate, onCreated }: { saving: boolean; onCreate: AcademicCalendarTabProps['onCreate']; onCreated: (id: string) => void }) {
    const id = useId();
    const [form, setForm] = useState(EMPTY_YEAR);
    const problem = spanProblem(form.start_date, form.end_date);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const created = await onCreate('academic_year', { ...form, name: form.name.trim() });
        if (created) { setForm(EMPTY_YEAR); onCreated(created.id); }
    };

    return (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-3 sm:items-end">
            <FormField label="Year" htmlFor={`${id}-name`}><InputField id={`${id}-name`} placeholder="e.g. 2027" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></FormField>
            <FormField label="Starts" htmlFor={`${id}-start`}><InputField id={`${id}-start`} type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></FormField>
            <FormField label="Ends" htmlFor={`${id}-end`} error={problem ?? undefined}><InputField id={`${id}-end`} type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></FormField>
            <button type="submit" className="btn-primary sm:col-span-3" disabled={saving || !form.name.trim() || !form.start_date || !form.end_date || !!problem}>
                <Plus className="size-4" aria-hidden />Add year
            </button>
        </form>
    );
}

function AddTermForm({ yearId, saving, onCreate }: { yearId: string; saving: boolean; onCreate: AcademicCalendarTabProps['onCreate'] }) {
    const id = useId();
    const [form, setForm] = useState(EMPTY_TERM);
    const problem = spanProblem(form.start_date, form.end_date);
    const set = (key: keyof typeof EMPTY_TERM, value: string) => setForm(p => ({ ...p, [key]: value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (await onCreate('term', { academic_year_id: yearId, ...form, name: form.name.trim() })) setForm(EMPTY_TERM);
    };

    return (
        <form onSubmit={submit} className="rounded-xl border border-dashed border-border p-3">
            <p className="mb-3 text-sm font-semibold">Add a term</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Name" htmlFor={`${id}-name`}><InputField id={`${id}-name`} placeholder="e.g. Term 1" value={form.name} onChange={e => set('name', e.target.value)} /></FormField>
                <FormField label="Starts" htmlFor={`${id}-start`}><InputField id={`${id}-start`} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></FormField>
                <FormField label="Ends" htmlFor={`${id}-end`} error={problem ?? undefined}><InputField id={`${id}-end`} type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => set('end_date', e.target.value)} /></FormField>
                <FormField label="Reopens after mid-term" htmlFor={`${id}-mid`} hint="Optional"><InputField id={`${id}-mid`} type="date" value={form.midterm_reopening_date} onChange={e => set('midterm_reopening_date', e.target.value)} /></FormField>
                <FormField label="Reopens after term" htmlFor={`${id}-reopen`} hint="Optional"><InputField id={`${id}-reopen`} type="date" value={form.reopening_date} onChange={e => set('reopening_date', e.target.value)} /></FormField>
                <div className="flex items-end">
                    <button type="submit" className="btn-primary w-full" disabled={saving || !form.name.trim() || !form.start_date || !form.end_date || !!problem}>
                        <Plus className="size-4" aria-hidden />Add term
                    </button>
                </div>
            </div>
        </form>
    );
}

function TermCard({ term, saving, onSetCurrent, onDelete, onUpdateDates }: {
    term: Term;
    saving: boolean;
    onSetCurrent: () => void;
    onDelete: () => void;
    onUpdateDates: AcademicCalendarTabProps['onUpdateTermDates'];
}) {
    const id = useId();
    return (
        <li className={cn('rounded-xl border p-4', term.is_current ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : 'border-border/70')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {term.name}
                        {term.is_current && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-3" aria-hidden />Current
                            </span>
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground">{shortDate(term.start_date)} – {shortDate(term.end_date)}</p>
                </div>
                <div className="flex gap-1">
                    {!term.is_current && (
                        <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={onSetCurrent} disabled={saving}>Make current</button>
                    )}
                    <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={onDelete} disabled={saving} aria-label={`Delete ${term.name}`} title="Delete">
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                <FormField label="Reopens after mid-term" htmlFor={`${id}-mid`} hint="Printed on mid-term report cards.">
                    <InputField id={`${id}-mid`} type="date" value={term.midterm_reopening_date || ''} onChange={e => onUpdateDates(term.id, 'midterm_reopening_date', e.target.value)} />
                </FormField>
                <FormField label="Reopens after term" htmlFor={`${id}-reopen`} hint="Printed on end-of-term report cards as “Next term begins”.">
                    <InputField id={`${id}-reopen`} type="date" value={term.reopening_date || ''} onChange={e => onUpdateDates(term.id, 'reopening_date', e.target.value)} />
                </FormField>
            </div>
        </li>
    );
}

/**
 * Academic years and their terms. The current term drives what the
 * dashboard, attendance and report cards treat as "now"; the reopening dates
 * print on report cards.
 */
export function AcademicCalendarTab({ academicYears, terms, saving, onCreate, onDelete, onSetCurrentTerm, onUpdateTermDates }: AcademicCalendarTabProps) {
    const [selectedYearId, setSelectedYearId] = useState(() => {
        const current = terms.find(t => t.is_current);
        return current?.academic_year_id ?? academicYears[0]?.id ?? '';
    });
    const yearId = academicYears.some(y => y.id === selectedYearId) ? selectedYearId : academicYears[0]?.id ?? '';
    const yearTerms = terms.filter(t => t.academic_year_id === yearId).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const hasCurrent = terms.some(t => t.is_current);

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <CardHeading icon={CalendarRange} hue="blue" title="Academic years" description="Pick a year to see and edit its terms." />
                {academicYears.length === 0 ? (
                    <p className="mb-4 text-sm text-muted-foreground">No academic years yet. Add the current one below.</p>
                ) : (
                    <ul className="mb-4 space-y-2">
                        {academicYears.map(y => {
                            const count = terms.filter(t => t.academic_year_id === y.id).length;
                            const selected = y.id === yearId;
                            return (
                                <li key={y.id} className={cn('flex items-center gap-2 rounded-xl border p-1 pr-2 transition-colors', selected ? 'border-blue-500/50 bg-blue-500/[0.06]' : 'border-border/70 hover:border-blue-500/30')}>
                                    <button type="button" aria-pressed={selected} onClick={() => setSelectedYearId(y.id)} className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left">
                                        <span className="block font-semibold">{y.name}</span>
                                        <span className="block text-xs text-muted-foreground">{shortDate(y.start_date)} – {shortDate(y.end_date)} · {count} term{count === 1 ? '' : 's'}</span>
                                    </button>
                                    <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => onDelete('academic_year', y.id, y.name)} disabled={saving} aria-label={`Delete ${y.name}`} title="Delete">
                                        <Trash2 className="size-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <AddYearForm saving={saving} onCreate={onCreate} onCreated={setSelectedYearId} />
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <CardHeading
                    icon={CalendarDays}
                    hue="violet"
                    title={yearId ? `Terms in ${academicYears.find(y => y.id === yearId)?.name ?? ''}` : 'Terms'}
                    description="Exactly one term is current across the school; it is what the dashboard, attendance and report cards treat as now."
                />
                {!hasCurrent && terms.length > 0 && (
                    <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">No term is marked current. Make one current so reports and attendance know which term it is.</p>
                )}
                {!yearId ? (
                    <p className="text-sm text-muted-foreground">Add an academic year first.</p>
                ) : (
                    <>
                        {yearTerms.length === 0 ? (
                            <p className="mb-4 text-sm text-muted-foreground">No terms in this year yet.</p>
                        ) : (
                            <ul className="mb-4 space-y-3">
                                {yearTerms.map(t => (
                                    <TermCard
                                        key={t.id}
                                        term={t}
                                        saving={saving}
                                        onSetCurrent={() => onSetCurrentTerm(t)}
                                        onDelete={() => onDelete('term', t.id, t.name)}
                                        onUpdateDates={onUpdateTermDates}
                                    />
                                ))}
                            </ul>
                        )}
                        <AddTermForm key={yearId} yearId={yearId} saving={saving} onCreate={onCreate} />
                    </>
                )}
            </section>
        </div>
    );
}
