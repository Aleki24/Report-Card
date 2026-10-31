"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowUpRight, CalendarDays, CircleCheck, Loader2, School, Sparkles, Undo2 } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { LoadError, SearchBox, StatTile } from '@/components/ui';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { GradePromotionCard } from '@/components/promotion/GradePromotionCard';
import { OUTCOME_ICONS } from '@/components/promotion/promotionMeta';
import { usePromotionPlan } from '@/components/promotion/usePromotionPlan';
import { apiErrorMessage, jsonBody } from '@/lib/api-error-message';
import {
  OUTCOME_COPY, OUTCOME_ORDER, PROMOTION_URL, archivesLearner, confirmCopy, hasSeniorStayers, missingSeniorGrade,
  type PromotionCounts, type PromotionOverview, type PromotionUndoResult,
} from '@/lib/promotion';

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: 'no-store', ...init });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiErrorMessage(json, 'Something went wrong. Please try again.'));
  return (json as { data: T }).data;
}

type Load = { state: 'loading' } | { state: 'ready'; data: PromotionOverview } | { state: 'error'; message: string };

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** The four outcome tallies, shared by the plan and the finished run. */
function OutcomeTiles({ counts }: { counts: PromotionCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {OUTCOME_ORDER.map(o => {
        const meta = OUTCOME_COPY[o];
        return <StatTile key={o} icon={OUTCOME_ICONS[o]} hue={meta.hue} label={meta.tally} value={counts[meta.count].toLocaleString()} hint={archivesLearner(o) ? 'archived' : 'stay active'} />;
      })}
    </div>
  );
}

