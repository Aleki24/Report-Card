import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader, StatTile } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { AnalyticsMark } from '@/lib/types';

export default function AnalyticsScreen() {
    const api = useApi();
    const [marks, setMarks] = useState<AnalyticsMark[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (opts?.silent) setRefreshing(true); else setLoading(true);
        try {
            const res = await api.get<{ marks: AnalyticsMark[] }>('/api/school/analytics');
            setMarks(res.marks ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
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

    const bySubject = useMemo(() => {
        const map = new Map<string, { name: string; total: number; count: number }>();
        for (const m of marks) {
            const entry = map.get(m.subject_id) ?? { name: m.subject_name, total: 0, count: 0 };
            entry.total += m.percentage;
            entry.count += 1;
            map.set(m.subject_id, entry);
        }
        return Array.from(map.values())
            .map((s) => ({ name: s.name, average: Math.round((s.total / s.count) * 10) / 10, count: s.count }))
            .sort((a, b) => b.average - a.average);
    }, [marks]);

    const overallAverage = marks.length > 0 ? Math.round((marks.reduce((sum, m) => sum + m.percentage, 0) / marks.length) * 10) / 10 : null;
    const passRate = marks.length > 0 ? Math.round((marks.filter((m) => m.percentage >= 50).length / marks.length) * 1000) / 10 : null;

    if (loading) return <LoadingView />;

    return (
        <Screen onRefresh={() => load({ silent: true })} refreshing={refreshing}>
            <ScreenHeader title="Analytics" description="School-wide performance across all recorded marks." />
            {error ? <ErrorBanner message={error} onRetry={() => load({ silent: true })} /> : null}

            <View style={styles.statGrid}>
                <StatTile label="Overall average" value={overallAverage != null ? `${overallAverage}%` : '—'} />
                <StatTile label="Pass rate" value={passRate != null ? `${passRate}%` : '—'} />
                <StatTile label="Marks recorded" value={marks.length} />
            </View>

            <Text style={styles.sectionLabel}>By subject</Text>
            {bySubject.length === 0 ? (
                <EmptyState title="No marks recorded yet" />
            ) : (
                <Card style={styles.listCard}>
                    {bySubject.map((s) => (
                        <View key={s.name} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowTitle}>{s.name}</Text>
                                <Text style={styles.rowSub}>{s.count} marks</Text>
                            </View>
                            <Text style={[styles.rowAvg, { color: s.average >= 50 ? colors.success : colors.danger }]}>{s.average}%</Text>
                        </View>
                    ))}
                </Card>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: spacing.sm,
    },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    rowAvg: { fontSize: 15, fontWeight: '800' },
});
