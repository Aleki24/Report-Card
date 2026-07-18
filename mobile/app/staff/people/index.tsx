import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { StudentListItem, TeacherListItem } from '@/lib/types';

export default function PeopleScreen() {
    const { role } = useCurrentUser();
    const [tab, setTab] = useState<'students' | 'teachers'>('students');

    return (
        <Screen>
            <ScreenHeader title="People" description="Students and teachers at your school." />
            <View style={styles.tabBar}>
                <Pressable onPress={() => setTab('students')} style={[styles.tabButton, tab === 'students' && styles.tabButtonActive]}>
                    <Text style={[styles.tabButtonText, tab === 'students' && styles.tabButtonTextActive]}>Students</Text>
                </Pressable>
                {role === 'ADMIN' ? (
                    <Pressable onPress={() => setTab('teachers')} style={[styles.tabButton, tab === 'teachers' && styles.tabButtonActive]}>
                        <Text style={[styles.tabButtonText, tab === 'teachers' && styles.tabButtonTextActive]}>Teachers</Text>
                    </Pressable>
                ) : null}
            </View>
            {tab === 'students' ? <StudentsList /> : <TeachersList />}
        </Screen>
    );
}

function StudentsList() {
    const router = useRouter();
    const { data, loading, error, refresh, refreshing } = useApiQuery<StudentListItem[]>('/api/school/data?type=students');
    const students = data ?? [];

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={refresh} />;
    if (students.length === 0) return <EmptyState title="No students found" description="Students visible to your role will appear here." />;

    return (
        <Card style={styles.listCard}>
            {students.map((s) => (
                <Pressable key={s.id} onPress={() => router.push(`/staff/people/${s.id}?type=student`)} style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>
                            {s.users?.first_name} {s.users?.last_name}
                        </Text>
                        <Text style={styles.rowSub}>
                            {s.admission_number ?? '—'} · {s.grade_streams?.full_name ?? 'Unassigned'}
                        </Text>
                    </View>
                </Pressable>
            ))}
        </Card>
    );
}

function TeachersList() {
    const router = useRouter();
    const { data, loading, error, refresh, refreshing } = useApiQuery<TeacherListItem[]>('/api/school/data?type=teachers');
    const teachers = data ?? [];

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={refresh} />;
    if (teachers.length === 0) return <EmptyState title="No teachers found" />;

    return (
        <Card style={styles.listCard}>
            {teachers.map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/staff/people/${t.id}?type=teacher`)} style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>
                            {t.profile.first_name} {t.profile.last_name}
                        </Text>
                        <Text style={styles.rowSub}>
                            {t.profile.role === 'CLASS_TEACHER' ? 'Class Teacher' : t.profile.role === 'SUBJECT_TEACHER' ? 'Subject Teacher' : 'Admin'}
                            {t.subjects ? ` · ${t.subjects}` : ''}
                        </Text>
                    </View>
                </Pressable>
            ))}
        </Card>
    );
}

const styles = StyleSheet.create({
    tabBar: { flexDirection: 'row', marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabButtonActive: { borderBottomColor: colors.primary },
    tabButtonText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    tabButtonTextActive: { color: colors.primary },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
