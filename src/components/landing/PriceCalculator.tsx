"use client";

import React, { useId, useState } from 'react';
import { PER_LEARNER_ABOVE, YEAR_DISCOUNT, cyclePrice, formatKes, planFor, termPrice, type BillingCycle } from '@/lib/pricing';
import { cn } from '@/lib/utils';

const CYCLES: readonly { id: BillingCycle; label: string }[] = [
  { id: 'term', label: 'Per term' },
  { id: 'year', label: `Per year · save ${Math.round(YEAR_DISCOUNT * 100)}%` },
];

/** A school types its number of learners and sees its price, by the term or the year. */
export function PriceCalculator() {
  const id = useId();
  const [learners, setLearners] = useState(350);
  const [cycle, setCycle] = useState<BillingCycle>('term');
  const plan = planFor(learners);
  const price = cyclePrice(learners, cycle);
  const perLearner = termPrice(learners) / Math.max(1, learners);

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-n`} className="text-sm font-semibold text-foreground">Learners in your school</label>
        <div className="flex items-center gap-3">
          <input id={`${id}-n`} type="range" min={50} max={2500} step={10} value={learners} onChange={e => setLearners(Number(e.target.value))} className="w-full accent-primary" />
          <input type="number" min={1} max={20000} value={learners} aria-label="Learners" onChange={e => setLearners(Math.max(1, Math.min(20000, Number(e.target.value) || 1)))}
            className="input-field w-24 text-right tabular-nums" />
        </div>
      </div>
      <div role="radiogroup" aria-label="Billing" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
        {CYCLES.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={cycle === c.id} onClick={() => setCycle(c.id)}
            className={cn('min-h-10 rounded-lg px-2 font-medium transition-colors', cycle === c.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {c.label}
          </button>
        ))}
      </div>
      <div>
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-4xl font-bold text-foreground tabular-nums">{formatKes(price)}</span>
          <span className="text-sm text-muted-foreground">{cycle === 'term' ? 'a term' : 'a year'}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan ? plan.name : `${formatKes(PER_LEARNER_ABOVE)} a learner`} · about {formatKes(perLearner)} a learner a term
        </p>
      </div>
    </div>
  );
}
