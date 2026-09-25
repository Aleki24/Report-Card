import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEP_TONES } from './tones';

interface StepHeadingProps {
  /** 1-based; picks the step's colour. */
  step: number;
  title: string;
  /** Solid tile with a tick once the step is complete. */
  done?: boolean;
  className?: string;
}

/** A numbered section title in its step's colour, as in the Exams & Marks picker. */
export function StepHeading({ step, title, done, className }: StepHeadingProps) {
  const tone = STEP_TONES[(step - 1) % STEP_TONES.length];
  return (
    <h3 className={cn('flex items-center gap-2.5 font-display text-[15px] font-semibold', className)}>
      <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold', done ? tone.solid : tone.tile)}>
        {done ? <Check className="size-4" strokeWidth={3} /> : step}
      </span>
      {title}
    </h3>
  );
}
