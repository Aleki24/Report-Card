"use client";

import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Loader2, Minus } from 'lucide-react';
import { FormField, SelectField } from '@/components/ui';
import { TermSelect, type TermSelectTerm, type TermSelectYear } from '@/components/ui/TermSelect';
import { TONES } from '@/components/ui/tones';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import type { TermComparisonResponse } from '@/app/api/reports/term-comparison/route';
import { ReportDialog } from './ReportDialog';

export interface ComparisonTerm extends TermSelectTerm { start_date?: string }

interface TermComparisonModalProps {
    onClose: () => void;
    /** Newest first. */
    academicYears: readonly TermSelectYear[];
    terms: readonly ComparisonTerm[];
    gradeStreams: readonly { id: string; full_name: string }[];
    /** The class and term chosen on the page, to start from. */
    initialStreamId: string;
    initialTermId: string;
}

/** What the request for `key` settled as; a different key means it is still loading. */
type Settled = { key: string; data: TermComparisonResponse; message?: never } | { key: string; message: string; data?: never };
type Load = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; data: TermComparisonResponse } | { state: 'error'; message: string };

/** Terms oldest first, by start date where known. */
function chronological(terms: readonly ComparisonTerm[]): ComparisonTerm[] {
    return [...terms].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
}

function Change({ value, unit = '%' }: { value: number | null; unit?: string }) {
    if (value == null) return <span className="text-muted-foreground">–</span>;
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    return (
        <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            <Icon className="size-3.5" aria-hidden />{value > 0 ? '+' : ''}{value}{unit}
        </span>
    );
}

