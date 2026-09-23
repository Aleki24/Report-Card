import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import { currentTermNumber } from '@/lib/academics';
import { daysUntil, formatCurrency, formatLongToday, formatPercent, getDueLabel, getGreeting, getTimeAgo, isSoon, scoreColor } from '@/lib/format';
import { colors, radius, spacing } from '@/lib/theme';
import {
    Badge, Button, Card, DateBadge, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice, ProgressBar,
    Screen, SectionLabel, StatGrid, StatTile,
} from '@/components/ui';
import { SubmitAssignment } from '@/components/student/SubmitAssignment';
import { StudyGoals } from '@/components/student/StudyGoals';
import type { DashboardData, FeeRecord, PerformanceTrend } from '@/lib/types';

export default function StudentDashboardScreen() {
    const router = useRouter();
    const { profile } = useCurrentUser();
    const dash = useApiQuery<DashboardData>('/api/school/student/dashboard');
    const perf = useApiQuery<PerformanceTrend[]>('/api/school/student/performance');
    const fees = useApiQuery<FeeRecord[]>('/api/school/fees');
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState<string | null>(null);

    if (dash.loading) return <LoadingView />;

    const refresh = () => {
        dash.refresh();
        perf.refresh();
        fees.refresh();
    };
    const data = dash.data;
    const stats = data?.stats;
    const exams = data?.upcomingExams ?? [];
    const trends = perf.data ?? [];
    const feeBalance = (fees.data ?? []).reduce((s, f) => s + (f.balance || 0), 0);
    const nextExam = exams
        .map((e) => ({ e, d: daysUntil(e.exam_date) }))
        .filter(({ d }) => d >= 0 && d <= 3)
        .sort((a, b) => a.d - b.d)[0];

    return (
        <Screen onRefresh={refresh} refreshing={dash.refreshing}>
            <View style={styles.hero}>
                <Text style={styles.heroGreeting}>
                    {getGreeting()}, {profile?.first_name ?? ''}
                </Text>
                <Text style={styles.heroDate}>{formatLongToday()} · Term {currentTermNumber()}</Text>
                {nextExam ? (
                    <Text style={styles.heroPill}>
                        ⏰ {nextExam.e.subject_name} exam {nextExam.d === 0 ? 'today' : nextExam.d === 1 ? 'tomorrow' : `in ${nextExam.d} days`}
                    </Text>
                ) : null}
            </View>

            {dash.error ? <ErrorBanner message={dash.error} onRetry={refresh} /> : null}
            {submitted ? <Notice message={`Submitted “${submitted}”.`} onDismiss={() => setSubmitted(null)} /> : null}

            <SectionLabel>At a glance</SectionLabel>
            <StatGrid>
                <StatTile label="Attendance" value={formatPercent(stats?.attendanceRate)} onPress={() => router.push('/student/attendance')} />
                <StatTile label="Average score" value={formatPercent(stats?.averageScore)} tone={scoreColor(stats?.averageScore)} onPress={() => router.push('/student/results')} />
                <StatTile label="Exams taken" value={stats?.examsTaken ?? 0} onPress={() => router.push('/student/results')} />
                <StatTile label="Subjects" value={stats?.subjectsCount ?? 0} onPress={() => router.push('/student/subjects')} />
                {(fees.data ?? []).length > 0 ? (
                    <StatTile
                        label="Fees balance"
                        value={formatCurrency(feeBalance)}
                        tone={feeBalance > 0 ? colors.danger : colors.success}
                        sub={feeBalance > 0 ? 'Outstanding' : 'All settled'}
                        onPress={() => router.push('/student/fees')}
                    />
                ) : null}
            </StatGrid>

            <SectionLabel>Upcoming exams</SectionLabel>
            <ListCard>
                {exams.length === 0 ? (
                    <EmptyState title="No upcoming exams" description="Scheduled exams will appear here." />
                ) : (
                    exams.slice(0, 5).map((exam) => (
                        <ListRow
                            key={exam.id}
                            left={<DateBadge date={exam.exam_date} highlight={isSoon(exam.exam_date)} />}
                            title={exam.subject_name}
                            subtitle={exam.name}
                            right={isSoon(exam.exam_date) ? <Badge label="SOON" variant="warning" /> : undefined}
                        />
                    ))
                )}
            </ListCard>

            <SectionLabel>Announcements</SectionLabel>
            <ListCard>
                {(data?.announcements ?? []).length === 0 ? (
                    <EmptyState title="No announcements yet" />
                ) : (
                    (data?.announcements ?? []).slice(0, 5).map((a) => (
                        <ListRow key={a.id} title={a.title} subtitle={a.content} meta={getTimeAgo(a.createdAt)} right={a.isImportant ? <Badge label="Important" variant="danger" /> : undefined} />
                    ))
                )}
            </ListCard>

            <SectionLabel>Assignments & homework</SectionLabel>
            {(data?.assignments ?? []).length === 0 ? (
                <Card>
                    <EmptyState title="No assignments due" />
                </Card>
            ) : (
                (data?.assignments ?? []).map((a) =>
                    submitting === a.id ? (
                        <SubmitAssignment
                            key={a.id}
                            assignment={a}
                            onCancel={() => setSubmitting(null)}
                            onDone={() => {
                                setSubmitting(null);
                                setSubmitted(a.title);
                            }}
                        />
                    ) : (
                        <Card key={a.id} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.cardTitle}>{a.title}</Text>
                                <Badge label={getDueLabel(a.dueDate)} variant={getDueLabel(a.dueDate) === 'Overdue' ? 'danger' : 'warning'} />
                            </View>
                            <Text style={styles.muted}>{a.subjectName}</Text>
                            <View style={styles.actions}>
                                {a.fileUrl ? <Button size="sm" variant="ghost" label="Open file" onPress={() => void Linking.openURL(a.fileUrl as string)} /> : null}
                                <Button size="sm" label="Submit" onPress={() => setSubmitting(a.id)} />
                            </View>
                        </Card>
                    ),
                )
            )}

            <SectionLabel>Performance overview</SectionLabel>
            <Card>
                {trends.length === 0 ? (
                    <EmptyState title="No results yet" />
                ) : (
                    trends.map((t) => (
                        <View key={t.termId} style={styles.trendRow}>
                            <Text style={styles.trendLabel} numberOfLines={1}>{`${t.termName} ${t.yearName}`.trim()}</Text>
                            <View style={{ flex: 1 }}>
                                <ProgressBar value={t.overallAverage} color={scoreColor(t.overallAverage)} />
                            </View>
                            <Text style={styles.trendValue}>{formatPercent(t.overallAverage, 1)}</Text>
                        </View>
                    ))
                )}
            </Card>

            <SectionLabel>Learning materials & notes</SectionLabel>
            <ListCard>
                {(data?.materials ?? []).length === 0 ? (
                    <EmptyState title="No materials yet" description="Notes shared by teachers will appear here." />
                ) : (
                    (data?.materials ?? []).map((m) => (
                        <ListRow key={m.id} title={m.title} subtitle={m.subjectName} onPress={m.fileUrl ? () => void Linking.openURL(m.fileUrl as string) : undefined} />
                    ))
                )}
            </ListCard>

            <SectionLabel>Study goals</SectionLabel>
            <StudyGoals />
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
    heroGreeting: { color: colors.white, fontSize: 20, fontWeight: '800' },
    heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
    heroPill: { alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.18)', color: colors.white, fontWeight: '700', fontSize: 12, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md, overflow: 'hidden' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.foreground },
    muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    trendLabel: { width: 110, fontSize: 12, fontWeight: '600', color: colors.foreground },
    trendValue: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.foreground },
});
