import React from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getExamTypeLabel, isAnytimeExamType } from '@/lib/exam-types';
import { MODE_TONES, SUBJECT_CATEGORY_THEME, subjectCategory } from '../examTheme';
import { MODES } from './parts';
import type { EntryMode, ExamSlot } from './model';

interface SheetHeaderProps {
  exam: ExamSlot;
  examLabel: string;
  classLabel: string;
  termName: string;
  /** The papers' codes when the subject is split into papers, else null. */
  paperCodes: string[] | null;
  paperSummary: string;
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  /** The same subject and class in the term's other exams. */
  siblings: readonly ExamSlot[];
  /** The exam open for marking in this class, or ''. */
  openType: string;
  onSetUpPapers: () => void;
  onChangeExam: () => void;
  onPickSibling: (exam: ExamSlot) => void;
}

/** Above the mark sheet: which exam this is, how to enter marks, and the class's other exams. */
export function SheetHeader({ exam, examLabel, classLabel, termName, paperCodes, paperSummary, mode, onModeChange, siblings, openType, onSetUpPapers, onChangeExam, onPickSibling }: SheetHeaderProps) {
  const theme = SUBJECT_CATEGORY_THEME[subjectCategory(exam.subject_category)];
  const Icon = theme.icon;
  return (
    <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl sm:size-14', theme.tone.tile)} aria-hidden><Icon className="size-6 sm:size-7" /></span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Entering marks for
              {/* The exam itself, big enough that nobody types Mid-Term marks into End-Term. */}
              <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold tracking-wide text-primary-foreground normal-case">{examLabel}</span>
            </p>
            <h2 className="mt-1 truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
              {exam.subject_name} <span className="text-muted-foreground">·</span> {classLabel}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {termName} · {examLabel} · {paperCodes ? <span className="font-medium text-primary">Papers {paperSummary}</span> : <>Out of {exam.max_score}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSetUpPapers}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
              paperCodes ? 'border-primary/40 bg-primary/10 text-primary' : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
            title="Some subjects are examined in several papers (e.g. Maths Paper 1 & 2, Sciences with a practical). Set that up here — the papers combine into one final subject score."
          >
            <Layers size={14} aria-hidden />
            {paperCodes ? `Papers: ${paperCodes.join(' + ')}` : 'Split into papers'}
          </button>
          <button type="button" onClick={onChangeExam} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40">
            <RefreshCw size={14} aria-hidden /> Change exam, class or subject
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card/70 p-1 sm:inline-grid sm:w-auto" role="tablist" aria-label="How to enter marks">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onModeChange(m.id)}
            title={m.hint}
            className={cn(
              'inline-flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:px-4 sm:text-sm',
              mode === m.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md transition-colors', mode === m.id ? MODE_TONES[m.id].tile : '')}>{m.icon}</span><span className="max-w-full truncate">{m.label}</span>
          </button>
        ))}
      </div>
      {/* The same subject and class in another exam: a CAT, or correcting an earlier one. */}
      {siblings.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Other exams for this class:</span>
          {siblings.map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPickSibling(e)}
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card px-2 py-1 font-medium text-foreground transition-colors hover:border-primary/40">
              {getExamTypeLabel(e.exam_type)}
              {e.exam_type === openType && <span className="rounded bg-primary/10 px-1 text-[9px] font-bold text-primary">NOW</span>}
              {isAnytimeExamType(e.exam_type) && <span className="text-[10px] font-normal text-muted-foreground">any time</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
