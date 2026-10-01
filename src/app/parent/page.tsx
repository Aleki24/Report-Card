"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Bus, CalendarCheck, CalendarDays, DollarSign, FileText, GraduationCap, Users } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import EmptyState from '@/components/dashboard/EmptyState';
import { ModulePage } from '@/components/ops/ModulePage';
import { StatusPill } from '@/components/ops/StatusPill';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date, dateTime, humanize, money, personName } from '@/lib/ops/format';
import {
    ATTENDANCE_TONES, FEE_STATUS_TONES as FEE_TONES, absences as countAbsences, feeBalance, rideLine,
    type ChildLink, type ChildOverview as Overview,
} from '@/lib/ops/forms/platform';
import { cn } from '@/lib/utils';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</h2>
            {children}
        </section>
    );
}

function ChildOverview({ childId }: { childId: string }) {
    const [data, setData] = useState<Overview | null>(null);
    useEffect(() => {
        let live = true;
        opsFetch<Overview>(`/api/parent/children/${childId}`).then(d => { if (live) setData(d); }).catch(err => toast.error(errorText(err)));
        return () => { live = false; };
    }, [childId]);

    if (!data) return <div className="skeleton-bone h-72 rounded-2xl" />;
    const balance = feeBalance(data);
    const absences = countAbsences(data);

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {data.summary && <StatTile icon={GraduationCap} label="Average score" value={data.summary.stats.examsTaken ? `${data.summary.stats.averageScore}%` : '—'} hint={data.summary.currentTerm?.name} hue="blue" />}
                {data.attendance.length > 0 && <StatTile icon={CalendarCheck} label="Absent (30 days)" value={absences} tone={absences > 2 ? 'warn' : 'good'} />}
                {data.fees.length > 0 && <StatTile icon={DollarSign} label="Fee balance" value={money(balance)} tone={balance > 0 ? 'warn' : 'good'} />}
            </div>

            {data.bus && (
                <Section title="School bus" icon={Bus}>
                    <p className="text-sm">
                        {data.bus.vehicle?.registration} is on the road{data.bus.last_seen_at ? `, last seen ${dateTime(data.bus.last_seen_at)}` : ''}.
                        {data.bus.boarded && <> Your child: <strong>{humanize(data.bus.boarded)}</strong>.</>}
                    </p>
                </Section>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {data.summary && (
                    <Section title="Latest results" icon={GraduationCap}>
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
                    <Section title="Fees" icon={DollarSign}>
                        <ul className="flex flex-col divide-y divide-border/60">
                            {data.fees.map(f => (
                                <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                                    <span>{f.term?.name ?? 'Term'}</span>
                                    <span className="flex items-center gap-2 tabular-nums">{money(Number(f.total_fee) - Number(f.paid_amount))} owed <StatusPill status={f.status} tones={FEE_TONES} /></span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {data.reports.length > 0 && (
                    <Section title="Report cards" icon={FileText}>
                        {data.reports.slice(0, 3).map(r => (
                            <div key={r.id} className="mb-3 text-sm last:mb-0">
                                <p className="font-medium">Average {r.overall_average ?? '—'}%{r.overall_position ? ` · position ${r.overall_position}` : ''}</p>
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
                    <Section title="Notices" icon={Bell}>
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
    useEffect(() => {
        opsFetch<ChildLink[]>('/api/parent/children')
            .then(c => { setChildren(c); setActive(c[0]?.student?.id ?? null); })
            .catch(err => { toast.error(errorText(err)); setChildren([]); });
    }, []);

    if (children === null) return <div className="skeleton-bone h-40 rounded-2xl" />;
    if (children.length === 0) return <EmptyState icon={<Users className="size-6" />} title="No children linked yet" description="Ask the school to link your account to your child." hue="rose" />;

    return (
        <div className="flex flex-col gap-5">
            {children.length > 1 && (
                <div role="tablist" aria-label="Child" className="flex flex-wrap gap-2">
                    {children.map(c => c.student && (
                        <button key={c.student.id} type="button" role="tab" aria-selected={active === c.student.id} onClick={() => setActive(c.student!.id)}
                            className={cn('rounded-xl border px-3 py-2 text-left text-sm', active === c.student.id ? 'border-primary bg-primary/10' : 'border-border bg-card')}>
                            <span className="font-medium">{personName(c.student.user)}</span>
                            <span className="block text-xs text-muted-foreground">{c.student.stream?.full_name}</span>
                        </button>
                    ))}
                </div>
            )}
            {active && <ChildOverview key={active} childId={active} />}
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
            icon={Users}
            hue="rose"
            tabs={[{ id: 'children', label: 'Children', icon: Users, hue: 'rose', render: () => <Children /> }]}
        />
    );
}
