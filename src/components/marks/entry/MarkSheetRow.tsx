"use client";

import React from 'react';
import { Check, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import type { ExamSubjectComponent } from '@/types';
import type { EntryValues, RowStatus } from '@/lib/mark-entry';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';

export interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
}

export interface MarkSheetLearner {
    id: string;
    name: string;
    admissionNumber: string;
    streamName: string | null;
}

interface MarkSheetRowProps {
    index: number;
    learner: MarkSheetLearner;
    values: EntryValues;
    status: RowStatus;
    /** Validation message for the row, if any. */
    error: string | null;
    /** Final percentage shown for multi-paper rows (null until a paper is entered). */
    finalPercentage: number | null;
    /** Whether any paper is still blank on a multi-paper row that has a score. */
    incompletePapers: boolean;
    maxScore: number;
    components: readonly ExamSubjectComponent[];
    groupedGrades: [string, GradeOption[]][];
    onScore: (value: string) => void;
    onPaper: (componentId: string, value: string) => void;
    onGrade: (value: string) => void;
    onRemarks: (value: string) => void;
    onUndo: () => void;
    onRemove: () => void;
    onScoreKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, column: string) => void;
}

const STATUS_META: Record<RowStatus, { label: string; className: string; icon: React.ReactNode }> = {
    saved: { label: 'Saved', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: <Check size={12} aria-hidden /> },
    changed: { label: 'Edited', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: <Pencil size={11} aria-hidden /> },
    new: { label: 'New', className: 'bg-primary/10 text-primary', icon: <Plus size={12} aria-hidden /> },
    removing: { label: 'Will remove', className: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: <Trash2 size={11} aria-hidden /> },
    empty: { label: 'Not entered', className: 'bg-muted text-muted-foreground', icon: null },
};

/** Row tint: a glance down the sheet shows what is about to change. */
const ROW_TONE: Record<RowStatus, string> = {
    saved: '',
    empty: '',
    changed: 'bg-amber-500/[0.06]',
    new: 'bg-primary/[0.04]',
    removing: 'bg-red-500/[0.05]',
};

const inputBase =
    'h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground tabular-nums shadow-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20';

function StatusBadge({ status }: { status: RowStatus }) {
    const meta = STATUS_META[status];
    return (
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', meta.className)}>
            {meta.icon}
            {meta.label}
        </span>
    );
}

function RowActions({ status, name, onUndo, onRemove }: { status: RowStatus; name: string; onUndo: () => void; onRemove: () => void }) {
    const canUndo = status === 'changed' || status === 'removing' || status === 'new';
    const canRemove = status === 'saved' || status === 'changed';
    return (
        <div className="flex items-center gap-1">
            {canUndo && (
                <button
                    type="button"
                    onClick={onUndo}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={status === 'new' ? `Clear what you typed for ${name}` : `Put back ${name}'s saved mark`}
                >
                    <Undo2 size={14} aria-hidden />
                    <span>Undo</span>
                </button>
            )}
            {canRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"
                    title={`Remove ${name}'s mark (e.g. they did not sit the exam)`}
                    aria-label={`Remove ${name}'s mark`}
                >
                    <Trash2 size={14} aria-hidden />
                </button>
            )}
        </div>
    );
}

/** Small caption shown above an input on phones, where there is no column header. */
function MobileLabel({ children }: { children: React.ReactNode }) {
    return <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">{children}</span>;
}

