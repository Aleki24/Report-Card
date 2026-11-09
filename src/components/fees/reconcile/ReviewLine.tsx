"use client";

import React, { useState } from 'react';
import { Check, CircleAlert, Split, UserPlus, X } from 'lucide-react';
import { formatKsh } from '@/lib/fee-account';
import { MATCH_REASON_LABELS } from '@/lib/fee-matching';
import { STATUS_COPY, type DirectoryLearner, type PreviewLine } from '@/lib/fee-reconcile';
import type { LineDecision } from '@/lib/fee-reconcile-plan';
import { TONES } from '@/components/ui/tones';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/lib/dates';
import { LearnerPicker, balanceNote, learnerLine } from './LearnerPicker';

export interface ReviewLineActions {
    recordTo: (studentId: string) => void;
    split: (studentIds: string[]) => void;
    share: (studentId: string, amount: number) => void;
    /** Leave it in the unmatched queue; omitted where it already is. */
    queue?: () => void;
    /** Set it aside as not school fees; omitted where the footer does it. */
    skip?: () => void;
}

const when = (line: Pick<PreviewLine, 'date' | 'time'>) => `${formatIsoDate(line.date, { day: 'numeric', month: 'short', year: 'numeric' })}${line.time ? `, ${line.time.slice(0, 5)}` : ''}`;

