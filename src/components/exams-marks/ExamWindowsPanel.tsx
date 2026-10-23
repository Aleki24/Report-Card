"use client";

import React, { useState } from 'react';
import { BellRing, Check, CheckCircle2, ChevronDown, DoorOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCHEDULED_EXAM_TYPES, getExamType } from '@/lib/exam-types';
import { LEVEL_ORDER, levelLabel, levelOf, type ExamClass, type ExamRequest, type ExamWindow, type LevelKey } from '@/lib/exam-windows';

interface ExamWindowsPanelProps {
  termId: string;
  termName: string;
  /** Every class with scheduled exams this term. */
  classes: readonly ExamClass[];
  windows: ReadonlyMap<string, string>;
  /** Teachers waiting for an exam to be opened, per class. */
  requests: readonly ExamRequest[];
  /** The saved windows, and how many papers were created for an exam a class didn't have. */
  onSaved: (windows: ExamWindow[], created: number) => void;
}

interface Level { key: LevelKey; classes: ExamClass[]; types: string[]; waiting: number }

type SaveState = { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string };

/** "Mid-Term Exam" → "Mid-Term": the chips are short. */
function examName(code: string): string {
  return (getExamType(code)?.name ?? code).replace(/ Exam$/, '');
}

const HOW_IT_WORKS = [
  { title: 'Pick the exam', body: 'Choose the exam each level is sitting, or set a class on its own.' },
  { title: 'Teachers go straight in', body: 'Their mark sheets open on that exam, so marks land in the right one.' },
  { title: 'Switch when it changes', body: 'Move a level to the next exam when it starts; earlier ones stay open for corrections.' },
] as const;

/**
 * Which exam each class is marking now. Set once per level (all of Junior
 * School on End-Term); a class that differs — Form 4 on Mock — gets its own.
 * Choices show at once and save in the background; opening an exam a class
 * doesn't have yet creates its papers.
 */
