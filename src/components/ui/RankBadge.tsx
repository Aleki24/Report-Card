import React from 'react';
import { cn } from '@/lib/utils';

const PODIUM: Record<1 | 2 | 3, string> = {
  1: 'bg-gradient-to-br from-amber-400 to-yellow-300 text-amber-950 shadow-sm',
  2: 'bg-gradient-to-br from-slate-300 to-slate-200 text-slate-800 shadow-sm',
  3: 'bg-gradient-to-br from-orange-400 to-amber-300 text-orange-950 shadow-sm',
};

/** A class position: gold, silver and bronze discs for the top three, a plain number after. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const podium = rank >= 1 && rank <= 3 ? PODIUM[rank as 1 | 2 | 3] : null;
  return (
    <span
      aria-label={`Position ${rank}`}
      className={cn('inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums', podium ?? 'text-primary', className)}
    >
      {rank}
    </span>
  );
}
