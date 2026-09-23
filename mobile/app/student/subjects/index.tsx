import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApiQuery } from '@/lib/useApiQuery';
import { Badge, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { SubjectTypeBadge } from '@/components/student/SubjectTypeBadge';
import { colors, spacing } from '@/lib/theme';
import type { Subject } from '@/lib/types';

type Filter = 'ALL' | 'CORE' | 'ELECTIVE';

export default function SubjectsScreen() {
    const router = useRouter();
    const { data, loading, error, refresh, refreshing } = useApiQuery<Subject[]>('/api/school/student/subjects');
    const [filter, setFilter] = useState<Filter>('ALL');
    const subjects = (data ?? []).filter((s) => filter === 'ALL' || (filter === 'ELECTIVE' ? s.enrollment_role === 'ELECTIVE' : s.enrollment_role !== 'ELECTIVE'));

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="My Subjects" description="Tap a subject to see your performance, assignments and materials." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {(data ?? []).some((s) => s.enrollment_role === 'ELECTIVE') ? (
                <ChipSelect
                    options={[
                        { value: 'ALL', label: 'All' },
                        { value: 'CORE', label: 'Core' },
                        { value: 'ELECTIVE', label: 'My electives' },
                    ]}
                    value={filter}
                    onChange={setFilter}
                />
            ) : null}
            {loading ? (
                <LoadingView />
            ) : subjects.length === 0 ? (
                <EmptyState title="No subjects found" description="Subjects assigned to your class will appear here." />
            ) : (
                <>
                    <Text style={styles.count}>{subjects.length} subjects</Text>
                    <ListCard>
                        {subjects.map((s) => (
                            <ListRow
                                key={s.id}
                                title={s.name}
                                subtitle={s.code ?? 'No code'}
                                right={
                                    <View style={styles.badges}>
                                        <SubjectTypeBadge type={s.subject_type} />
                                        {s.enrollment_role === 'ELECTIVE' ? <Badge label="Elective" variant="info" /> : null}
                                    </View>
                                }
                                onPress={() => router.push(`/student/subjects/${s.id}`)}
                            />
                        ))}
                    </ListCard>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    count: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
    badges: { alignItems: 'flex-end', gap: 4 },
});
