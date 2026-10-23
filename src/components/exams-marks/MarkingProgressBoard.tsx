"use client";

import React, { useEffect, useState } from 'react';
import { ChevronDown, ListChecks, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExamType } from '@/lib/exam-types';
import { isBehind, percentEntered, type MarkingBoardCell, type MarkingBoardGrade, type MarkingBoardResponse } from '@/lib/marking-board';

interface MarkingProgressBoardProps {
  termId: string;
  termName: string;
  /** Changes whenever the open exams change, so the board reloads. */
  version: string;
  /** Opens a paper's mark sheet. */
  onOpenExam: (termId: string, examId: string) => void;
}

type Result = { status: 'error'; message: string } | { status: 'ready'; grades: MarkingBoardGrade[] };
type Load = { status: 'loading' } | Result;

const examName = (code: string): string => (getExamType(code)?.name ?? code).replace(/ Exam$/, '');

function tone(cell: Pick<MarkingBoardCell, 'entered' | 'expected'>) {
  if (!isBehind(cell)) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  return cell.entered > 0
    ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
    : 'border-rose-500/35 bg-rose-500/10 text-rose-800 dark:text-rose-300';
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <span
        className={cn('block h-full rounded-full', value >= 100 ? 'bg-emerald-500' : value > 0 ? 'bg-amber-500' : 'bg-rose-500')}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

/**
 * Who's behind: every subject in every stream for the exam each class is
 * marking, as "entered of expected", so whoever opens exams can nudge the
 * right teacher before report-card day. A cell opens that mark sheet.
 */
export function MarkingProgressBoard({ termId, termName, version, onOpenExam }: MarkingProgressBoardProps) {
  const [reload, setReload] = useState(0);
  // Each result remembers what it was loaded for; anything else is still loading.
  const [result, setResult] = useState<{ key: string; value: Result } | null>(null);
  const key = `${termId}|${version}|${reload}`;
  const load: Load = result?.key === key ? result.value : { status: 'loading' };
  const [open, setOpen] = useState(false);
  const [onlyBehind, setOnlyBehind] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/school/exam-windows/progress?term_id=${encodeURIComponent(termId)}`, { signal: controller.signal })
      .then(async res => {
        const body = (await res.json().catch(() => null)) as (MarkingBoardResponse & { error?: string }) | null;
        if (!res.ok || !body) throw new Error(body?.error ?? `error ${res.status}`);
        setResult({ key, value: { status: 'ready', grades: body.grades } });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, value: { status: 'error', message: err instanceof Error ? err.message : 'Could not load' } });
      });
    return () => controller.abort();
  }, [key, termId]);

  if (load.status === 'ready' && load.grades.length === 0) return null;

  const grades = load.status === 'ready' ? load.grades : [];
  let entered = 0;
  let expected = 0;
  let behind = 0;
  let notStarted = 0;
  for (const g of grades) {
    entered += g.entered;
    expected += g.expected;
    for (const s of g.subjects) for (const c of Object.values(s.cells)) {
      if (!isBehind(c)) continue;
      behind++;
      if (c.entered === 0) notStarted++;
    }
  }
  const overall = percentEntered({ entered, expected });

  return (
    <section aria-labelledby="marking-board-title" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="marking-board-body"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', behind > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')} aria-hidden>
            <ListChecks className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span id="marking-board-title" className="block font-display text-base font-bold tracking-tight text-foreground">
              Marking progress · {termName}
            </span>
            <span className="block text-xs text-muted-foreground sm:text-sm">
              {load.status === 'loading' && 'Counting marks…'}
              {load.status === 'error' && `Couldn’t load: ${load.message}`}
              {load.status === 'ready' && (behind === 0
                ? `All ${expected.toLocaleString()} marks are in for the open exams.`
                : `${entered.toLocaleString()} of ${expected.toLocaleString()} marks in · ${behind} ${behind === 1 ? 'sheet' : 'sheets'} unfinished${notStarted > 0 ? `, ${notStarted} not started` : ''}`)}
            </span>
            {load.status === 'ready' && <Bar value={overall} className="mt-2 max-w-xs" />}
          </span>
          {load.status === 'loading'
            ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            : <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />}
        </button>
        {load.status !== 'loading' && (
          <button
            type="button"
            onClick={() => setReload(r => r + 1)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Refresh marking progress"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {open && load.status === 'ready' && (
        <div id="marking-board-body" className="flex flex-col gap-4 border-t border-border/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Tap a class to open its mark sheet.</p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={onlyBehind} onChange={e => setOnlyBehind(e.target.checked)} className="size-4 rounded border-border accent-primary" />
              Only unfinished subjects
            </label>
          </div>

          {grades.map(grade => {
            const subjects = onlyBehind ? grade.subjects.filter(s => Object.values(s.cells).some(isBehind)) : grade.subjects;
            const pct = percentEntered(grade);
            return (
              <div key={grade.gradeId} className="rounded-xl border border-border/60">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    {grade.gradeName} <span className="font-normal text-muted-foreground">· {examName(grade.examType)}</span>
                  </h3>
                  <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                    <Bar value={pct} className="w-20 sm:w-28" />
                    {pct}%
                  </span>
                </div>

                {subjects.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">Every subject is fully marked.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground sm:px-4">Subject</th>
                          {grade.streams.map(s => (
                            <th key={s.id} scope="col" className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">{s.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map(subject => (
                          <tr key={subject.id}>
                            <th scope="row" className="sticky left-0 z-10 max-w-40 truncate border-t border-border/50 bg-card px-3 py-2 text-left font-medium text-foreground sm:max-w-56 sm:px-4">
                              {subject.name}
                            </th>
                            {grade.streams.map(stream => {
                              const cell = subject.cells[stream.id];
                              return (
                                <td key={stream.id} className="border-t border-border/50 px-2 py-2 align-top">
                                  {!cell || cell.expected === 0 ? (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onOpenExam(termId, cell.examId)}
                                      title={cell.teachers.length > 0 ? `Taught by ${cell.teachers.join(', ')}` : 'No teacher assigned'}
                                      className={cn('flex w-32 flex-col rounded-lg border px-2.5 py-1.5 text-left transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-primary', tone(cell))}
                                    >
                                      <span className="text-sm font-semibold tabular-nums">{cell.entered} of {cell.expected}</span>
                                      <span className="truncate text-[0.6875rem] opacity-80">{cell.teachers[0] ?? 'No teacher'}{cell.teachers.length > 1 ? ` +${cell.teachers.length - 1}` : ''}</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
