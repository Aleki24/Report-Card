"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, DoorOpen } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import type { ExamWindowsResponse } from '@/lib/exam-windows';

/**
 * For a teacher who also opens exams (principal, deputy, DOS, exams officer):
 * the admin dashboard's "Choose the exam being marked" reminder, on their own
 * home. Renders nothing for everyone else, or when every class is set.
 */
export function OpenExamReminder() {
  const { can } = useAuth();
  const allowed = can('marking.open');
  const [info, setInfo] = useState<ExamWindowsResponse | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    fetch('/api/school/exam-windows', { cache: 'no-store' })
      .then(res => (res.ok ? (res.json() as Promise<ExamWindowsResponse>) : null))
      .then(data => { if (live) setInfo(data); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [allowed]);

  if (!allowed || !info?.canOpen) return null;
  const opened = new Set(info.data.map(w => w.grade_id));
  const unset = info.classes.filter(c => !opened.has(c.grade_id)).length;
  const waiting = new Set(info.requests.flatMap(r => r.names)).size;
  if (unset === 0 && waiting === 0) return null;

  return (
    <Link
      href="/dashboard/exams-marks?tab=setup"
      className="group flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 no-underline transition-colors hover:bg-amber-500/[0.12]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400" aria-hidden>
        {waiting > 0 ? <BellRing className="size-5" /> : <DoorOpen className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Choose the exam being marked{info.termName ? ` · ${info.termName}` : ''}
        </span>
        <span className="block text-xs text-muted-foreground">
          {waiting > 0 ? `${waiting} ${waiting === 1 ? 'teacher is' : 'teachers are'} waiting. ` : ''}
          {unset > 0 ? `${unset} ${unset === 1 ? 'class has' : 'classes have'} no exam open.` : ''}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5 dark:text-amber-400" aria-hidden />
    </Link>
  );
}
