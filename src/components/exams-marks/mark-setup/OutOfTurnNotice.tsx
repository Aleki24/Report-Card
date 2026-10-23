import React from 'react';
import { CalendarClock } from 'lucide-react';
import { getExamTypeLabel } from '@/lib/exam-types';
import { examDay } from '@/lib/exam-schedule';
import type { ExamSlot } from './model';

interface OutOfTurnNoticeProps {
  examLabel: string;
  /** YYYY-MM-DD the exam is scheduled for. */
  examDate: string;
  classLabel: string;
  /** The exam open for marking in this class, or ''. */
  openType: string;
  /** This subject and class in the exam that is open or due now. */
  nowSlot?: ExamSlot;
  onOpenNow: (exam: ExamSlot) => void;
  onConfirm: () => void;
}

/**
 * Shown before an empty sheet for an exam that isn't the one being marked,
 * so Mid-Term marks don't land in End-Term by mistake.
 */
export function OutOfTurnNotice({ examLabel, examDate, classLabel, openType, nowSlot, onOpenNow, onConfirm }: OutOfTurnNoticeProps) {
  return (
    <section role="alert" className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400" aria-hidden><CalendarClock className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {openType
              ? <>{examLabel} isn&apos;t open for marking in {classLabel}</>
              : <>{examLabel} isn&apos;t until {examDay(examDate)}</>}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {openType
              ? <>The school is marking <strong className="text-foreground">{getExamTypeLabel(openType)}</strong> for this class. Check which exam these marks are from before you start.</>
              : nowSlot
                ? <>The term is on <strong className="text-foreground">{getExamTypeLabel(nowSlot.exam_type)}</strong> now. Check which exam these marks are from before you start.</>
                : 'Check which exam these marks are from before you start.'}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 xs:flex-row sm:shrink-0">
        {nowSlot && (
          <button type="button" onClick={() => onOpenNow(nowSlot)} className="btn-primary px-4 py-2">
            Enter {getExamTypeLabel(nowSlot.exam_type)} marks
          </button>
        )}
        <button type="button" onClick={onConfirm} className="btn-secondary px-4 py-2">
          Enter {examLabel} marks anyway
        </button>
      </div>
    </section>
  );
}
