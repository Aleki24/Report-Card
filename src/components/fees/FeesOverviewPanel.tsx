"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleCheck, CircleOff, Coins, HeartPulse, TriangleAlert, Wallet } from 'lucide-react';
import { LoadError, StatTile } from '@/components/ui';
import { requestJson } from '@/lib/api-error-message';
import { formatKsh } from '@/lib/fee-account';
import { GRADE_COPY, OVERVIEW_URL, TARGET_RATE, type FeesOverview, type FixTarget, type HealthItem, type HealthStatus, type TermCollection } from '@/lib/fee-overview';
import { cn } from '@/lib/utils';
import { MoneyBars } from './MoneyBars';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; body: FeesOverview };

/** Severity fill and a lighter step of the same ramp for the track. */
const METER = {
    emerald: { fill: 'bg-emerald-500', track: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
    amber: { fill: 'bg-amber-500', track: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' },
    rose: { fill: 'bg-rose-500', track: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300' },
} as const;

const STATUS: Record<HealthStatus, { icon: typeof CircleCheck; label: string; className: string }> = {
    ok: { icon: CircleCheck, label: 'Fine', className: 'text-emerald-600 dark:text-emerald-400' },
    warn: { icon: TriangleAlert, label: 'Needs attention', className: 'text-amber-600 dark:text-amber-400' },
    bad: { icon: CircleOff, label: 'Not done', className: 'text-rose-600 dark:text-rose-400' },
};

const termLabel = (t: TermCollection) => `${t.termName}${t.yearName ? ` ${t.yearName}` : ''}`;
const rateHue = (rate: number): keyof typeof METER => (rate >= TARGET_RATE ? 'emerald' : rate >= 50 ? 'amber' : 'rose');

/** A ratio against a limit: a thin bar whose track is a lighter step of the fill's ramp. */
function Meter({ value, hue, label }: { value: number; hue: keyof typeof METER; label: string }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn('h-2 w-full overflow-hidden rounded-full', METER[hue].track)}>
            <div className={cn('h-full rounded-full transition-[width] duration-500', METER[hue].fill)} style={{ width: `${pct}%` }} />
        </div>
    );
}

/**
 * The fees at a glance for the bursar and the head: a health score out of
 * 100 with the three fixes that would lift it most, this term's collection
 * against last term's, and what is owed by class.
 */
export function FeesOverviewPanel({ onGo }: { onGo: (target: Extract<FixTarget, { kind: 'tab' }>) => void }) {
    // Bumped by Retry; a result belongs to the attempt that loaded it, so a new attempt shows as loading.
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ attempt: number; load: Load } | null>(null);
    const load: Load = result?.attempt === attempt ? result.load : { state: 'loading' };

    useEffect(() => {
        const controller = new AbortController();
        requestJson<{ data: FeesOverview }>(OVERVIEW_URL, { cache: 'no-store', signal: controller.signal })
            .then(({ data }) => setResult({ attempt, load: { state: 'ready', body: data } }))
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setResult({ attempt, load: { state: 'error', message: err instanceof Error ? err.message : 'Could not load the overview.' } });
            });
        return () => controller.abort();
    }, [attempt]);

    if (load.state === 'error') return <LoadError title="Couldn't load the overview" message={load.message} onRetry={() => setAttempt(n => n + 1)} />;
    if (load.state === 'loading') {
        return (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the overview">
                <div className="skeleton-bone h-56 rounded-2xl" />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton-bone h-24 rounded-2xl" />)}</div>
            </div>
        );
    }

    const { current, previous, health } = load.body;
    const grade = GRADE_COPY[health.grade];
    const change = current && previous && previous.expected > 0 ? current.rate - previous.rate : null;

    const go = (item: HealthItem) => (item.target.kind === 'tab'
        ? <button type="button" className="btn-secondary h-9 shrink-0 justify-center" onClick={() => onGo(item.target as Extract<FixTarget, { kind: 'tab' }>)}>Go<ArrowRight className="size-4" aria-hidden /></button>
        : <Link href={item.target.href} className="btn-secondary h-9 shrink-0 justify-center">Go<ArrowRight className="size-4" aria-hidden /></Link>);

    return (
        <div className="flex flex-col gap-4">
            {/* Health: one hero figure, its meter, and the fixes that would lift it most */}
            <section aria-label="Fees health" className="grid gap-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <HeartPulse className="size-4" aria-hidden />Fees health
                    </p>
                    <p className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold tracking-tight">{health.score}</span>
                        <span className="text-sm text-muted-foreground">out of 100</span>
                    </p>
                    <Meter value={health.score} hue={grade.hue} label="Fees health score" />
                    <p className={cn('text-sm font-semibold', METER[grade.hue].text)}>{grade.label}</p>
                    <p className="text-xs text-muted-foreground">How well money is matched to learners, checked against statements, signed off each day, and chased.</p>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="text-sm font-semibold">{health.fixes.length > 0 ? 'Fix these first' : 'Nothing urgent'}</h3>
                    {health.fixes.length === 0 ? (
                        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.06] p-3 text-sm text-emerald-800 dark:text-emerald-200">
                            <CircleCheck className="size-4 shrink-0" aria-hidden />Money is matched, checked and chased. Keep it up.
                        </p>
                    ) : (
                        <ol className="flex flex-col gap-2">
                            {health.fixes.map((item, i) => (
                                <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <p className="text-sm text-muted-foreground">{item.detail} {item.fix}</p>
                                    </div>
                                    {go(item)}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </section>

            {/* This term, against last term */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon={Wallet} hue="blue" label="Billed this term" value={current ? formatKsh(current.expected) : '—'} hint={current ? `${termLabel(current)} · ${current.learners.toLocaleString()} learners` : 'No current term'} />
                <StatTile
                    icon={Coins} label="Collected" tone={!current ? 'default' : current.rate >= TARGET_RATE ? 'good' : current.rate >= 50 ? 'warn' : 'bad'}
                    value={current ? `${current.rate}%` : '—'}
                    hint={current ? `${formatKsh(current.collected)}${change !== null && previous ? ` · ${change >= 0 ? '+' : '−'}${Math.abs(change)} pts on ${previous.termName}` : ''}` : undefined}
                />
                <StatTile icon={TriangleAlert} label="Owed, all terms" value={formatKsh(load.body.totalOwed)} hint={`${load.body.learnersOwing.toLocaleString()} learners owing`} tone={load.body.totalOwed > 0 ? 'warn' : 'good'} />
                <StatTile icon={CircleOff} label="Paid nothing" value={current ? current.paidNothing.toLocaleString() : '—'} hint="billed this term, nothing in" tone={current && current.paidNothing > 0 ? 'bad' : 'good'} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                <section aria-label="Collection rate by term" className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-semibold">Collection rate</h3>
                    {[current, previous].filter((t): t is TermCollection => !!t).map((t, i) => (
                        <div key={t.termId} className="flex flex-col gap-1.5">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate">{termLabel(t)}{i === 0 ? ' (this term)' : ''}</span>
                                <span className="shrink-0 font-semibold">{t.rate}%</span>
                            </div>
                            <Meter value={t.rate} hue={rateHue(t.rate)} label={`${termLabel(t)} collection rate`} />
                            <p className="text-xs text-muted-foreground">{formatKsh(t.collected)} of {formatKsh(t.expected)} · {t.paidNothing.toLocaleString()} paid nothing</p>
                        </div>
                    ))}
                    {!current && <p className="text-sm text-muted-foreground">Set this term’s dates in Settings to compare terms.</p>}
                    <p className="text-xs text-muted-foreground">Target: {TARGET_RATE}% collected. Each bill counts up to its total; overpayments are credit.</p>
                </section>
                <MoneyBars title="Owed by class (learners owing)" rows={load.body.arrearsByClass} barClassName="bg-primary" empty="Nobody owes." />
            </div>

            {/* Every check behind the score */}
            <section aria-label="How the score is made" className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">How the score is made</h3>
                <ul className="flex flex-col divide-y divide-border/60">
                    {health.items.map(item => {
                        const status = STATUS[item.status];
                        const Icon = status.icon;
                        return (
                            <li key={item.id} className="flex items-start gap-3 py-2.5">
                                <Icon className={cn('mt-0.5 size-4 shrink-0', status.className)} aria-label={status.label} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(item.points)}/{item.weight}</span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
