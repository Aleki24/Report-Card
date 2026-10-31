"use client";

import React, { useId } from 'react';
import { ArrowRight, ChevronDown, CircleAlert } from 'lucide-react';
import { TONES } from '@/components/ui/tones';
import { cn } from '@/lib/utils';
import {
    allowedOutcomes, decisionProblem, outcomeLabel,
    type GradeStep, type PromotionClass, type PromotionGrade, type PromotionLearner, type PromotionOutcome,
} from '@/lib/promotion';
import { OUTCOME_META, stepMeta } from './promotionMeta';
import type { PromotionPlanApi } from './usePromotionPlan';

interface OutcomePickerProps {
    step: GradeStep;
    /** The chosen outcome; omit for a row of one-click actions instead of a choice. */
    value?: PromotionOutcome | null;
    onChange: (outcome: PromotionOutcome) => void;
    label: string;
    size?: 'sm' | 'md';
}

/** The outcomes open to a grade, as one row of radio chips (or action chips, without a value). */
function OutcomePicker({ step, value, onChange, label, size = 'sm' }: OutcomePickerProps) {
    const choosing = value !== undefined;
    return (
        <div role={choosing ? 'radiogroup' : 'group'} aria-label={label} className="flex flex-wrap gap-1.5">
            {allowedOutcomes(step).map(outcome => {
                const meta = OUTCOME_META[outcome];
                const Icon = meta.icon;
                const checked = value === outcome;
                return (
                    <button
                        key={outcome}
                        type="button"
                        role={choosing ? 'radio' : undefined}
                        aria-checked={choosing ? checked : undefined}
                        onClick={() => onChange(outcome)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                            checked ? cn(TONES[meta.hue].selected, TONES[meta.hue].text) : cn('border-border text-muted-foreground hover:text-foreground', TONES[meta.hue].hover),
                        )}
                    >
                        <Icon className="size-3.5 shrink-0" aria-hidden />
                        {outcomeLabel(outcome, step)}
                    </button>
                );
            })}
        </div>
    );
}

interface ClassSelectProps {
    id?: string;
    value: string | null;
    options: PromotionGrade['nextClasses'];
    onChange: (value: string | null) => void;
    label: string;
}

function ClassSelect({ id, value, options, onChange, label }: ClassSelectProps) {
    return (
        <select
            id={id}
            aria-label={id ? undefined : label}
            className={cn('input-field h-9 w-full py-1 text-sm sm:w-56', !value && 'border-amber-500/60')}
            value={value ?? ''}
            onChange={e => onChange(e.target.value || null)}
        >
            <option value="">Choose a class…</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
        </select>
    );
}

interface LearnerRowProps {
    learner: PromotionLearner;
    classId: string;
    grade: PromotionGrade;
    plan: PromotionPlanApi;
}

