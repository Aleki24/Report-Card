import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { date, personName, today } from '@shared/ops/format';
import {
    PLAN_FIELDS, RECORDS_TIP, RECORD_FIELDS, SCHEME_FIELDS, SCHEME_TONES, coveragePercent, coverageTone,
    type Coverage, type LessonPlan, type Scheme, type WorkRecord,
} from '@shared/ops/forms/academics';
import { Card, EmptyState, ErrorBanner, LoadingView, ProgressBar } from '@/components/ui';
import { SchemeSheet } from '@/components/academics/SchemeSheet';
import { TeachingDayList } from '@/components/academics/TeachingDay';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { StatusPill, toneColor, useRefreshSignal } from '@/components/ops/bits';
import { useOpsData } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { spacing, fonts, useTheme } from '@/lib/theme';

const classSubject = (r: { stream: { full_name: string } | null; subject: { name: string } | null }) => `${r.stream?.full_name ?? ''} · ${r.subject?.name ?? ''}`;

function CoverageList() {
    const { colors } = useTheme();
    const { data, loading, error, reload } = useOpsData<Coverage[]>('/api/academics/lesson-records/coverage');
    useRefreshSignal(reload);
    if (loading && !data) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (!data || data.length === 0) return <EmptyState title="Coverage appears once schemes of work have lessons and teachers tick them as taught." />;
    return (
        <View>
            {data.map((r) => {
                const pct = coveragePercent(r);
                return (
                    <Card key={r.schemeId} style={{ marginBottom: spacing.sm, padding: spacing.md, gap: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{r.subject} · {r.className}</Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{r.teacher} · last taught {date(r.lastTaught)}</Text>
                        <ProgressBar value={pct} color={toneColor(colors, coverageTone(pct))} />
                        <Text style={{ fontSize: 12, color: colors.foreground }}>{r.covered}/{r.planned} · {pct}%</Text>
                    </Card>
                );
            })}
        </View>
    );
}

export default function LessonRecordsScreen() {
    const { colors } = useTheme();
    const { can, profile } = useCurrentUser();
    const reviewer = can('lesson_records.review');
    const writer = can('lesson_records.write');
    const me = profile?.id ?? '';
    const [openScheme, setOpenScheme] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const mine = (row: { teacher_id: string }) => row.teacher_id === me;
    const teacherDetail = (r: { teacher: Scheme['teacher'] }) => (reviewer ? [['Teacher', personName(r.teacher)] as const] : []);

    return (
        <>
            <ModuleScreen
                screen="lesson-records"
                title="Professional records"
                description="Schemes of work, lesson plans and records of work in one chain, with syllabus coverage for HODs and the DOS."
                tabs={[
                    ...(writer ? [{ id: 'day', label: 'Today', render: () => <TeachingDayList onChanged={() => setVersion((v) => v + 1)} /> }] : []),
                    {
                        id: 'schemes',
                        label: 'Schemes',
                        render: () => (
                            <ResourceList<'schemes', Scheme>
                                key={version}
                                resource="schemes"
                                fields={SCHEME_FIELDS}
                                canCreate={writer}
                                canEdit={(s) => mine(s) && (s.status === 'DRAFT' || s.status === 'RETURNED')}
                                canDelete={(s) => mine(s) && s.status === 'DRAFT'}
                                onRowPress={(s) => setOpenScheme(s.id)}
                                searchText={(s) => `${s.title} ${s.subject?.name} ${s.stream?.full_name} ${personName(s.teacher)}`}
                                title={(s) => s.title}
                                subtitle={classSubject}
                                badge={(s) => <StatusPill status={s.status} tones={SCHEME_TONES} />}
                                details={(s) => [...teacherDetail(s), ['Term', s.term?.name ?? '—']]}
                                emptyText="No schemes yet. Create one, then add its weekly lessons (or draft them with AI)."
                            />
                        ),
                    },
                    {
                        id: 'plans',
                        label: 'Lesson plans',
                        render: () => (
                            <ResourceList<'lesson-plans', LessonPlan>
                                resource="lesson-plans"
                                fields={PLAN_FIELDS}
                                canCreate={writer}
                                canEdit={mine}
                                canDelete={mine}
                                defaults={{ lesson_date: today() }}
                                searchText={(p) => `${p.topic} ${p.subject?.name} ${p.stream?.full_name}`}
                                title={(p) => p.topic}
                                subtitle={(p) => `${classSubject(p)} · ${date(p.lesson_date)}`}
                                details={teacherDetail}
                            />
                        ),
                    },
                    {
                        id: 'records',
                        label: 'Records of work',
                        render: () => (
                            <ResourceList<'records-of-work', WorkRecord>
                                resource="records-of-work"
                                fields={RECORD_FIELDS}
                                canCreate={writer}
                                canEdit={mine}
                                canDelete={mine}
                                defaults={{ lesson_date: today() }}
                                searchText={(r) => `${r.work_covered} ${r.subject?.name} ${r.stream?.full_name}`}
                                header={() => <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>{RECORDS_TIP}</Text>}
                                title={(r) => r.work_covered}
                                subtitle={(r) => `${classSubject(r)} · ${date(r.lesson_date)}`}
                                details={(r) => [...teacherDetail(r), ...(r.remarks ? [['Remarks', r.remarks] as const] : [])]}
                            />
                        ),
                    },
                    { id: 'coverage', label: 'Coverage', render: () => <CoverageList key={version} /> },
                ]}
            />
            {openScheme ? (
                <SchemeSheet key={openScheme} schemeId={openScheme} canReview={reviewer} userId={me} onClose={() => setOpenScheme(null)} onChanged={() => setVersion((v) => v + 1)} />
            ) : null}
        </>
    );
}
