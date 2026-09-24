"use client";

import React, { useState } from 'react';
import { Badge } from '@/components/ui';
import ListPanel from './ListPanel';
import EmptyState from './EmptyState';

export interface UpcomingExam {
  id: string;
  name: string;
  exam_type: string;
  exam_date: string;
  subject_name: string;
  grade_name: string;
}

const SOON_MS = 3 * 24 * 60 * 60 * 1000;

export default function UpcomingExamsCard({ exams, limit = 5, className }: { exams: UpcomingExam[]; limit?: number; className?: string }) {
  const [now] = useState(() => Date.now());

  if (exams.length === 0) {
    return (
      <ListPanel title="Upcoming exams" className={className}>
        <EmptyState title="Nothing scheduled" description="Exams with a date in the next few weeks will appear here." />
      </ListPanel>
    );
  }

  return (
    <ListPanel title="Upcoming exams" actionLabel="View all" actionHref="/dashboard/exams-marks" className={className}>
      <ul className="flex flex-col gap-2">
        {exams.slice(0, limit).map(exam => {
          const date = new Date(exam.exam_date);
          const isSoon = date.getTime() - now < SOON_MS;
          return (
            <li
              key={exam.id}
              className={`flex items-center gap-3 rounded-xl border p-2 ${isSoon ? 'border-amber-500/25 bg-amber-500/10' : 'border-border/55 bg-muted/35'}`}
            >
              <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border bg-card/80 ${isSoon ? 'border-amber-500/30 text-amber-600' : 'border-border/60 text-muted-foreground'}`}>
                <span className="text-[9px] font-bold uppercase leading-none tracking-[0.12em]">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                <span className="text-base font-bold leading-none tracking-tight">{date.toLocaleDateString('en-GB', { day: '2-digit' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">{exam.name}</div>
                <div className="truncate text-xs text-muted-foreground">{exam.subject_name} &middot; {exam.grade_name}</div>
              </div>
              {isSoon && <Badge variant="warning">Soon</Badge>}
            </li>
          );
        })}
      </ul>
    </ListPanel>
  );
}
