import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/UserContext';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, StatTile } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { AdminStats, ClassTeacherStats, StaffDashboardSummary, SubjectTeacherStats } from '@/lib/types';

function getGreeting(hour: number): string {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function formatCurrency(amount: number): string {
    return `KShs ${amount.toLocaleString()}`;
}

export default function StaffDashboardScreen() {
    const { user } = useUser();
    const { role } = useCurrentUser();
    const api = useApi();

    const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);
    const [roleStats, setRoleStats] = useState<AdminStats | ClassTeacherStats | SubjectTeacherStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const statsParam = role === 'ADMIN' ? 'admin' : role === 'CLASS_TEACHER' ? 'class_teacher' : 'subject_teacher';

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (opts?.silent) setRefreshing(true); else setLoading(true);
        try {
            const [dashRes, statsRes] = await Promise.all([
                api.get<StaffDashboardSummary>('/api/school/dashboard'),
                api.get<AdminStats | ClassTeacherStats | SubjectTeacherStats>(`/api/school/stats?role=${statsParam}`),
            ]);
            setSummary(dashRes);
            setRoleStats(statsRes);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Some data could not be loaded.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statsParam]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statsParam]);

    if (loading) return <LoadingView />;

    const now = new Date();
    const greeting = getGreeting(now.getHours());

    return (
        <Screen onRefresh={() => load({ silent: true })} refreshing={refreshing}>
            <View style={styles.hero}>
                <Text style={styles.heroGreeting}>
                    {greeting}, {user?.firstName ?? ''}
                </Text>
                <Text style={styles.heroDate}>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            </View>

            {error ? <ErrorBanner message={error} onRetry={() => load({ silent: true })} /> : null}

            {role === 'ADMIN' && roleStats ? <AdminStatsGrid stats={roleStats as AdminStats} /> : null}
            {role === 'CLASS_TEACHER' && roleStats ? <ClassTeacherStatsGrid stats={roleStats as ClassTeacherStats} /> : null}
            {role === 'SUBJECT_TEACHER' && roleStats ? <SubjectTeacherStatsGrid stats={roleStats as SubjectTeacherStats} /> : null}

            {summary ? (
                <>
                    <Text style={styles.sectionLabel}>Today</Text>
                    <View style={styles.statGrid}>
                        <StatTile label="Present today" value={summary.attendanceToday?.present ?? '—'} />
                        <StatTile label="Absent today" value={summary.attendanceToday?.absent ?? '—'} />
                        <StatTile label="Overdue fees" value={summary.overdueFeesCount} />
                        <StatTile label="Announcements (7d)" value={summary.announcementsLast7Days} />
                    </View>

                    <Text style={styles.sectionLabel}>Upcoming exams</Text>
                    <Card style={styles.listCard}>
                        {summary.upcomingExams.length === 0 ? (
                            <EmptyState title="No upcoming exams" />
                        ) : (
                            summary.upcomingExams.slice(0, 5).map((exam) => (
                                <View key={exam.id} style={styles.listRow}>
                                    <View style={styles.dateBadge}>
                                        <Text style={styles.dateBadgeMonth}>
                                            {new Date(exam.exam_date).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                                        </Text>
                                        <Text style={styles.dateBadgeDay}>{new Date(exam.exam_date).toLocaleDateString('en-GB', { day: '2-digit' })}</Text>
                                    </View>
                                    <View style={styles.listRowText}>
                                        <Text style={styles.listRowTitle}>{exam.subject_name}</Text>
                                        <Text style={styles.listRowSub}>
                                            {exam.name} · {exam.grade_name}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </Card>

                    <Text style={styles.sectionLabel}>Recent activity</Text>
                    <Card style={styles.listCard}>
                        {summary.recentActivities.length === 0 ? (
                            <EmptyState title="No recent activity" />
                        ) : (
                            summary.recentActivities.slice(0, 8).map((a, i) => (
                                <View key={i} style={styles.listRow}>
                                    <View style={styles.listRowText}>
                                        <Text style={styles.listRowTitle}>{a.message}</Text>
                                        <Text style={styles.listRowSub}>{new Date(a.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </Card>
                </>
            ) : null}
        </Screen>
    );
}

function AdminStatsGrid({ stats }: { stats: AdminStats }) {
    return (
        <>
            <Text style={styles.sectionLabel}>School overview</Text>
            <View style={styles.statGrid}>
                <StatTile label="Students" value={stats.totalStudents} sub={`${stats.activeStudents} active`} />
                <StatTile label="Teachers" value={stats.totalTeachers} sub={`${stats.classTeachers} class · ${stats.subjectTeachers} subject`} />
                <StatTile label="Classes" value={stats.totalClasses} />
                <StatTile label="School average" value={stats.schoolAverage != null ? `${stats.schoolAverage}%` : '—'} />
                <StatTile label="Pass rate" value={stats.passRate != null ? `${stats.passRate}%` : '—'} />
                <StatTile label="Reports generated" value={stats.totalReports} />
            </View>
        </>
    );
}

function ClassTeacherStatsGrid({ stats }: { stats: ClassTeacherStats }) {
    return (
        <>
            <Text style={styles.sectionLabel}>{stats.streamName || 'Your class'}</Text>
            <View style={styles.statGrid}>
                <StatTile label="Students" value={stats.studentCount} />
                <StatTile label="Class average" value={`${stats.streamAvg}%`} />
                <StatTile label="Reports pending" value={stats.reportsPending} />
            </View>
        </>
    );
}

function SubjectTeacherStatsGrid({ stats }: { stats: SubjectTeacherStats }) {
    return (
        <>
            <Text style={styles.sectionLabel}>Your subjects</Text>
            <View style={styles.statGrid}>
                <StatTile label="Exams set" value={stats.examCount} />
                <StatTile label="Marks entered" value={stats.markCount} />
                <StatTile label="Average score" value={`${stats.avg}%`} />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
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
    listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    listRowText: { flex: 1, minWidth: 0 },
    listRowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    listRowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    dateBadge: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    dateBadgeMonth: { fontSize: 9, fontWeight: '700', color: colors.muted },
    dateBadgeDay: { fontSize: 15, fontWeight: '800', color: colors.foreground },
});
