"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookMarked, CalendarClock, ClipboardCheck, Gauge, NotebookPen } from 'lucide-react';
import { TeachingDayPanel } from '@/components/academics/TeachingDayPanel';
import DataTable from '@/components/ui/DataTable';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { SchemeEditor } from '@/components/academics/SchemeEditor';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date, personName, today } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import {
    PLAN_FIELDS, RECORDS_TIP, RECORD_FIELDS, SCHEME_FIELDS, SCHEME_TONES, coveragePercent, coverageTone,
    type Coverage, type LessonPlan as Plan, type Scheme, type WorkRecord,
} from '@/lib/ops/forms/academics';
import { cn } from '@/lib/utils';

const COVERAGE_BAR = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' } as const;

function CoverageTable() {
    const [rows, setRows] = useState<Coverage[] | null>(null);
    useEffect(() => { opsFetch<Coverage[]>('/api/academics/lesson-records/coverage').then(setRows).catch(err => { toast.error(errorText(err)); setRows([]); }); }, []);
    return (
        <DataTable
            loading={rows === null}
            rows={rows ?? []}
            rowKey={r => r.schemeId}
            emptyState="Coverage appears once schemes of work have lessons and teachers tick them as taught."
            columns={[
                { key: 'scheme', header: 'Scheme', render: r => <span className="font-medium">{r.subject} · {r.className}</span> },
                { key: 'teacher', header: 'Teacher', hideOnMobile: true, render: r => r.teacher },
                {
                    key: 'progress', header: 'Coverage', render: r => {
                        const pct = coveragePercent(r);
                        const tone = coverageTone(pct);
                        return (
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-24 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Syllabus covered">
                                    <span className={cn('block h-full rounded-full', COVERAGE_BAR[tone as keyof typeof COVERAGE_BAR])} style={{ width: `${pct}%` }} />
                                </span>
                                <span className="text-xs tabular-nums">{r.covered}/{r.planned} · {pct}%</span>
                            </span>
                        );
                    },
                },
                { key: 'last', header: 'Last taught', hideOnMobile: true, render: r => date(r.lastTaught) },
            ]}
        />
    );
}

export default function LessonRecordsPage() {
    const { can, profile } = useAuth();
    const reviewer = can('lesson_records.review');
    const writer = can('lesson_records.write');
    const me = profile?.id ?? '';
    const [openScheme, setOpenScheme] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const mine = (row: { teacher_id: string }) => row.teacher_id === me;

    const teacherCol = reviewer ? [{ key: 'teacher', header: 'Teacher', hideOnMobile: true, render: (r: { teacher: PersonName | null }) => personName(r.teacher) }] : [];

    return (
        <>
            <ModulePage
                module="lesson_records"
                title="Professional records"
                eyebrow="Academics"
                description="Schemes of work, lesson plans and records of work in one chain, with syllabus coverage for HODs and the DOS."
                icon={NotebookPen}
                hue="violet"
                tabs={[
                    ...(writer ? [{
                        id: 'day', label: 'My teaching day', shortLabel: 'Today', icon: CalendarClock, hue: 'sky' as const,
                        render: () => <TeachingDayPanel onChanged={() => setVersion(v => v + 1)} />,
                    }] : []),
                    {
                        id: 'schemes', label: 'Schemes of work', shortLabel: 'Schemes', icon: BookMarked, hue: 'violet',
                        render: () => (
                            <ResourceManager<'schemes', Scheme>
                                key={version}
                                resource="schemes"
                                fields={SCHEME_FIELDS}
                                canCreate={writer}
                                canEdit={s => mine(s) && (s.status === 'DRAFT' || s.status === 'RETURNED')}
                                canDelete={s => mine(s) && s.status === 'DRAFT'}
                                onRowClick={s => setOpenScheme(s.id)}
                                searchText={s => `${s.title} ${s.subject?.name} ${s.stream?.full_name} ${personName(s.teacher)}`}
                                columns={[
                                    { key: 'title', header: 'Scheme', render: s => <span className="font-medium">{s.title}</span> },
                                    { key: 'class', header: 'Class & subject', render: s => `${s.stream?.full_name ?? ''} · ${s.subject?.name ?? ''}` },
                                    ...teacherCol,
                                    { key: 'status', header: 'Status', render: s => <StatusPill status={s.status} tones={SCHEME_TONES} /> },
                                ]}
                                emptyText="No schemes yet. Create one, then add its weekly lessons (or draft them with AI)."
                            />
                        ),
                    },
                    {
                        id: 'plans', label: 'Lesson plans', shortLabel: 'Plans', icon: NotebookPen, hue: 'blue',
                        render: () => (
                            <ResourceManager<'lesson-plans', Plan>
                                resource="lesson-plans"
                                fields={PLAN_FIELDS}
                                canCreate={writer}
                                canEdit={mine}
                                canDelete={mine}
                                defaults={{ lesson_date: today() }}
                                searchText={p => `${p.topic} ${p.subject?.name} ${p.stream?.full_name}`}
                                columns={[
                                    { key: 'topic', header: 'Topic', render: p => <span className="font-medium">{p.topic}</span> },
                                    { key: 'class', header: 'Class & subject', render: p => `${p.stream?.full_name ?? ''} · ${p.subject?.name ?? ''}` },
                                    ...teacherCol,
                                    { key: 'date', header: 'Date', render: p => date(p.lesson_date) },
                                ]}
                            />
                        ),
                    },
                    {
                        id: 'records', label: 'Records of work', shortLabel: 'Records', icon: ClipboardCheck, hue: 'emerald',
                        render: () => (
                            <ResourceManager<'records-of-work', WorkRecord>
                                resource="records-of-work"
                                fields={RECORD_FIELDS}
                                canCreate={writer}
                                canEdit={mine}
                                canDelete={mine}
                                defaults={{ lesson_date: today() }}
                                searchText={r => `${r.work_covered} ${r.subject?.name} ${r.stream?.full_name}`}
                                header={() => <p className="text-sm text-muted-foreground">{RECORDS_TIP}</p>}
                                columns={[
                                    { key: 'work', header: 'Work covered', render: r => <span className="line-clamp-2">{r.work_covered}</span> },
                                    { key: 'class', header: 'Class & subject', hideOnMobile: true, render: r => `${r.stream?.full_name ?? ''} · ${r.subject?.name ?? ''}` },
                                    ...teacherCol,
                                    { key: 'date', header: 'Date', render: r => date(r.lesson_date) },
                                ]}
                            />
                        ),
                    },
                    { id: 'coverage', label: 'Syllabus coverage', shortLabel: 'Coverage', icon: Gauge, hue: 'amber', render: () => <CoverageTable key={version} /> },
                ]}
            />
            {openScheme && (
                <SchemeEditor key={openScheme} schemeId={openScheme} canReview={reviewer} userId={me}
                    onClose={() => setOpenScheme(null)} onChanged={() => setVersion(v => v + 1)} />
            )}
        </>
    );
}