/** One payment in from the statement: who sent it, what they typed, and where it goes. */
export function ReviewLine({ line, decision, learners, byId, problem, actions, footer }: {
    line: PreviewLine;
    decision: LineDecision | undefined;
    learners: readonly DirectoryLearner[];
    byId: ReadonlyMap<string, DirectoryLearner>;
    problem: string | null;
    actions: ReviewLineActions;
    /** What ends the line (the unmatched queue's Assign), after the choices. */
    footer?: React.ReactNode;
}) {
    /** The learner search, to pick someone else or add a child to a split. */
    const [picker, setPicker] = useState<null | 'replace' | 'add'>(null);
    const copy = STATUS_COPY[line.status];
    const chosen = decision?.action === 'RECORD' ? decision.allocations : [];
    const splitting = chosen.length > 1;
    const name = (id: string) => byId.get(id);

    return (
        <li className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-semibold tabular-nums">{formatKsh(line.amount)}</span>
                        <span className="text-muted-foreground">{when(line)}</span>
                        {line.code && <span className="font-mono text-xs text-muted-foreground">{line.code}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {[line.payerName, line.phone].filter(Boolean).join(' · ') || 'Payer not shown'}
                        {' · '}{line.accountRef ? <>typed <span className="font-semibold text-foreground">“{line.accountRef}”</span></> : 'no account number'}
                    </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TONES[copy.hue].tile)}>{copy.label}</span>
            </div>

            {line.status === 'RECORDED' && line.recorded && (
                <p className="text-xs text-muted-foreground">
                    Recorded as receipt <span className="font-mono">{line.recorded.receiptNumber}</span>{line.recorded.unmatched ? ', waiting to be matched' : ''}.
                    {Math.abs(line.recorded.amount - line.amount) > 0.009 && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">Skulbase has {formatKsh(line.recorded.amount)}: check it.</span>}
                </p>
            )}

            {line.status !== 'RECORDED' && (
                <>
                    {line.candidates.length > 0 && !splitting && (
                        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Who the payment is for">
                            {line.candidates.map(c => {
                                const l = name(c.studentId);
                                const on = chosen.length === 1 && chosen[0].studentId === c.studentId;
                                return (
                                    <button
                                        key={c.studentId}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        onClick={() => actions.recordTo(c.studentId)}
                                        // Phones: the reason goes under the name, so the name is never squeezed out.
                                        className={cn('flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3', on ? 'border-emerald-500/60 bg-emerald-500/[0.08]' : 'border-border hover:border-emerald-500/40')}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            {on ? <Check className="size-4 shrink-0 text-emerald-600" aria-hidden /> : <span className="size-4 shrink-0 rounded-full border border-border" aria-hidden />}
                                            <span className="min-w-0 truncate">{l ? learnerLine(l) : 'A learner'}</span>
                                        </span>
                                        <span className="pl-6 text-[11px] text-muted-foreground sm:shrink-0 sm:pl-0">{MATCH_REASON_LABELS[c.reason]}{l ? ` · ${balanceNote(l.balance)}` : ''}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {chosen.length === 1 && !line.candidates.some(c => c.studentId === chosen[0].studentId) && (
                        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/[0.08] px-3 py-2 text-sm">
                            <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                            <span className="min-w-0 truncate">{name(chosen[0].studentId) ? learnerLine(name(chosen[0].studentId)!) : 'A learner'}</span>
                        </p>
                    )}

                    {splitting && (
                        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
                            <legend className="px-1 text-xs font-semibold text-muted-foreground">Shared between learners</legend>
                            {chosen.map(a => (
                                <div key={a.studentId} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <span className="min-w-0 flex-1 truncate text-sm">{name(a.studentId) ? learnerLine(name(a.studentId)!) : 'A learner'}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number" min={1} step="0.01" inputMode="decimal" aria-label={`Share for ${name(a.studentId)?.name ?? 'this learner'}`}
                                            className="input-field h-9 w-32 text-right tabular-nums"
                                            value={a.amount}
                                            onChange={e => actions.share(a.studentId, Number(e.target.value))}
                                        />
                                        <button type="button" className="btn-icon" aria-label="Remove from the split" onClick={() => actions.split(chosen.filter(x => x.studentId !== a.studentId).map(x => x.studentId))}>
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </fieldset>
                    )}

                    {picker && (
                        <LearnerPicker
                            learners={learners}
                            exclude={chosen.map(a => a.studentId)}
                            autoFocus
                            placeholder={picker === 'add' ? 'Add a brother or sister to the split' : undefined}
                            onPick={l => { setPicker(null); if (picker === 'add') actions.split([...chosen.map(a => a.studentId), l.id]); else actions.recordTo(l.id); }}
                        />
                    )}

                    {problem && <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><CircleAlert className="size-3.5" aria-hidden />{problem}</p>}

                    <div className="flex flex-wrap gap-1.5 text-xs">
                        <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => setPicker(p => (p ? null : splitting ? 'add' : 'replace'))}>
                            <UserPlus className="size-3.5" aria-hidden />{splitting ? 'Add a learner' : 'Someone else'}
                        </button>
                        {!splitting && (line.candidates.length > 1 || chosen.length === 1) && (
                            <button
                                type="button"
                                className="btn-secondary h-8 px-3 text-xs"
                                title="One payment for several children"
                                onClick={() => {
                                    // Several suggested (siblings by the family's phone): share between them; else add a child to the one chosen.
                                    if (line.candidates.length > 1) actions.split(line.candidates.map(c => c.studentId));
                                    else setPicker('add');
                                }}
                            >
                                <Split className="size-3.5" aria-hidden />Split between children
                            </button>
                        )}
                        {actions.queue && (
                            <button type="button" aria-pressed={decision?.action === 'QUEUE'} className={cn('btn-secondary h-8 px-3 text-xs', decision?.action === 'QUEUE' && 'border-amber-500/60 text-amber-800 dark:text-amber-200')} onClick={actions.queue}>
                                Leave unmatched
                            </button>
                        )}
                        {actions.skip && (
                            <button type="button" aria-pressed={decision?.action === 'SKIP'} className={cn('btn-secondary h-8 px-3 text-xs', decision?.action === 'SKIP' && 'border-slate-500/60')} onClick={actions.skip}>
                                Not school fees
                            </button>
                        )}
                    </div>
                    {footer}
                </>
            )}
        </li>
    );
}
