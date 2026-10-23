import React from 'react';
import { DoorOpen } from 'lucide-react';
import { getExamTypeLabel } from '@/lib/exam-types';

/** A class a teacher has exams in, and the exam open there. */
export interface MarkingNowClass {
  id: string;
  name: string;
  /** The exam open for marking, or ''. */
  type: string;
  /** The teacher's subjects in that exam. */
  subjectNames: string[];
}

interface MarkingNowCardProps {
  termName: string;
  classes: readonly MarkingNowClass[];
  /** Classes the teacher has asked to have an exam opened for. */
  asked: ReadonlySet<string>;
  onPickAny: () => void;
}

/** A teacher's classes and the exam each is marking, so they never choose it themselves. */
export function MarkingNowCard({ termName, classes, asked, onPickAny }: MarkingNowCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden><DoorOpen className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Marking now · {termName}</p>
          <p className="text-xs text-muted-foreground">Choose your class and subject; the mark sheet opens on the exam your school is marking.</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border/50 rounded-xl bg-card ring-1 ring-inset ring-border/70">
        {classes.map(c => (
          <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">{c.name}</span>
            {c.type ? (
              <span className="min-w-0 text-muted-foreground">
                <span className="font-semibold text-primary">{getExamTypeLabel(c.type)}</span>
                {c.subjectNames.length > 0 && <> · {c.subjectNames.join(', ')}</>}
              </span>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-400">{asked.has(c.id) ? 'Asked · waiting for an exam' : 'No exam open yet'}</span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onPickAny} className="self-start text-xs font-medium text-primary hover:underline">
        Mark a CAT, correct an earlier exam or open another term
      </button>
    </section>
  );
}
