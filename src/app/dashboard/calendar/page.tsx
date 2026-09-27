"use client";

import React, { useMemo } from 'react';
import { CalendarDays, ListChecks } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { useOpsList } from '@/hooks/useOpsList';
import { EVENT_AUDIENCES, EVENT_TYPES } from '@/lib/ops/resources/academics';
import { date, humanize, today } from '@/lib/ops/format';
import { cn } from '@/lib/utils';

type EventType = (typeof EVENT_TYPES)[number];

interface SchoolEvent {
    id: string;
    title: string;
    event_type: EventType;
    audience: (typeof EVENT_AUDIENCES)[number];
    starts_on: string;
    ends_on: string | null;
    description: string | null;
}

const TYPE_TONES: Record<EventType, PillTone> = {
    EXAM: 'violet', CAT: 'violet', MARKS_DEADLINE: 'bad', REPORT_RELEASE: 'good', MEETING: 'info',
    HOLIDAY: 'warn', SPORTS: 'info', OPENING: 'good', CLOSING: 'warn', OTHER: 'neutral',
};

const FIELDS: readonly FieldDef<FieldName<'events'>>[] = [
    { name: 'title', label: 'Title', kind: 'text', required: true, span: 'full' },
    { name: 'event_type', label: 'Type', kind: 'enum', values: EVENT_TYPES, required: true },
    { name: 'audience', label: 'Who sees it', kind: 'enum', values: EVENT_AUDIENCES, required: true },
    { name: 'starts_on', label: 'Starts', kind: 'date', required: true },
    { name: 'ends_on', label: 'Ends', kind: 'date', hint: 'Leave empty for a one-day event.' },
    { name: 'exam_id', label: 'Linked exam', kind: 'lookup', lookup: 'exams', span: 'full' },
    { name: 'description', label: 'Details', kind: 'textarea' },
];

/** Upcoming events grouped by month: what everyone in school needs to plan around. */
function Agenda() {
    const { rows, loading } = useOpsList<SchoolEvent>('events');
    const months = useMemo(() => {
        const from = today();
        const upcoming = rows.filter(e => (e.ends_on ?? e.starts_on) >= from);
        const groups = new Map<string, SchoolEvent[]>();
        for (const e of upcoming) {
            const key = e.starts_on.slice(0, 7);
            groups.set(key, [...(groups.get(key) ?? []), e]);
        }
        return [...groups.entries()];
    }, [rows]);

    if (loading) return <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-bone h-16 rounded-2xl" />)}</div>;
    if (months.length === 0) return <p className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">Nothing coming up on the school calendar.</p>;

    return (
        <div className="flex flex-col gap-6">
            {months.map(([month, events]) => (
                <section key={month}>
                    <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
                    </h2>
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {events.map(e => {
                            const d = new Date(`${e.starts_on}T00:00:00`);
                            const isToday = e.starts_on <= today() && (e.ends_on ?? e.starts_on) >= today();
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
                                        <div className="mt-2"><StatusPill status={e.event_type} tones={TYPE_TONES} /></div>
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
                            fields={FIELDS}
                            canCreate
                            canEdit
                            canDelete
                            defaults={{ event_type: 'OTHER', audience: 'ALL', starts_on: today() }}
                            searchText={e => `${e.title} ${e.event_type}`}
                            columns={[
                                { key: 'title', header: 'Event', render: e => <span className="font-medium">{e.title}</span> },
                                { key: 'type', header: 'Type', render: e => <StatusPill status={e.event_type} tones={TYPE_TONES} /> },
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
