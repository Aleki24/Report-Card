"use client";

import React, { useEffect, useState } from 'react';
import { Bus, CalendarCheck, CalendarDays, FileText, GraduationCap, Users } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { LoadError } from '@/components/ui/LoadError';
import EmptyState from '@/components/dashboard/EmptyState';
import { ModulePage } from '@/components/ops/ModulePage';
import { StatusPill } from '@/components/ops/StatusPill';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date, dateTime, humanize, money, personName } from '@/lib/ops/format';
import {
    ATTENDANCE_TONES, absences as countAbsences, feeBalance, reportTermLabel, rideLine,
    type ChildLink, type ChildOverview as Overview,
} from '@/lib/ops/forms/platform';
import { cn } from '@/lib/utils';
import { AUTO_FIT_GRID } from '@/components/dashboard/grid';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';
import { ParentChildFees } from '@/components/fees/ParentChildFees';
import type { PaymentProvider } from '@/lib/fees';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</h2>
            {children}
        </section>
    );
}

function ChildOverview({ childId, provider }: { childId: string; provider: PaymentProvider }) {
    const [data, setData] = useState<Overview | null>(null);
    // A failed load used to leave the placeholder up for good, with only a passing toast.
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let live = true;
        opsFetch<Overview>(`/api/parent/children/${childId}`)
            .then(d => { if (live) setData(d); })
            .catch(err => { if (live) setError(errorText(err)); });
        return () => { live = false; };
    }, [childId, attempt]);

    if (error) return <LoadError title="Your child's details did not load" message={error} onRetry={() => { setError(null); setAttempt(n => n + 1); }} />;
    if (!data) return <div className="skeleton-bone h-72 rounded-2xl" />;
    const balance = feeBalance(data);
    const absences = countAbsences(data);

    return (
        <div className="flex flex-col gap-5">
            <div className={cn(AUTO_FIT_GRID.tile, 'gap-3')}>
                {data.summary && <StatTile icon={GraduationCap} label="Average score" value={data.summary.stats.examsTaken ? `${data.summary.stats.averageScore}%` : '—'} hint={data.summary.stats.averageTerm ?? undefined} hue="blue" />}
                {data.attendance.length > 0 && <StatTile icon={CalendarCheck} label="Absent (30 days)" value={absences} tone={absences > 2 ? 'warn' : 'good'} />}
                {data.fees.length > 0 && <StatTile icon={FEATURE_ICONS.fees} label="Fee balance" value={money(balance)} tone={balance > 0 ? 'warn' : 'good'} />}
            </div>

            {data.bus && (
                <Section title="School bus" icon={Bus}>
                    <p className="text-sm">
                        {data.bus.vehicle?.registration} is on the road{data.bus.last_seen_at ? `, last seen ${dateTime(data.bus.last_seen_at)}` : ''}.
                        {data.bus.boarded && <> Your child: <strong>{humanize(data.bus.boarded)}</strong>.</>}
                    </p>
                </Section>
            )}

            {/* Columns rather than a grid: sections come and go with the data and
                differ in height, and a grid left a hole beside every short one. */}
            <div className="columns-1 gap-5 xl:columns-2 *:mb-5 *:break-inside-avoid">
                {data.summary && (
                    <Section title="Latest results" icon={FEATURE_ICONS.results}>
                        {data.summary.latestResults.length === 0 ? <p className="text-sm text-muted-foreground">No released results yet.</p> : (
                            <ul className="flex flex-col divide-y divide-border/60">
                                {data.summary.latestResults.map(r => (
                                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                                        <span className="min-w-0"><span className="font-medium">{r.exams?.subjects?.name}</span> <span className="text-muted-foreground">· {r.exams?.name}</span></span>
                                        <span className="shrink-0 tabular-nums font-semibold">{r.percentage != null ? `${Math.round(Number(r.percentage))}%` : '—'} {r.grade_symbol}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                )}

                {data.fees.length > 0 && (
                    <Section title="Fees" icon={FEATURE_ICONS.fees}>
                        <ParentChildFees studentId={childId} provider={provider} />
                    </Section>
                )}

                {data.reports.length > 0 && (
                    <Section title="Report cards" icon={FileText}>
                        {data.reports.slice(0, 3).map(r => (
                            <div key={r.id} className="mb-3 text-sm last:mb-0">
                                <p className="font-medium">{reportTermLabel(r)}</p>
                                {r.overall_average != null && (
                                    <p className="text-muted-foreground">Average {r.overall_average}%{r.overall_position ? ` · position ${r.overall_position}` : ''}</p>
                                )}
                                {r.comments_class_teacher && <p className="text-muted-foreground">Class teacher: {r.comments_class_teacher}</p>}
                                {r.comments_principal && <p className="text-muted-foreground">Principal: {r.comments_principal}</p>}
                            </div>
                        ))}
                    </Section>
                )}

                {data.attendance.length > 0 && (
                    <Section title="Attendance (30 days)" icon={CalendarCheck}>
                        <ul className="flex flex-wrap gap-1.5">
                            {data.attendance.slice(0, 30).map(a => <li key={a.id}><StatusPill status={a.status} tones={ATTENDANCE_TONES} label={`${date(a.date)} · ${humanize(a.status)}`} /></li>)}
                        </ul>
                    </Section>
                )}

                {data.events.length > 0 && (
                    <Section title="Coming up" icon={CalendarDays}>
                        <ul className="flex flex-col gap-1.5 text-sm">
                            {data.events.map(e => <li key={e.id}><span className="font-medium">{date(e.starts_on)}</span> · {e.title}</li>)}
                        </ul>
                    </Section>
                )}

                {data.ride && (
                    <Section title="Transport" icon={Bus}>
                        <p className="text-sm">{rideLine(data.ride)}</p>
                    </Section>
                )}

                {data.summary && data.summary.announcements.length > 0 && (
                    <Section title="Notices" icon={FEATURE_ICONS.announcements}>
                        <ul className="flex flex-col gap-3 text-sm">
                            {data.summary.announcements.map(a => (
                                <li key={a.id}><p className="font-medium">{a.title}</p><p className="line-clamp-3 text-muted-foreground">{a.content}</p></li>
                            ))}
                        </ul>
                    </Section>
                )}
            </div>
        </div>
    );
}

function Children() {
    const [children, setChildren] = useState<ChildLink[] | null>(null);
    const [active, setActive] = useState<string | null>(null);
    // Not "No children linked yet": that sent parents to the school over a dropped connection.
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    // Which online payment the school takes, for every child's Pay buttons.
    const [provider, setProvider] = useState<PaymentProvider>('NONE');
    useEffect(() => {
        fetch('/api/school/payment-settings/status')
            .then(r => (r.ok ? r.json() : null))
            .then((j: { data?: { provider?: PaymentProvider } } | null) => setProvider(j?.data?.provider ?? 'NONE'))
            .catch(() => {});
    }, []);
    useEffect(() => {
        let live = true;
        opsFetch<ChildLink[]>('/api/parent/children')
            .then(c => { if (!live) return; setChildren(c); setActive(c[0]?.student?.id ?? null); })
            .catch(err => { if (live) setError(errorText(err)); });
        return () => { live = false; };
    }, [attempt]);

    if (error) return <LoadError title="Your children did not load" message={error} onRetry={() => { setError(null); setAttempt(n => n + 1); }} />;
    if (children === null) return <div className="skeleton-bone h-40 rounded-2xl" />;
    if (children.length === 0) return <EmptyState icon={<Users className="size-6" />} title="No children linked yet" description="Ask the school to link your account to your child." hue="rose" />;

    const familyOwed = children.reduce((sum, c) => sum + Math.max(0, c.balance ?? 0), 0);

    return (
        <div className="flex flex-col gap-5">
            {children.length > 1 && familyOwed > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family fee balance</p>
                        <p className="font-display text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{money(familyOwed)}</p>
                    </div>
                    <p className="max-w-[16rem] text-right text-xs text-muted-foreground">Across {children.length} children. Open each child to pay their fees.</p>
                </div>
            )}
            {children.length > 1 && (
                <div role="tablist" aria-label="Child" className="flex flex-wrap gap-2">
                    {children.map(c => c.student && (
                        <button key={c.student.id} type="button" role="tab" aria-selected={active === c.student.id} onClick={() => setActive(c.student!.id)}
                            className={cn('rounded-xl border px-3 py-2 text-left text-sm', active === c.student.id ? 'border-primary bg-primary/10' : 'border-border bg-card')}>
                            <span className="font-medium">{personName(c.student.user)}</span>
                            <span className="block text-xs text-muted-foreground">{c.student.stream?.full_name}{c.balance && c.balance > 0 ? ` · owes ${money(c.balance)}` : ''}</span>
                        </button>
                    ))}
                </div>
            )}
            {active && <ChildOverview key={active} childId={active} provider={provider} />}
        </div>
    );
}

export default function ParentHomePage() {
    return (
        <ModulePage
            module="parent_portal"
            title="My children"
            eyebrow="Parent portal"
            description="Results, fees, attendance, the bus and school news for each of your children."
            icon={FEATURE_ICONS.people}
            hue="rose"
            tabs={[{ id: 'children', label: 'Children', icon: Users, hue: 'rose', render: () => <Children /> }]}
        />
    );
}
