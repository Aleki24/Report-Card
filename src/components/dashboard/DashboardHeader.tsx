import type { ReactNode } from 'react';
import Link from 'next/link';
import type { TermSummary } from '@/lib/dashboard';

function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

const dayMonth = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

/**
 * "Term 3 · 2026 · Week 5 of 10 · 34 days left", or the break and when school
 * reopens. Only admins can set term dates, so only they get the link to do so.
 */
export function TermLine({ term, canEditTerms }: { term: TermSummary | null; canEditTerms: boolean }) {
  if (!term || term.kind === 'none') {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {canEditTerms
          ? <>No term dates set. <Link href="/dashboard/settings?tab=calendar" className="font-medium text-primary hover:underline">Add your terms</Link> to track the calendar.</>
          : 'Your school hasn’t set its term dates yet.'}
      </p>
    );
  }
  if (term.kind === 'break') {
    return (
      <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">School break</span>
        {term.nextName && term.nextStart ? `${term.nextName} opens ${dayMonth(term.nextStart)}` : 'No upcoming term dates set'}
      </p>
    );
  }
  const progress = Math.round((term.week / term.weeks) * 100);
  return (
    <div className="mt-2 max-w-md">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{[term.name, term.year].filter(Boolean).join(' · ')}</span>
        <span className="text-muted-foreground">Week {term.week} of {term.weeks} · {term.daysLeft === 0 ? 'ends today' : `${term.daysLeft} day${term.daysLeft === 1 ? '' : 's'} left`}</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label="How far through the term" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

interface DashboardHeaderProps {
  name: string;
  term: TermSummary | null;
  canEditTerms: boolean;
  /** A line under the term, such as how much marking is left. */
  summary?: ReactNode;
  /** The right-hand side: a search box, or the next task. */
  children?: ReactNode;
}

/** Date, greeting and where the school is in its term; shared by every staff home. */
export function DashboardHeader({ name, term, canEditTerms, summary, children }: DashboardHeaderProps) {
  const now = new Date();
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">{greetingFor(now.getHours())}, {name || 'there'}</h1>
        <TermLine term={term} canEditTerms={canEditTerms} />
        {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </div>
      {children && <div className="w-full shrink-0 lg:w-auto">{children}</div>}
    </header>
  );
}
