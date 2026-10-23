import React from 'react';
import { BellRing, Camera, Check, FileSpreadsheet, Keyboard, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { examDay } from '@/lib/exam-schedule';
import { STEP_TONES } from '../examTheme';
import type { EntryMode } from './model';

/** The Mark Entry tab's small building blocks. */

export const MODES: { id: EntryMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'manual', label: 'Type marks', hint: 'Type or correct marks learner by learner', icon: <Keyboard size={15} aria-hidden /> },
  { id: 'bulk', label: 'Upload file', hint: 'Import a spreadsheet of marks', icon: <FileSpreadsheet size={15} aria-hidden /> },
  { id: 'scan', label: 'Scan sheet', hint: 'Photograph a paper marksheet and review what was read', icon: <Camera size={15} aria-hidden /> },
];

export function ChoiceChip({ active, onClick, children, title, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function StepCard({ step, title, hint, done, children, aside }: { step: number; title: string; hint?: string; done?: boolean; children: React.ReactNode; aside?: React.ReactNode }) {
  const tone = STEP_TONES[(step - 1) % STEP_TONES.length];
  return (
    <section className="relative h-full rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      {/* A thin strip in the step's colour ties the card to its number. */}
      <span aria-hidden className={cn('absolute inset-y-0 -left-px w-1 rounded-l-2xl', tone.dot, !done && 'opacity-40')} />
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors', done ? tone.solid : tone.tile)}
          aria-hidden
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : step}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <span className="min-w-0">{message}</span>
      <button type="button" onClick={onRetry} className="btn-secondary h-9 shrink-0 px-3 text-xs">
        <RefreshCw size={14} aria-hidden /> Try again
      </button>
    </div>
  );
}

/** "Now" on the exam the term is on, the date on one not yet sat. */
export function ExamTiming({ active, isNow, anytime, date, today }: { active: boolean; isNow: boolean; anytime: boolean; date?: string; today: string }) {
  if (anytime) {
    return <span className={cn('text-[10px] font-medium', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>any time</span>;
  }
  if (isNow) {
    return <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', active ? 'bg-white/20' : 'bg-primary/10 text-primary')}>NOW</span>;
  }
  if (date && date > today) {
    return <span className={cn('text-[10px] font-medium', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>from {examDay(date)}</span>;
  }
  return null;
}

/** A teacher's "ask for an exam to be opened", and its answer once sent. */
export function RequestExamNotice({ title, asked, busy, error, onRequest }: { title: string; asked: boolean; busy: boolean; error: string; onRequest: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <BellRing className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            {asked
              ? 'You’ve asked. Your admin, principal or DOS will see it and open the right exam.'
              : 'Ask your admin, principal or DOS to open it, so your marks go into the right exam.'}
          </p>
          {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
      {!asked && (
        <button type="button" onClick={onRequest} disabled={busy} className="btn-secondary h-9 shrink-0 px-3 text-xs">
          {busy ? 'Sending…' : 'Ask for the exam'}
        </button>
      )}
    </div>
  );
}
