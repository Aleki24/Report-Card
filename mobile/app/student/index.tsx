import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, StatTile } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { Announcement, Assignment, DashboardData, FeeRecord, UpcomingExam } from '@/lib/types';

function getGreeting(hour: number): string {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function getDueLabel(dateStr: string): string {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
}

export default function DashboardScreen() {
    const { user } = useUser();
    const api = useApi();

    const [data, setData] = useState<Partial<DashboardData> | null>(null);
    const [feesData, setFeesData] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (opts?.silent) setRefreshing(true); else setLoading(true);
        try {
            const [dashRes, feesRes] = await Promise.all([
                api.get<{ data: DashboardData }>('/api/school/student/dashboard'),
                api.get<{ data: FeeRecord[] }>('/api/school/fees').catch(() => ({ data: [] })),
            ]);
            setData(dashRes.data);
            setFeesData(feesRes.data ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Some of your data could not be loaded.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <LoadingView />;

    const stats = data?.stats;
    const upcomingExams: UpcomingExam[] = data?.upcomingExams ?? [];
    const announcements: Announcement[] = data?.announcements ?? [];
    const assignments: Assignment[] = data?.assignments ?? [];
    const feesBalance = feesData.reduce((sum, f) => sum + (f.balance || 0), 0);

    const now = new Date();
    const greeting = getGreeting(now.getHours());
    const todayLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <Screen onRefresh={() => load({ silent: true })} refreshing={refreshing}>
            <View style={styles.hero}>
                <Text style={styles.heroGreeting}>
                    {greeting}, {user?.firstName ?? ''}
                </Text>
                <Text style={styles.heroDate}>{todayLabel}</Text>
            </View>

            {error ? <ErrorBanner message={error} onRetry={() => load({ silent: true })} /> : null}

            <Text style={styles.sectionLabel}>At a glance</Text>
            <View style={styles.statGrid}>
                <StatTile label="Attendance" value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—'} />
                <StatTile label="Average score" value={stats?.averageScore != null ? `${stats.averageScore}%` : '—'} />
                <StatTile label="Exams taken" value={stats?.examsTaken ?? 0} />
                <StatTile label="Subjects" value={stats?.subjectsCount ?? 0} />
                <StatTile
                    label="Fees balance"
                    value={feesData.length > 0 ? `KShs ${feesBalance.toLocaleString()}` : '—'}
                    sub={feesBalance > 0 ? 'Outstanding' : undefined}
                />
            </View>

            <Text style={styles.sectionLabel}>Upcoming exams</Text>
            <Card style={styles.listCard}>
                {upcomingExams.length === 0 ? (
                    <EmptyState title="No upcoming exams" description="Scheduled exams will appear here." />
                ) : (
                    upcomingExams.slice(0, 5).map((exam) => (
                        <View key={exam.id} style={styles.listRow}>
                            <View style={styles.dateBadge}>
                                <Text style={styles.dateBadgeMonth}>
                                    {new Date(exam.exam_date).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                                </Text>
                                <Text style={styles.dateBadgeDay}>{new Date(exam.exam_date).toLocaleDateString('en-GB', { day: '2-digit' })}</Text>
                            </View>
                            <View style={styles.listRowText}>
                                <Text style={styles.listRowTitle}>{exam.subject_name}</Text>
                                <Text style={styles.listRowSub}>{exam.name}</Text>
                            </View>
                        </View>
                    ))
                )}
            </Card>

            <Text style={styles.sectionLabel}>Announcements</Text>
            <Card style={styles.listCard}>
                {announcements.length === 0 ? (
                    <EmptyState title="No announcements" description="School announcements will show up here." />
                ) : (
                    announcements.slice(0, 5).map((a) => (
                        <View key={a.id} style={styles.listRow}>
                            <View style={styles.listRowText}>
                                <Text style={styles.listRowTitle}>{a.title}</Text>
                                <Text style={styles.listRowSub} numberOfLines={2}>
                                    {a.content}
                                </Text>
                            </View>
                            {a.isImportant ? <View style={styles.importantDot} /> : null}
                        </View>
                    ))
                )}
            </Card>

            <Text style={styles.sectionLabel}>Assignments</Text>
            <Card style={styles.listCard}>
                {assignments.length === 0 ? (
                    <EmptyState title="No assignments due" description="New homework will appear here." />
                ) : (
                    assignments.map((a) => (
                        <View key={a.id} style={styles.listRow}>
                            <View style={styles.listRowText}>
                                <Text style={styles.listRowTitle}>{a.title}</Text>
                                <Text style={styles.listRowSub}>{a.subjectName}</Text>
                                <Text style={styles.listRowDue}>{getDueLabel(a.dueDate)}</Text>
                            </View>
                        </View>
                    ))
                )}
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: {
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    heroGreeting: { color: colors.white, fontSize: 20, fontWeight: '800' },
    heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    listCard: { padding: 0, overflow: 'hidden' },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    listRowText: { flex: 1, minWidth: 0 },
    listRowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    listRowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    listRowDue: { fontSize: 11, fontWeight: '700', color: colors.danger, marginTop: 4 },
    dateBadge: {
        width: 44,
        height: 44,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateBadgeMonth: { fontSize: 9, fontWeight: '700', color: colors.muted },
    dateBadgeDay: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    importantDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});
