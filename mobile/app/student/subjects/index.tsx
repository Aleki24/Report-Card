import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApiQuery } from '@/lib/useApiQuery';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { Subject } from '@/lib/types';

function typeBadge(type: Subject['subject_type']) {
    if (type === 'CORE') return <Badge label="Core" variant="success" />;
    if (type === 'ESSENTIAL') return <Badge label="Essential" variant="info" />;
    return <Badge label="Optional" variant="default" />;
}

export default function SubjectsScreen() {
    const router = useRouter();
    const { data, loading, error, refresh, refreshing } = useApiQuery<Subject[]>('/api/school/student/subjects');
    const subjects = data ?? [];

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="My Subjects" description="Tap a subject to see performance and materials." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {loading ? (
                <LoadingView />
            ) : subjects.length === 0 ? (
                <EmptyState title="No subjects found" description="Subjects assigned to your level will appear here." />
            ) : (
                <View style={styles.grid}>
                    {subjects.map((s) => (
                        <Pressable key={s.id} onPress={() => router.push(`/student/subjects/${s.id}`)} style={styles.cardWrap}>
                            <Card>
                                <Text style={styles.subjectName}>{s.name}</Text>
                                <Text style={styles.subjectCode}>{s.code ?? 'No code'}</Text>
                                <View style={styles.badgeRow}>
                                    {typeBadge(s.subject_type)}
                                    {s.enrollment_role === 'ELECTIVE' ? <Badge label="My Elective" variant="info" /> : null}
                                </View>
                            </Card>
                        </Pressable>
                    ))}
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    grid: { gap: spacing.md },
    cardWrap: {},
    subjectName: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    subjectCode: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
    badgeRow: { flexDirection: 'row', gap: spacing.xs },
});
