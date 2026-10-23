"use client";

import React, { useState } from 'react';
import { BellRing, CheckCircle2, ChevronDown, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExamTypeLabel } from '@/lib/exam-types';
import { LEVEL_ORDER, levelLabel, levelOf, type ExamClass, type ExamRequest, type LevelKey } from '@/lib/exam-windows';

interface ExamWindowsPanelProps {
  termId: string;
  termName: string;
  /** Every class with scheduled exams this term. */
  classes: readonly ExamClass[];
  windows: ReadonlyMap<string, string>;
  /** Teachers waiting for an exam to be opened, per class. */
  requests: readonly ExamRequest[];
  onSaved: () => void;
}

const MIXED = '__mixed';

interface Level { key: LevelKey; classes: ExamClass[]; types: string[]; waiting: number }

/**
 * The admin's switch for which exam each class is marking now. Set once per
 * level (all of Junior School on End-Term); a class that differs — Form 4 on
 * Mock — gets its own. Teachers then go straight to that exam.
 */
export function ExamWindowsPanel({ termId, termName, classes, windows, requests, onSaved }: ExamWindowsPanelProps) {
  const unset = classes.filter(c => !windows.has(c.grade_id)).length;
  const requestFor = new Map(requests.map(r => [r.grade_id, r]));
  const waitingTeachers = new Set(requests.flatMap(r => r.names)).size;
  // Open while any class is unset, until the admin folds it themselves.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const open = openChoice ?? (unset > 0 || requests.length > 0);
  const [perClass, setPerClass] = useState<ReadonlySet<LevelKey>>(new Set());
  const [saving, setSaving] = useState<LevelKey | null>(null);
  const [error, setError] = useState('');

  const levels: Level[] = (() => {
    const map = new Map<LevelKey, ExamClass[]>();
    for (const c of classes) {
      const key = levelOf({ code: c.code, name_display: c.name });
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return LEVEL_ORDER.filter(k => map.has(k)).map(key => {
      const levelClasses = map.get(key) ?? [];
      const types = [...new Set(levelClasses.flatMap(c => c.types))];
      return { key, classes: levelClasses, types, waiting: levelClasses.filter(c => requestFor.has(c.grade_id)).length };
    });
  })();

  const save = async (level: LevelKey, entries: { gradeId: string; examType: string | null }[]) => {
    if (entries.length === 0) return;
    setSaving(level);
    setError('');
    try {
      const res = await fetch('/api/school/exam-windows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId, entries }),
      });
      const json = (await res.json().catch(() => null)) as { data?: unknown[]; error?: string } | null;
      if (!res.ok || !json?.data) throw new Error(json?.error || 'Could not save.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
    setSaving(null);
  };

  /** A level-wide choice sets every class in it that sits that exam. */
  const setLevel = (level: Level, examType: string) => {
    const entries = level.classes
      .filter(c => !examType || c.types.includes(examType))
      .map(c => ({ gradeId: c.grade_id, examType: examType || null }));
    void save(level.key, entries);
  };

  const levelValue = (level: Level): string => {
    const values = new Set(level.classes.map(c => windows.get(c.grade_id) ?? ''));
    return values.size === 1 ? [...values][0] : MIXED;
  };

  const summary = levels
    .map(l => {
      const v = levelValue(l);
      return `${levelLabel(l.key)}: ${v === MIXED ? 'varies by class' : v ? getExamTypeLabel(v) : 'not set'}`;
    })
    .join(' · ');

  return (
    <section id="open-for-marking" aria-labelledby="open-for-marking-title" className={cn('rounded-2xl border bg-card shadow-sm', unset > 0 ? 'border-amber-500/40' : 'border-border/70')}>
      <button
        type="button"
        onClick={() => setOpenChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left sm:items-center"
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', unset > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')} aria-hidden>
          {unset > 0 ? <DoorOpen className="size-5" /> : <CheckCircle2 className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span id="open-for-marking-title" className="block text-sm font-semibold text-foreground">Open for marking · {termName}</span>
          <span className="block text-xs text-muted-foreground">
            {unset > 0
              ? `${unset} ${unset === 1 ? 'class has' : 'classes have'} no exam open. Teachers there pick one themselves until you choose.`
              : summary}
          </span>
          {waitingTeachers > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <BellRing className="size-3.5" aria-hidden />
              {waitingTeachers} {waitingTeachers === 1 ? 'teacher is' : 'teachers are'} waiting for an exam to be opened
            </span>
          )}
        </span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform sm:mt-0', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border/60 p-4">
          <p className="mb-4 text-xs text-muted-foreground">
            Teachers go straight to the exam open for their class. CATs, topical tests and your own exam types are always open, and earlier exams can still be corrected.
          </p>
          <ul className="flex flex-col divide-y divide-border/60">
            {levels.map(level => {
              const value = levelValue(level);
              // Classes someone is waiting on are shown, so the admin sees who asked.
              const expanded = perClass.has(level.key) || value === MIXED || level.waiting > 0;
              return (
                <li key={level.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{levelLabel(level.key)}</p>
                      <p className="text-xs text-muted-foreground">
                        {level.classes.length} {level.classes.length === 1 ? 'class' : 'classes'}
                        {level.waiting > 0 && <span className="font-semibold text-amber-700 dark:text-amber-400"> · {level.waiting} waiting</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ExamSelect
                        label={`Exam open for ${levelLabel(level.key)}`}
                        value={value}
                        types={level.types}
                        mixed={value === MIXED}
                        disabled={saving === level.key}
                        onChange={v => setLevel(level, v)}
                      />
                      {level.classes.length > 1 && value !== MIXED && level.waiting === 0 && (
                        <button
                          type="button"
                          onClick={() => setPerClass(prev => { const next = new Set(prev); if (next.has(level.key)) next.delete(level.key); else next.add(level.key); return next; })}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {expanded ? 'Same for all' : 'Per class'}
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded && (level.classes.length > 1 || level.waiting > 0) && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {level.classes.map(c => {
                        const request = requestFor.get(c.grade_id);
                        return (
                          <li key={c.grade_id} className={cn('flex flex-col gap-1.5 rounded-xl border px-3 py-2', request ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-border/60')}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-sm text-foreground">{c.name}</span>
                              <ExamSelect
                                label={`Exam open for ${c.name}`}
                                value={windows.get(c.grade_id) ?? ''}
                                types={c.types}
                                disabled={saving === level.key}
                                onChange={v => void save(level.key, [{ gradeId: c.grade_id, examType: v || null }])}
                              />
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
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}

function ExamSelect({ label, value, types, mixed = false, disabled, onChange }: {
  label: string; value: string; types: readonly string[]; mixed?: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={cn('input-field h-9 w-auto min-w-36 text-sm', !value && 'text-amber-700 dark:text-amber-400')}
    >
      <option value="">Not set</option>
      {mixed && <option value={MIXED} disabled>Different per class</option>}
      {types.map(t => <option key={t} value={t}>{getExamTypeLabel(t)}</option>)}
    </select>
  );
}
