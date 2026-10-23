"use client";

import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExamTypeLabel } from '@/lib/exam-types';
import { LEVEL_ORDER, levelLabel, levelOf, type ExamWindow, type LevelKey } from '@/lib/exam-windows';

export interface WindowGrade { id: string; code?: string | null; name_display: string }

interface ExamWindowsPanelProps {
  termId: string;
  termName: string;
  /** Classes with exams this term. */
  grades: readonly WindowGrade[];
  /** Scheduled exam types each class has this term (anytime types left out). */
  typesByGrade: ReadonlyMap<string, readonly string[]>;
  windows: ReadonlyMap<string, string>;
  onSaved: (windows: ExamWindow[]) => void;
}

const MIXED = '__mixed';

interface Level { key: LevelKey; grades: WindowGrade[]; types: string[] }

/**
 * The admin's switch for which exam each class is marking now. Set once per
 * level (all of Junior School on End-Term); a class that differs — Form 4 on
 * Mock — gets its own. Teachers then go straight to that exam.
 */
export function ExamWindowsPanel({ termId, termName, grades, typesByGrade, windows, onSaved }: ExamWindowsPanelProps) {
  const unset = grades.filter(g => !windows.has(g.id)).length;
  // Open while any class is unset, until the admin folds it themselves.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const open = openChoice ?? unset > 0;
  const [perClass, setPerClass] = useState<ReadonlySet<LevelKey>>(new Set());
  const [saving, setSaving] = useState<LevelKey | null>(null);
  const [error, setError] = useState('');

  const levels: Level[] = (() => {
    const map = new Map<LevelKey, WindowGrade[]>();
    for (const g of grades) {
      const key = levelOf(g);
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return LEVEL_ORDER.filter(k => map.has(k)).map(key => {
      const levelGrades = (map.get(key) ?? []).sort((a, b) => a.name_display.localeCompare(b.name_display, undefined, { numeric: true }));
      const types = [...new Set(levelGrades.flatMap(g => typesByGrade.get(g.id) ?? []))];
      return { key, grades: levelGrades, types };
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
      const json = (await res.json().catch(() => null)) as { data?: ExamWindow[]; error?: string } | null;
      if (!res.ok || !json?.data) throw new Error(json?.error || 'Could not save.');
      onSaved(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
    setSaving(null);
  };

  /** A level-wide choice sets every class in it that sits that exam. */
  const setLevel = (level: Level, examType: string) => {
    const entries = level.grades
      .filter(g => !examType || (typesByGrade.get(g.id) ?? []).includes(examType))
      .map(g => ({ gradeId: g.id, examType: examType || null }));
    void save(level.key, entries);
  };

  const levelValue = (level: Level): string => {
    const values = new Set(level.grades.map(g => windows.get(g.id) ?? ''));
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
              const expanded = perClass.has(level.key) || value === MIXED;
              return (
                <li key={level.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{levelLabel(level.key)}</p>
                      <p className="text-xs text-muted-foreground">{level.grades.length} {level.grades.length === 1 ? 'class' : 'classes'}</p>
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
                      {level.grades.length > 1 && value !== MIXED && (
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
                  {expanded && level.grades.length > 1 && (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {level.grades.map(g => (
                        <li key={g.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2">
                          <span className="min-w-0 truncate text-sm text-foreground">{g.name_display}</span>
                          <ExamSelect
                            label={`Exam open for ${g.name_display}`}
                            value={windows.get(g.id) ?? ''}
                            types={typesByGrade.get(g.id) ?? []}
                            disabled={saving === level.key}
                            onChange={v => void save(level.key, [{ gradeId: g.id, examType: v || null }])}
                          />
                        </li>
                      ))}
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
