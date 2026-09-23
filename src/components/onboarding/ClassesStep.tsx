"use client";

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { classNames, parseStreamNames } from '@/lib/classes';
import type { Curriculum } from '@/lib/schemas';

export type StandardGrade = { id: string; code: string; name: string; curriculum: Curriculum };

/** A ticked grade: one class named after the grade, or named streams. */
export type ClassPlan = { hasStreams: boolean; streams: string };

type Props = {
    grades: StandardGrade[];
    curricula: Curriculum[];
    plans: Record<string, ClassPlan>;
    onChange: (plans: Record<string, ClassPlan>) => void;
};

const CURRICULUM_LABELS: Record<Curriculum, string> = { CBC: 'CBC', '844': '8-4-4' };

/** Grades ticked with streams switched on but none named yet. */
export function gradesMissingStreams(plans: Record<string, ClassPlan>): string[] {
    return Object.entries(plans).filter(([, p]) => p.hasStreams && parseStreamNames(p.streams).length === 0).map(([id]) => id);
}

/**
 * Pick the grades the school teaches from the standard list. Each is either
 * one class (the default — "Grade 4") or split into named streams
 * ("Form 3 East, Form 3 West").
 */
export default function ClassesStep({ grades, curricula, plans, onChange }: Props) {
    const toggle = (id: string) => {
        const next = { ...plans };
        if (next[id]) delete next[id];
        else next[id] = { hasStreams: false, streams: '' };
        onChange(next);
    };
    const update = (id: string, patch: Partial<ClassPlan>) => onChange({ ...plans, [id]: { ...plans[id], ...patch } });

    return (
        <div className="space-y-6">
            <header>
                <h2 className="mb-1 text-xl font-bold">Classes</h2>
                <p className="text-sm text-muted-foreground">
                    Tick every grade you teach. A grade is one class unless you split it into streams — learners, teachers,
                    mark sheets and report cards are all organised by class.
                </p>
            </header>

            {curricula.map(curriculum => (
                <section key={curriculum} aria-labelledby={`grades-${curriculum}`}>
                    <h3 id={`grades-${curriculum}`} className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {CURRICULUM_LABELS[curriculum]} grades
                    </h3>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                        {grades.filter(g => g.curriculum === curriculum).map(grade => {
                            const plan = plans[grade.id];
                            const streams = plan ? parseStreamNames(plan.streams) : [];
                            return (
                                <li key={grade.id} className={cn('px-4 py-3', plan && 'bg-primary/5')}>
                                    <label className="flex min-h-9 cursor-pointer items-center gap-3">
                                        <input type="checkbox" className="size-5 accent-primary" checked={Boolean(plan)} onChange={() => toggle(grade.id)} />
                                        <span className="text-sm font-medium">{grade.name}</span>
                                    </label>

                                    {plan && (
                                        <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-3">
                                            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs" role="radiogroup" aria-label={`${grade.name} classes`}>
                                                {([false, true] as const).map(hasStreams => (
                                                    <button
                                                        key={String(hasStreams)}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={plan.hasStreams === hasStreams}
                                                        onClick={() => update(grade.id, { hasStreams })}
                                                        className={cn(
                                                            'min-h-8 rounded-md px-3 font-medium transition-colors',
                                                            plan.hasStreams === hasStreams ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                                                        )}
                                                    >
                                                        {hasStreams ? 'Has streams' : 'One class'}
                                                    </button>
                                                ))}
                                            </div>
                                            {plan.hasStreams ? (
                                                <input
                                                    className="input-field w-full text-sm"
                                                    value={plan.streams}
                                                    onChange={e => update(grade.id, { streams: e.target.value })}
                                                    placeholder="Stream names, e.g. East, West"
                                                    aria-label={`${grade.name} stream names`}
                                                />
                                            ) : (
                                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Check size={14} className="text-positive" aria-hidden /> One class: {classNames(grade.name).full_name}
                                                </p>
                                            )}
                                            {plan.hasStreams && (
                                                <p className={cn('text-xs sm:col-start-2', streams.length ? 'text-muted-foreground' : 'text-caution')}>
                                                    {streams.length
                                                        ? `Creates ${streams.map(s => classNames(grade.name, s).full_name).join(', ')}`
                                                        : 'Name at least one stream, or choose "One class".'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