function Figure({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/70 bg-card p-3 text-center">
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

/** How one class moved between two terms, overall and subject by subject. */
export function TermComparisonModal({ onClose, academicYears, terms, gradeStreams, initialStreamId, initialTermId }: TermComparisonModalProps) {
    const id = useId();
    const ordered = useMemo(() => chronological(terms), [terms]);
    const [streamId, setStreamId] = useState(initialStreamId || (gradeStreams.length === 1 ? gradeStreams[0].id : ''));
    const [compareTermId, setCompareTermId] = useState(initialTermId || ordered.at(-1)?.id || '');
    const [baseTermId, setBaseTermId] = useState(() => {
        // The term before the one being looked at, by default.
        const at = ordered.findIndex(t => t.id === (initialTermId || ordered.at(-1)?.id));
        return at > 0 ? ordered[at - 1].id : '';
    });
    const [settled, setSettled] = useState<Settled | null>(null);

    const termLabel = (termId: string) => {
        const term = terms.find(t => t.id === termId);
        const year = academicYears.find(y => y.id === term?.academic_year_id);
        return term ? [term.name, year?.name].filter(Boolean).join(' · ') : '';
    };

    const sameTerm = Boolean(baseTermId) && baseTermId === compareTermId;
    const ready = Boolean(streamId && baseTermId && compareTermId) && !sameTerm;

    const key = ready ? new URLSearchParams({ grade_stream_id: streamId, base_term_id: baseTermId, compare_term_id: compareTermId }).toString() : '';

    useEffect(() => {
        if (!key) return;
        const controller = new AbortController();
        fetch(`/api/reports/term-comparison?${key}`, { signal: controller.signal })
            .then(async res => {
                const json: unknown = await res.json().catch(() => null);
                if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not compare these terms.'));
                setSettled({ key, data: json as TermComparisonResponse });
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setSettled({ key, message: err instanceof Error ? err.message : 'Could not compare these terms.' });
            });
        return () => controller.abort();
    }, [key]);

    const load: Load = !key ? { state: 'idle' }
        : settled?.key !== key ? { state: 'loading' }
        : settled.data ? { state: 'ready', data: settled.data }
        : { state: 'error', message: settled.message ?? 'Could not compare these terms.' };

    const data = load.state === 'ready' ? load.data : null;
    const meanChange = data?.base.mean != null && data.compare.mean != null ? data.compare.mean - data.base.mean : null;
    const passChange = data?.base.pass_rate != null && data.compare.pass_rate != null ? data.compare.pass_rate - data.base.pass_rate : null;

    return (
        <ReportDialog
            title="Compare terms"
            subtitle="The class's average over every exam it sat each term, overall and by subject."
            icon={BarChart3}
            tone={TONES.rose}
            onClose={onClose}
            maxWidth="max-w-2xl"
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Class" htmlFor={`${id}-class`}>
                    <SelectField id={`${id}-class`} value={streamId} onChange={setStreamId} options={gradeStreams.map(g => ({ id: g.id, label: g.full_name }))} placeholder="Choose class" />
                </FormField>
                <FormField label="From" htmlFor={`${id}-base`}>
                    <TermSelect id={`${id}-base`} terms={terms} years={academicYears} value={baseTermId} onChange={setBaseTermId} emptyLabel="Choose term" />
                </FormField>
                <FormField label="To" htmlFor={`${id}-compare`} error={sameTerm ? 'Choose a different term.' : undefined}>
                    <TermSelect id={`${id}-compare`} terms={terms} years={academicYears} value={compareTermId} onChange={setCompareTermId} emptyLabel="Choose term" />
                </FormField>
            </div>

            <div className="mt-5" aria-live="polite">
                {load.state === 'idle' && !sameTerm && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Choose a class and two terms.</p>
                )}
                {load.state === 'loading' && (
                    <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Comparing…</p>
                )}
                {load.state === 'error' && <p className="py-6 text-center text-sm text-destructive">{load.message}</p>}
                {data && (data.base.mark_count === 0 || data.compare.mark_count === 0) && (
                    <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                        {data.base.mark_count === 0 ? termLabel(baseTermId) : termLabel(compareTermId)} has no marks for this class, so there is nothing to compare it with yet.
                    </p>
                )}
                {data && (
                    <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Figure label={termLabel(baseTermId)} value={data.base.mean != null ? `${data.base.mean}%` : '–'} sub={`${data.base.mark_count.toLocaleString()} marks`} />
                            <Figure label={termLabel(compareTermId)} value={data.compare.mean != null ? `${data.compare.mean}%` : '–'} sub={`${data.compare.mark_count.toLocaleString()} marks`} />
                            <Figure label="Average change" value={<Change value={meanChange} />} />
                            <Figure label="Pass rate change" value={<Change value={passChange} unit=" pts" />} sub={`Pass mark ${data.pass_mark}%`} />
                        </div>

                        {data.subjects.length > 0 && (
                            <div className="mt-5 overflow-hidden rounded-xl border border-border/70">
                                <table className="w-full text-sm">
                                    <caption className="sr-only">Subject averages in each term</caption>
                                    <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                                        <tr>
                                            <th scope="col" className="px-3 py-2 text-left font-semibold">Subject</th>
                                            <th scope="col" className="px-2 py-2 text-right font-semibold">From</th>
                                            <th scope="col" className="px-2 py-2 text-right font-semibold">To</th>
                                            <th scope="col" className="px-3 py-2 text-right font-semibold">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {data.subjects.map(s => (
                                            <tr key={s.subject_id}>
                                                <th scope="row" className="max-w-0 truncate px-3 py-2 text-left font-medium">{s.subject_name}</th>
                                                <td className="px-2 py-2 text-right tabular-nums">{s.base != null ? `${s.base}%` : '–'}</td>
                                                <td className="px-2 py-2 text-right tabular-nums">{s.compare != null ? `${s.compare}%` : '–'}</td>
                                                <td className="px-3 py-2 text-right"><Change value={s.change} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="mt-3 text-[11px] text-muted-foreground">Uses the learners in this class today, so a learner who joined or left counts only where they have marks.</p>
                    </>
                )}
            </div>
        </ReportDialog>
    );
}
