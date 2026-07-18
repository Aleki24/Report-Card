import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader, StatTile } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';

const STATUS_META: Record<AttendanceStatus, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
    present: { label: 'Present', variant: 'success' },
    absent: { label: 'Absent', variant: 'danger' },
    late: { label: 'Late', variant: 'warning' },
    excused: { label: 'Excused', variant: 'info' },
};

export default function AttendanceScreen() {
    const { data, loading, error, refresh, refreshing } = useApiQuery<AttendanceRecord[]>('/api/school/student/attendance');
    const records = data ?? [];

    const stats = useMemo(() => {
        const total = records.length;
        const present = records.filter((r) => r.status === 'present').length;
        const absent = records.filter((r) => r.status === 'absent').length;
        const late = records.filter((r) => r.status === 'late').length;
        const excused = records.filter((r) => r.status === 'excused').length;
        const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
        return { total, present, absent, late, excused, rate };
    }, [records]);

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Attendance" description="Your daily attendance history." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <View style={styles.statGrid}>
                <StatTile label="Attendance Rate" value={`${stats.rate}%`} />
                <StatTile label="Present" value={stats.present} />
                <StatTile label="Absent" value={stats.absent} />
                <StatTile label="Late / Excused" value={`${stats.late} / ${stats.excused}`} />
            </View>

            {loading ? (
                <LoadingView />
            ) : records.length === 0 ? (
                <EmptyState title="No attendance records" description="Your attendance history will appear here." />
            ) : (
                <Card style={styles.listCard}>
                    {records.map((r) => (
                        <View key={r.id} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.date}>
                                    {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                                {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
                            </View>
                            <Badge label={STATUS_META[r.status]?.label ?? r.status} variant={STATUS_META[r.status]?.variant ?? 'success'} />
                        </View>
                    ))}
                </Card>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    listCard: { padding: 0, overflow: 'hidden' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    date: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    notes: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