export function ExamWindowsPanel({ termId, termName, classes, windows, requests, onSaved }: ExamWindowsPanelProps) {
  // Choices not yet confirmed by the server, shown as if saved.
  const [pending, setPending] = useState<ReadonlyMap<string, string | null>>(new Map());
  const [saveState, setSaveState] = useState<Partial<Record<LevelKey, SaveState>>>({});
  const [perClass, setPerClass] = useState<ReadonlySet<LevelKey>>(new Set());
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);

  const openFor = (gradeId: string): string => (pending.has(gradeId) ? pending.get(gradeId) ?? '' : windows.get(gradeId) ?? '');
  const setCount = classes.filter(c => openFor(c.grade_id)).length;
  const unset = classes.length - setCount;
  const requestFor = new Map(requests.map(r => [r.grade_id, r]));
  const waitingTeachers = new Set(requests.flatMap(r => r.names)).size;
  // Open while anything needs a choice, until the admin folds it.
  const open = openChoice ?? (unset > 0 || requests.length > 0);

  const levels: Level[] = (() => {
    const map = new Map<LevelKey, ExamClass[]>();
    for (const c of classes) {
      const key = levelOf({ code: c.code, name_display: c.name });
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return LEVEL_ORDER.filter(k => map.has(k)).map(key => {
      const levelClasses = map.get(key) ?? [];
      return {
        key,
        classes: levelClasses,
        types: SCHEDULED_EXAM_TYPES.filter(t => levelClasses.some(c => c.types.includes(t))),
        waiting: levelClasses.filter(c => requestFor.has(c.grade_id)).length,
      };
    });
  })();

  const save = async (level: LevelKey, entries: { gradeId: string; examType: string | null }[]) => {
    if (entries.length === 0) return;
    setPending(prev => new Map([...prev, ...entries.map(e => [e.gradeId, e.examType] as const)]));
    setSaveState(prev => ({ ...prev, [level]: { status: 'saving' } }));
    const settle = () => setPending(prev => {
      const next = new Map(prev);
      for (const e of entries) next.delete(e.gradeId);
      return next;
    });
    try {
      const res = await fetch('/api/school/exam-windows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId, entries }),
      });
      const json = (await res.json().catch(() => null)) as { data?: ExamWindow[]; created?: number; error?: string } | null;
      if (!res.ok || !json?.data) throw new Error(json?.error || 'Could not save.');
      onSaved(json.data, json.created ?? 0);
      settle();
      setSaveState(prev => ({ ...prev, [level]: { status: 'saved' } }));
    } catch (err) {
      settle();
      setSaveState(prev => ({ ...prev, [level]: { status: 'error', message: err instanceof Error ? err.message : 'Could not save.' } }));
    }
  };

  /** One exam for every class in the level (papers are created where missing). */
  const setLevel = (level: Level, examType: string | null) =>
    void save(level.key, level.classes.map(c => ({ gradeId: c.grade_id, examType })));

  const levelValue = (level: Level): string | 'mixed' => {
    const values = new Set(level.classes.map(c => openFor(c.grade_id)));
    return values.size === 1 ? [...values][0] : 'mixed';
  };

  return (
    <section
      id="open-for-marking"
      aria-labelledby="open-for-marking-title"
      className={cn('overflow-hidden rounded-2xl border bg-card shadow-sm', unset > 0 || waitingTeachers > 0 ? 'border-amber-500/40' : 'border-border/70')}
    >
      <button
        type="button"
        onClick={() => setOpenChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
      >
        <span
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', unset > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')}
          aria-hidden
        >
          {unset > 0 ? <DoorOpen className="size-5" /> : <CheckCircle2 className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span id="open-for-marking-title" className="block font-display text-base font-bold tracking-tight text-foreground">
            Exam being marked · {termName}
          </span>
          <span className="block text-xs text-muted-foreground sm:text-sm">
            {unset > 0
              ? `${unset} of ${classes.length} ${classes.length === 1 ? 'class has' : 'classes have'} no exam chosen. Teachers there pick one themselves.`
              : 'Every class has its exam. Teachers go straight to it.'}
          </span>
          {waitingTeachers > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <BellRing className="size-3.5" aria-hidden />
              {waitingTeachers} {waitingTeachers === 1 ? 'teacher is' : 'teachers are'} waiting for you
            </span>
          )}
        </span>
        <span className="hidden w-28 shrink-0 sm:block" aria-hidden>
          <span className="block text-right text-xs font-semibold tabular-nums text-foreground">{setCount} / {classes.length} set</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={cn('block h-full rounded-full transition-[width] duration-300', unset > 0 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${classes.length ? (setCount / classes.length) * 100 : 0}%` }} />
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border/60">
          {/* How it works */}
          <div className="bg-muted/30 px-4 py-4 sm:px-5">
            <ol className="grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary" aria-hidden>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{step.title}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">CATs, topical tests and your own exam types are always open, so they aren&apos;t listed here.</p>
          </div>

          {/* One card per level */}
          <ul className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {levels.map(level => {
              const value = levelValue(level);
              const state = saveState[level.key];
              const busy = state?.status === 'saving';
              const showClasses = perClass.has(level.key) || value === 'mixed' || level.waiting > 0;
              const others = SCHEDULED_EXAM_TYPES.filter(t => !level.types.includes(t));
              return (
                <li
                  key={level.key}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
                    level.waiting > 0 ? 'border-amber-500/40 bg-amber-500/[0.04]' : value && value !== 'mixed' ? 'border-primary/25 bg-primary/[0.03]' : 'border-border/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{levelLabel(level.key)}</p>
                      <p className="text-xs text-muted-foreground">
                        {level.classes.length} {level.classes.length === 1 ? 'class' : 'classes'}
                        {level.waiting > 0 && <span className="font-semibold text-amber-700 dark:text-amber-400"> · {level.waiting} waiting</span>}
                      </p>
                    </div>
                    <LevelStatus value={value} state={state} />
                  </div>

                  {/* The exams this level has, as buttons */}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Exam for ${levelLabel(level.key)}`}>
                    {level.types.map(t => (
                      <ExamChip key={t} label={examName(t)} active={value === t} disabled={busy} onClick={() => setLevel(level, t)} />
                    ))}
                    {others.length > 0 && (
                      <select
                        aria-label={`Another exam for ${levelLabel(level.key)}`}
                        value=""
                        disabled={busy}
                        onChange={e => { if (e.target.value) setLevel(level, e.target.value); }}
                        className={cn(
                          'h-8 rounded-lg border border-dashed px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          value && others.includes(value) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        <option value="">{value && others.includes(value) ? examName(value) : 'Other exam…'}</option>
                        {others.map(t => <option key={t} value={t}>{examName(t)}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {level.classes.length > 1 && value !== 'mixed' && level.waiting === 0 ? (
                      <button
                        type="button"
                        onClick={() => setPerClass(prev => { const next = new Set(prev); if (next.has(level.key)) next.delete(level.key); else next.add(level.key); return next; })}
                        className="font-medium text-primary hover:underline"
                      >
                        {showClasses ? 'Same for all classes' : 'Set per class'}
                      </button>
                    ) : <span />}
                    {value && (
                      <button type="button" disabled={busy} onClick={() => setLevel(level, null)} className="font-medium text-muted-foreground hover:text-destructive disabled:opacity-50">
                        Stop marking
                      </button>
                    )}
                  </div>

                  {showClasses && (level.classes.length > 1 || level.waiting > 0) && (
                    <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
                      {level.classes.map(c => {
                        const request = requestFor.get(c.grade_id);
                        const classValue = openFor(c.grade_id);
                        return (
                          <li key={c.grade_id} className="flex flex-col gap-1 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-sm text-foreground">{c.name}</span>
                              <select
                                aria-label={`Exam for ${c.name}`}
                                value={classValue}
                                disabled={busy}
                                onChange={e => void save(level.key, [{ gradeId: c.grade_id, examType: e.target.value || null }])}
                                className={cn('input-field h-8 w-auto min-w-32 py-0 text-xs', !classValue && 'text-amber-700 dark:text-amber-400')}
                              >
                                <option value="">Not chosen</option>
                                {SCHEDULED_EXAM_TYPES.map(t => <option key={t} value={t}>{examName(t)}{c.types.includes(t) ? '' : ' (new)'}</option>)}
                              </select>
                            </div>
                            {request && (
                              <p className="flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300">
                                <BellRing className="size-3 shrink-0" aria-hidden />
                                <span className="truncate">Asked by {request.names.join(', ')}</span>
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {state?.status === 'error' && <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{state.message}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ExamChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/70 bg-card text-foreground hover:border-primary/40 hover:bg-primary/5',
      )}
    >
      {active && <Check className="size-3.5" aria-hidden />}
      {label}
    </button>
  );
}

/** What the level is marking, or that it's saving / just saved. */
function LevelStatus({ value, state }: { value: string; state?: SaveState }) {
  if (state?.status === 'saving') {
    return <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving…</span>;
  }
  const saved = state?.status === 'saved';
  if (value === 'mixed') return <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Varies by class</span>;
  if (!value) return <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">Not chosen</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
      {saved && <Check className="size-3" aria-hidden />}
      Marking {examName(value)}
    </span>
  );
}