function LearnerRow({ learner, classId, grade, plan }: LearnerRowProps) {
    const choice = plan.choices[learner.id];
    const nextIds = new Set(grade.nextClasses.map(c => c.id));
    const problem = choice.outcome ? decisionProblem(grade.step, { outcome: choice.outcome, to_stream_id: choice.to }, nextIds) : 'needs a decision';
    // A learner picks their own class only where the next grade has a choice of them.
    const picksClass = choice.outcome === 'PROMOTE' && grade.nextClasses.length > 1;
    return (
        <li className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="min-w-0 lg:w-56 lg:shrink-0">
                <p className="truncate text-sm font-semibold">{learner.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {learner.admission_number ? `Adm ${learner.admission_number}` : 'No admission number'}
                    {problem && <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400"><CircleAlert className="size-3" aria-hidden />{problem}</span>}
                </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <OutcomePicker step={grade.step} value={choice.outcome} onChange={outcome => plan.setLearner(learner.id, classId, { outcome })} label={`What happens to ${learner.name}`} />
                {picksClass && (
                    <ClassSelect value={choice.to} options={grade.nextClasses} onChange={to => plan.setLearner(learner.id, classId, { to })} label={`Class ${learner.name} moves into`} />
                )}
            </div>
        </li>
    );
}

interface ClassBlockProps {
    cls: PromotionClass;
    grade: PromotionGrade;
    plan: PromotionPlanApi;
    learners: PromotionLearner[];
    open: boolean;
}

function ClassBlock({ cls, grade, plan, learners, open }: ClassBlockProps) {
    const selectId = useId();
    const canMove = grade.nextClasses.length > 0;
    const pending = cls.learners.filter(l => !plan.choices[l.id].outcome).length;
    return (
        <div className="rounded-xl border border-border/70 bg-background/40">
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{cls.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                        {cls.learners.length} learner{cls.learners.length === 1 ? '' : 's'}
                        {pending > 0 && <span className="font-medium text-amber-600 dark:text-amber-400"> · {pending} to decide</span>}
                    </p>
                </div>
                {canMove && cls.learners.length > 0 && (
                    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <label htmlFor={selectId} className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <ArrowRight className="size-3.5" aria-hidden />Moves into
                        </label>
                        <ClassSelect id={selectId} value={plan.classTargets[cls.id] ?? null} options={grade.nextClasses} onChange={to => plan.setClassTarget(cls.id, to)} label={`Class ${cls.full_name} moves into`} />
                    </div>
                )}
            </div>
            {learners.length > 0 && (
                <details className="group border-t border-border/70" open={open}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground sm:px-4 [&::-webkit-details-marker]:hidden">
                        <span>{learners.length === cls.learners.length ? 'Learners' : `${learners.length} matching learner${learners.length === 1 ? '' : 's'}`}: change anyone repeating or leaving</span>
                        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="divide-y divide-border/60 px-3 sm:px-4">
                        {learners.map(l => <LearnerRow key={l.id} learner={l} classId={cls.id} grade={grade} plan={plan} />)}
                    </ul>
                </details>
            )}
        </div>
    );
}

interface GradePromotionCardProps {
    grade: PromotionGrade;
    plan: PromotionPlanApi;
    /** Lowercased search text; non-empty narrows and opens the learner lists. */
    query: string;
}

const matches = (l: PromotionLearner, query: string) =>
    !query || l.name.toLowerCase().includes(query) || (l.admission_number ?? '').toLowerCase().includes(query);

/** One grade: where its learners go, set for the whole grade, a class, or a learner. */
export function GradePromotionCard({ grade, plan, query }: GradePromotionCardProps) {
    const meta = stepMeta(grade.step, grade.name);
    const StepIcon = meta.icon;
    const classIds = grade.classes.map(c => c.id);
    const learnerCount = grade.classes.reduce((n, c) => n + c.learners.length, 0);
    const mustDecide = grade.step.kind === 'TRANSITION' && grade.step.canStay;
    const visible = grade.classes.map(cls => ({ cls, learners: cls.learners.filter(l => matches(l, query)) }));
    if (query && visible.every(v => v.learners.length === 0)) return null;

    return (
        <section aria-labelledby={`promote-${grade.id}`} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TONES[meta.hue].tile)} aria-hidden>
                        <StepIcon className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h3 id={`promote-${grade.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-base font-bold leading-tight">
                            {grade.name}
                            <ArrowRight className="size-4 text-muted-foreground" aria-label="to" />
                            <span className={TONES[meta.hue].text}>{meta.target}</span>
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {grade.curriculum} · {learnerCount} learner{learnerCount === 1 ? '' : 's'} in {grade.classes.length} class{grade.classes.length === 1 ? '' : 'es'}
                        </p>
                    </div>
                </div>
                <span className={cn('inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold', TONES[meta.hue].tile)}>{meta.badge}</span>
            </header>

            <p className={cn('mt-3 rounded-xl px-3 py-2.5 text-sm', mustDecide ? 'border border-amber-500/30 bg-amber-500/[0.07] text-foreground' : 'bg-muted/60 text-muted-foreground')}>
                {meta.explain}
            </p>

            {learnerCount > 0 && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Everyone in {grade.name}:</span>
                    <OutcomePicker step={grade.step} onChange={o => plan.setClassesOutcome(classIds, o)} label={`Set every ${grade.name} learner`} size="md" />
                </div>
            )}

            <div className="mt-4 grid gap-3">
                {visible.map(({ cls, learners }) => (
                    <ClassBlock key={cls.id} cls={cls} grade={grade} plan={plan} learners={learners} open={mustDecide || !!query} />
                ))}
            </div>
        </section>
    );
}
