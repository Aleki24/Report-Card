import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { Badge, Card, EmptyState, LoadingView, Screen } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { Assignment, DashboardData, LearningMaterial, PerformanceTrend, Subject } from '@/lib/types';

function typeBadge(type: Subject['subject_type']) {
    if (type === 'CORE') return <Badge label="Core" variant="success" />;
    if (type === 'ESSENTIAL') return <Badge label="Essential" variant="info" />;
    return <Badge label="Optional" variant="default" />;
}

export default function SubjectDetailScreen() {
    const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
    const router = useRouter();
    const api = useApi();

    const [subject, setSubject] = useState<Subject | null>(null);
    const [trend, setTrend] = useState<{ label: string; average: number }[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [materials, setMaterials] = useState<LearningMaterial[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get<{ data: Subject[] }>('/api/school/student/subjects'),
            api.get<{ data: PerformanceTrend[] }>('/api/school/student/performance'),
            api.get<{ data: DashboardData }>('/api/school/student/dashboard'),
        ])
            .then(([subRes, perfRes, dashRes]) => {
                const found = (subRes.data ?? []).find((s) => s.id === subjectId) ?? null;
                setSubject(found);
                if (found) {
                    const trendData = (perfRes.data ?? [])
                        .map((term) => {
                            const mark = term.subjects?.find((s) => s.name === found.name);
                            return mark ? { label: `${term.termName} ${term.yearName}`.trim(), average: mark.average } : null;
                        })
                        .filter((t): t is { label: string; average: number } => t !== null);
                    setTrend(trendData);

                    const allAssignments = dashRes.data?.assignments ?? [];
                    const allMaterials = dashRes.data?.materials ?? [];
                    setAssignments(allAssignments.filter((a) => a.subjectName === found.name));
                    setMaterials(allMaterials.filter((m) => m.subjectName === found.name));
                }
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectId]);

    if (loading) return <LoadingView />;

    if (!subject) {
        return (
            <Screen>
                <EmptyState title="Subject not found" description="This subject doesn't exist or you don't have access to it." />
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go back</Text>
                </Pressable>
            </Screen>
        );
    }

    return (
        <Screen>
            <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
                <Text style={styles.backLink}>← Back</Text>
            </Pressable>

            <Text style={styles.title}>{subject.name}</Text>
            <View style={styles.badgeRow}>
                {typeBadge(subject.subject_type)}
                {subject.code ? <Badge label={subject.code} variant="default" /> : null}
            </View>

            <Text style={styles.sectionLabel}>Performance trend</Text>
            <Card style={{ marginBottom: spacing.lg }}>
                {trend.length === 0 ? (
                    <EmptyState title="No performance data yet" />
                ) : (
                    trend.map((t, i) => (
                        <View key={i} style={styles.trendRow}>
                            <Text style={styles.trendLabel}>{t.label}</Text>
                            <Text style={[styles.trendValue, { color: t.average >= 50 ? colors.success : colors.danger }]}>{t.average}%</Text>
                        </View>
                    ))
                )}
            </Card>

            <Text style={styles.sectionLabel}>Assignments</Text>
            <Card style={{ marginBottom: spacing.lg }}>
                {assignments.length === 0 ? (
                    <EmptyState title="No assignments for this subject" />
                ) : (
                    assignments.map((a) => (
                        <View key={a.id} style={styles.trendRow}>
                            <Text style={styles.trendLabel}>{a.title}</Text>
                        </View>
                    ))
                )}
            </Card>

            <Text style={styles.sectionLabel}>Materials</Text>
            <Card>
                {materials.length === 0 ? (
                    <EmptyState title="No materials for this subject" />
                ) : (
                    materials.map((m) => (
                        <View key={m.id} style={styles.trendRow}>
                            <Text style={styles.trendLabel}>{m.title}</Text>
                        </View>
                    ))
                )}
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 22, fontWeight: '800', color: colors.foreground, marginBottom: spacing.sm },
    badgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: spacing.sm,
    },
    trendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    trendLabel: { fontSize: 13, color: colors.foreground, fontWeight: '600', flex: 1 },
    trendValue: { fontSize: 13, fontWeight: '800' },
    backButton: { marginTop: spacing.lg, alignSelf: 'center' },
    backButtonText: { color: colors.primary, fontWeight: '700' },
    backLink: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
