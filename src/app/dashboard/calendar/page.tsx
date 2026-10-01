"use client";

import React from 'react';
import { CalendarDays, ListChecks } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { useOpsList } from '@/hooks/useOpsList';
import { date, humanize } from '@/lib/ops/format';
import { EVENT_FIELDS, EVENT_TYPE_TONES, eventDefaults, isHappeningToday, monthLabel, upcomingByMonth, type SchoolEvent } from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

/** Upcoming events grouped by month: what everyone in school needs to plan around. */
function Agenda() {
    const { rows, loading } = useOpsList<SchoolEvent>('events');
    const months = upcomingByMonth(rows);

    if (loading) return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-bone h-16 rounded-2xl" />)}</div>;
    if (months.length === 0) return <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">Nothing coming up on the school calendar.</p>;

    return (
        <div className="flex flex-col gap-6">
            {months.map(([month, events]) => (
                <section key={month}>
                    <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {monthLabel(month)}
                    </h2>
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {events.map(e => {
                            const d = new Date(`${e.starts_on}T00:00:00`);
                            const isToday = isHappeningToday(e);
                            return (
                                <li key={e.id} className={cn('flex gap-3 rounded-2xl border bg-card p-4 shadow-sm', isToday ? 'border-primary/50' : 'border-border/70')}>
                                    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted py-1.5">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">{d.toLocaleDateString('en-KE', { weekday: 'short' })}</span>
                                        <span className="text-lg leading-none font-bold tabular-nums">{d.getDate()}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {e.ends_on && e.ends_on !== e.starts_on ? `${date(e.starts_on)} – ${date(e.ends_on)}` : date(e.starts_on)} · {humanize(e.audience)}
                                        </p>
                                        <div className="mt-2"><StatusPill status={e.event_type} tones={EVENT_TYPE_TONES} /></div>
                                        {e.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{e.description}</p>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}

export default function CalendarPage() {
    const { can } = useAuth();
    const manager = can('calendar.manage');
    return (
        <ModulePage
            module="calendar"
            title="School calendar"
            eyebrow="Academics"
            description="Exams, marks deadlines, report release, meetings and holidays in one place."
            icon={CalendarDays}
            hue="blue"
            tabs={[
                { id: 'agenda', label: 'Upcoming', icon: CalendarDays, hue: 'blue', render: () => <Agenda /> },
                {
                    id: 'manage', label: 'Manage events', shortLabel: 'Manage', icon: ListChecks, hue: 'violet', visible: manager,
                    render: () => (
                        <ResourceManager<'events', SchoolEvent>
                            resource="events"
                            fields={EVENT_FIELDS}
                            canCreate
                            canEdit
                            canDelete
                            defaults={eventDefaults()}
                            searchText={e => `${e.title} ${e.event_type}`}
                            columns={[
                                { key: 'title', header: 'Event', render: e => <span className="font-medium">{e.title}</span> },
                                { key: 'type', header: 'Type', render: e => <StatusPill status={e.event_type} tones={EVENT_TYPE_TONES} /> },
                                { key: 'when', header: 'When', render: e => (e.ends_on ? `${date(e.starts_on)} – ${date(e.ends_on)}` : date(e.starts_on)) },
                                { key: 'audience', header: 'Audience', hideOnMobile: true, render: e => humanize(e.audience) },
                            ]}
                        />
                    ),
                },
            ]}
        />
    );
}
