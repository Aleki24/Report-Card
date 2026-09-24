import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatPercent, getDueLabel, scoreColor } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    BackLink, Badge, Button, Card, EmptyState, ListCard, ListRow, LoadingView, Notice, ProgressBar, Screen, SectionLabel, StatGrid, StatTile,
} from '@/components/ui';
import { SubjectTypeBadge } from '@/components/student/SubjectTypeBadge';
import { SubmitAssignment } from '@/components/student/SubmitAssignment';
import type { DashboardData, PerformanceTrend, Subject } from '@/lib/types';

export default function SubjectDetailScreen() {
    const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
    const subjects = useApiQuery<Subject[]>('/api/school/student/subjects');
    const perf = useApiQuery<PerformanceTrend[]>('/api/school/student/performance');
    const dash = useApiQuery<DashboardData>('/api/school/student/dashboard');
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState<string | null>(null);

    const subject = (subjects.data ?? []).find((s) => s.id === subjectId) ?? null;
    const trend = useMemo(
        () =>
            subject
                ? (perf.data ?? []).flatMap((t) => {
                      const mark = t.subjects?.find((s) => s.name === subject.name);
                      return mark ? [{ label: `${t.termName} ${t.yearName}`.trim(), average: mark.average, overall: t.overallAverage }] : [];
                  })
                : [],
        [perf.data, subject],
    );

    if (subjects.loading || perf.loading || dash.loading) return <LoadingView />;

    if (!subject) {
        return (
            <Screen>
                <BackLink />
                <EmptyState title="Subject not found" description="This subject doesn't exist or you don't have access to it." />
            </Screen>
        );
    }

    const assignments = (dash.data?.assignments ?? []).filter((a) => a.subjectName === subject.name);
    const materials = (dash.data?.materials ?? []).filter((m) => m.subjectName === subject.name);
    const latest = trend[trend.length - 1];
    const previous = trend[trend.length - 2];
    const change = latest && previous ? latest.average - previous.average : null;

    return (
        <Screen>
            <BackLink label="Subjects" />
            <Text style={styles.title}>{subject.name}</Text>
            <View style={styles.badgeRow}>
                <SubjectTypeBadge type={subject.subject_type} />
                {subject.code ? <Badge label={subject.code} /> : null}
                {subject.enrollment_role === 'ELECTIVE' ? <Badge label="My elective" variant="info" /> : null}
            </View>
            {submitted ? <Notice message={`Submitted “${submitted}”.`} onDismiss={() => setSubmitted(null)} /> : null}

            <StatGrid>
                <StatTile label="Latest average" value={formatPercent(latest?.average, 1)} tone={scoreColor(latest?.average)} />
                <StatTile
                    label="Change"
                    value={change == null ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}`}
                    tone={change == null ? undefined : change >= 0 ? colors.success : colors.danger}
                    sub="vs previous term"
                />
                <StatTile label="vs my overall" value={latest ? `${(latest.average - latest.overall >= 0 ? '+' : '')}${(latest.average - latest.overall).toFixed(1)}` : '—'} />
            </StatGrid>

            <SectionLabel>Performance trend</SectionLabel>
            <Card>
                {trend.length === 0 ? (
                    <EmptyState title="No performance data yet" />
                ) : (
                    trend.map((t) => (
                        <View key={t.label} style={styles.trendRow}>
                            <Text style={styles.trendLabel} numberOfLines={1}>{t.label}</Text>
                            <View style={{ flex: 1 }}>
                                <ProgressBar value={t.average} color={scoreColor(t.average)} />
                            </View>
                            <Text style={styles.trendValue}>{formatPercent(t.average, 1)}</Text>
                        </View>
                    ))
                )}
            </Card>

            <SectionLabel>Assignments</SectionLabel>
            {assignments.length === 0 ? (
                <Card>
                    <EmptyState title="No assignments for this subject" />
                </Card>
            ) : (
                assignments.map((a) =>
                    submitting === a.id ? (
                        <SubmitAssignment key={a.id} assignment={a} onCancel={() => setSubmitting(null)} onDone={() => { setSubmitting(null); setSubmitted(a.title); }} />
                    ) : (
                        <ListCard key={a.id} style={{ marginBottom: spacing.sm }}>
                            <ListRow
                                title={a.title}
                                subtitle={getDueLabel(a.dueDate)}
                                right={
                                    <View style={{ flexDirection: 'row', gap: 4 }}>
                                        {a.fileUrl ? <Button size="sm" variant="ghost" label="File" onPress={() => void Linking.openURL(a.fileUrl as string)} /> : null}
                                        <Button size="sm" label="Submit" onPress={() => setSubmitting(a.id)} />
                                    </View>
                                }
                            />
                        </ListCard>
                    ),
                )
            )}

            <SectionLabel>Materials</SectionLabel>
            <ListCard>
                {materials.length === 0 ? (
                    <EmptyState title="No materials for this subject" />
                ) : (
                    materials.map((m) => <ListRow key={m.id} title={m.title} subtitle={m.fileType} onPress={m.fileUrl ? () => void Linking.openURL(m.fileUrl as string) : undefined} />)
                )}
            </ListCard>
        </Screen>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 22, fontWeight: '800', color: colors.foreground, marginBottom: spacing.sm },
    badgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    trendLabel: { width: 110, fontSize: 12, fontWeight: '600', color: colors.foreground },
    trendValue: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.foreground },
});