export function MarkSheetRow({
    index, learner, values, status, error, finalPercentage, incompletePapers, maxScore, components, groupedGrades,
    onScore, onPaper, onGrade, onRemarks, onUndo, onRemove, onScoreKeyDown,
}: MarkSheetRowProps) {
    const multiPaper = components.length > 0;
    const invalid = !!error;
    const scoreInputClass = cn(inputBase, invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-border');

    return (
        <div
            role="row"
            className={cn(
                'grid grid-cols-1 gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 lg:items-center lg:gap-3 lg:px-5 lg:py-2 lg:[grid-template-columns:var(--sheet-cols)]',
                ROW_TONE[status],
                invalid && 'bg-red-500/[0.06]',
            )}
        >
            <span role="cell" className="hidden text-xs tabular-nums text-muted-foreground lg:block">{index + 1}</span>

            {/* Learner — on phones the status and actions ride along on this line */}
            <div role="cell" className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar name={learner.name} seed={learner.id} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{learner.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                            {learner.admissionNumber || 'No adm. no.'}
                            {learner.streamName && <> · {learner.streamName}</>}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 lg:hidden">
                    <StatusBadge status={status} />
                    <RowActions status={status} name={learner.name} onUndo={onUndo} onRemove={onRemove} />
                </div>
            </div>

            {/* Score inputs + grade: wrap on phones, become grid cells on wider screens */}
            <div className="flex flex-wrap gap-2 lg:contents">
                {multiPaper ? (
                    <>
                        {components.map(c => (
                            <label key={c.id} role="cell" className="block w-[5.5rem] lg:w-auto">
                                <MobileLabel>{c.component_code} /{Number(c.max_score)}</MobileLabel>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    data-score-col={c.id}
                                    aria-label={`${learner.name} ${c.component_name || c.component_code} score out of ${Number(c.max_score)}`}
                                    aria-invalid={invalid}
                                    className={scoreInputClass}
                                    placeholder={`/${Number(c.max_score)}`}
                                    value={values.componentScores[c.id] ?? ''}
                                    onChange={e => onPaper(c.id, e.target.value)}
                                    onKeyDown={e => onScoreKeyDown(e, c.id)}
                                    onFocus={e => e.currentTarget.select()}
                                />
                            </label>
                        ))}
                        <div role="cell" className="w-[5.5rem] lg:w-auto">
                            <MobileLabel>Final</MobileLabel>
                            <div className="flex h-10 items-center text-sm font-semibold tabular-nums text-primary" title={incompletePapers ? 'Some papers are still blank and count as 0' : undefined}>
                                {finalPercentage === null ? <span className="text-muted-foreground">—</span> : <>{finalPercentage.toFixed(1)}%{incompletePapers && <span className="text-muted-foreground">*</span>}</>}
                            </div>
                        </div>
                    </>
                ) : (
                    <label role="cell" className="block w-28 lg:w-auto">
                        <MobileLabel>Score /{maxScore}</MobileLabel>
                        <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            data-score-col="score"
                            aria-label={`${learner.name} score out of ${maxScore}`}
                            aria-invalid={invalid}
                            className={cn(scoreInputClass, 'font-semibold')}
                            placeholder={`0–${maxScore}`}
                            value={values.score}
                            onChange={e => onScore(e.target.value)}
                            onKeyDown={e => onScoreKeyDown(e, 'score')}
                            onFocus={e => e.currentTarget.select()}
                        />
                    </label>
                )}

                <label role="cell" className="block w-28 lg:w-auto">
                    <MobileLabel>Grade</MobileLabel>
                    <select
                        className={cn(inputBase, 'border-border pr-2 font-semibold', values.gradeOverridden && 'border-primary/50')}
                        aria-label={`${learner.name} grade`}
                        value={values.grade}
                        onChange={e => onGrade(e.target.value)}
                        title={values.gradeOverridden ? 'Grade chosen by hand — pick "Auto" to follow the score again' : 'Worked out from the score; you can override it'}
                    >
                        <option value="">{values.gradeOverridden ? 'Auto' : '—'}</option>
                        {groupedGrades.map(([systemName, options]) => (
                            <optgroup key={systemName} label={systemName}>
                                {options.map(o => (
                                    <option key={`${systemName}-${o.symbol}`} value={o.symbol}>
                                        {o.symbol}{o.label ? ` — ${o.label}` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </label>
            </div>

            <label role="cell" className="block">
                <MobileLabel>Remarks</MobileLabel>
                <input
                    type="text"
                    autoComplete="off"
                    className={cn(inputBase, 'border-border')}
                    aria-label={`${learner.name} remarks`}
                    placeholder="Optional remark"
                    value={values.remarks}
                    onChange={e => onRemarks(e.target.value)}
                />
            </label>

            <div role="cell" className="hidden items-center justify-end gap-2 lg:flex">
                <StatusBadge status={status} />
                <RowActions status={status} name={learner.name} onUndo={onUndo} onRemove={onRemove} />
            </div>

            {error && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 lg:col-span-full lg:pl-[calc(2rem+0.75rem)]">
                    {error}
                </p>
            )}
        </div>
    );
}