/** This year's promotion has run: what it did, and a way back. */
function PromotionDone({ data, onUndone }: { data: PromotionOverview; onUndone: (next: PromotionOverview) => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const run = data.run!;
  const seniorStayers = hasSeniorStayers(data.grades);

  const undo = async () => {
    const ok = await confirm({
      title: 'Undo this promotion?',
      message: 'Every learner goes back to the class and status they had before it, including those archived. Anyone you have moved or edited by hand since is left as they are.',
      confirmText: 'Undo promotion',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await call<PromotionUndoResult>(`${PROMOTION_URL}/${run.id}`, { method: 'DELETE' });
      toast.success(`Promotion undone: ${plural(result.restored, 'learner')} put back.`);
      if (result.skipped > 0) toast.warning(`${plural(result.skipped, 'learner')} had changed since and were left as they are.`);
      onUndone(await call<PromotionOverview>(PROMOTION_URL));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not undo the promotion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" aria-hidden>
            <CircleCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold">Learners promoted for {data.academicYear?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {new Date(run.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{run.run_by ? ` by ${run.run_by}` : ''}.
              Graduates and transfers are archived: find them on People under their status.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link href="/dashboard/people" className="btn-secondary justify-center">Open People</Link>
          <button type="button" className="btn-secondary justify-center text-destructive" onClick={undo} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}Undo promotion
          </button>
        </div>
      </div>

      <OutcomeTiles counts={run} />

      <ul className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
        <li className="rounded-2xl border border-border/70 bg-card p-4">
          <p className="font-semibold text-foreground">Next: set up the new year</p>
          Add the new academic year and its terms, then assign class teachers to the classes your learners moved into.
          <Link href="/dashboard/settings" className="mt-2 flex items-center gap-1 font-semibold text-primary">Academic calendar <ArrowUpRight className="size-4" aria-hidden /></Link>
        </li>
        {seniorStayers && (
          <li className="rounded-2xl border border-border/70 bg-card p-4">
            <p className="font-semibold text-foreground">New Senior School learners</p>
            Learners who stayed for Senior School need a pathway and subject combination before their mark sheets are right.
            <Link href="/dashboard/subjects?tab=placement" className="mt-2 flex items-center gap-1 font-semibold text-primary">Learner placement <ArrowUpRight className="size-4" aria-hidden /></Link>
          </li>
        )}
      </ul>
    </div>
  );
}

/** The plan for every grade, and the button that applies it. */
function PromotionPlanner({ data, onDone }: { data: PromotionOverview; onDone: (next: PromotionOverview) => void }) {
  const confirm = useConfirm();
  const plan = usePromotionPlan(data.grades);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const { blocked } = plan;
  const noSenior = missingSeniorGrade(data.grades);

  const run = async () => {
    const copy = confirmCopy(plan);
    const ok = await confirm({
      title: copy.title,
      message: <span className="grid gap-1">{copy.lines.map(line => <span key={line}>{line}</span>)}</span>,
      confirmText: 'Promote learners',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await call<PromotionOverview>(PROMOTION_URL, jsonBody('POST', { academic_year_id: data.academicYear!.id, decisions: plan.decisions() }));
      toast.success(`Learners promoted for ${data.academicYear!.name}.`);
      onDone(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not promote the learners.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <OutcomeTiles counts={plan.counts} />

      {noSenior && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Do some {noSenior.name} learners stay for {noSenior.step.nextLevelName}?</span>{' '}
            Only a school with a {noSenior.step.nextGradeName} class can keep them. Add one first, then come back.
          </p>
          <Link href="/dashboard/classes" className="btn-secondary shrink-0 justify-center">Add {noSenior.step.nextGradeName}</Link>
        </div>
      )}

      <SearchBox value={query} onChange={setQuery} placeholder="Find a learner by name or admission number" className="sm:max-w-md" />

      <div className="grid gap-4">
        {data.grades.map(g => <GradePromotionCard key={g.id} grade={g} plan={plan} query={query.trim().toLowerCase()} />)}
      </div>

      {/* Sticky so the totals and the button stay in reach down a long school; above the phone tab bar. */}
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4 md:bottom-4">
        <p className="text-sm" aria-live="polite">
          {blocked > 0
            ? <span className="font-semibold text-amber-600 dark:text-amber-400">{plural(blocked, 'learner')} still need{blocked === 1 ? 's' : ''} a decision or a class.</span>
            : <span className="text-muted-foreground">Every learner is decided. Nothing changes until you promote.</span>}
        </p>
        <button type="button" className="btn-primary justify-center" onClick={run} disabled={busy || blocked > 0 || plan.total === 0}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          Promote {plural(plan.total, 'learner')}
        </button>
      </div>
    </div>
  );
}

export default function PromotionPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchOverview = useCallback(() => call<PromotionOverview>(PROMOTION_URL).then(
    next => setLoad({ state: 'ready', data: next }),
    (err: unknown) => setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load the classes.' }),
  ), []);
  useEffect(() => { void fetchOverview(); }, [fetchOverview]);

  const data = load.state === 'ready' ? load.data : null;
  const show = (next: PromotionOverview) => setLoad({ state: 'ready', data: next });

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title="Promote students"
        eyebrow="School"
        icon={ArrowUpRight}
        hue="amber"
        breadcrumbs={[{ label: 'Classes', href: '/dashboard/classes' }, { label: 'Promote students' }]}
        description={data?.academicYear
          ? `Close ${data.academicYear.name}: learners move up a class, candidates graduate and are archived, and Grade 9s stay for Senior School only if you mark them.`
          : 'Move learners up a class at the end of the year, and archive those who leave.'}
      />

      {load.state === 'loading' && (
        <div aria-busy="true" className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-bone h-24 rounded-2xl" />)}</div>
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton-bone h-48 rounded-2xl" />)}
        </div>
      )}

      {load.state === 'error' && <LoadError title="Couldn't load the promotion" message={load.message} onRetry={() => { setLoad({ state: 'loading' }); void fetchOverview(); }} />}

      {data && !data.academicYear && (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState hue="amber" icon={<CalendarDays className="size-6" />} title="No academic year yet" description="Promotion closes an academic year. Add the current year under Settings first." action={<Link href="/dashboard/settings" className="btn-primary">Open Settings</Link>} />
        </div>
      )}

      {data?.academicYear && data.grades.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState hue="amber" icon={<School className="size-6" />} title="No classes yet" description="Add your grades and classes first; promotion moves learners between them." action={<Link href="/dashboard/classes" className="btn-primary">Open Classes</Link>} />
        </div>
      )}

      {data?.academicYear && data.grades.length > 0 && (
        data.run
          ? <PromotionDone data={data} onUndone={show} />
          // Keyed so a fresh plan starts after an undo.
          : <PromotionPlanner key={data.academicYear.id} data={data} onDone={show} />
      )}
    </div>
  );
}
