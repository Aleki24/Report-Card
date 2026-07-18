import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { StudentDetail, TeacherDetail } from '@/lib/types';

export default function PersonDetailScreen() {
    const { id, type } = useLocalSearchParams<{ id: string; type: 'student' | 'teacher' }>();
    const router = useRouter();
    const api = useApi();

    const [student, setStudent] = useState<StudentDetail | null>(null);
    const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const path = type === 'teacher' ? `/api/school/teachers/${id}` : `/api/school/students/${id}`;
        api
            .get<StudentDetail | TeacherDetail>(path)
            .then((res) => {
                if (type === 'teacher') setTeacher(res as TeacherDetail);
                else setStudent(res as StudentDetail);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, type]);

    if (loading) return <LoadingView />;

    return (
        <Screen>
            <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
                <Text style={styles.backLink}>← Back</Text>
            </Pressable>

            {error ? <ErrorBanner message={error} /> : null}

            {type === 'teacher' && teacher ? <TeacherView teacher={teacher} /> : null}
            {type !== 'teacher' && student ? <StudentView student={student} /> : null}
        </Screen>
    );
}

function StudentView({ student }: { student: StudentDetail }) {
    const p = student.profile;
    return (
        <>
            <Text style={styles.title}>
                {p.first_name} {p.last_name}
            </Text>
            <Text style={styles.subtitle}>
                {p.admission_number ?? '—'} · {p.grade_stream?.full_name ?? 'Unassigned'}
            </Text>

            <Card style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
                <InfoRow label="Status" value={p.status} />
                <InfoRow label="Email" value={p.email} />
                <InfoRow label="Guardian" value={p.guardian_name} />
                <InfoRow label="Guardian Phone" value={p.guardian_phone} />
            </Card>

            <Text style={styles.sectionLabel}>Report history</Text>
            <Card style={styles.listCard}>
                {student.reportHistory.length === 0 ? (
                    <EmptyState title="No reports yet" />
                ) : (
                    student.reportHistory.map((r) => (
                        <View key={r.id} style={styles.row}>
                            <Text style={styles.rowTitle}>
                                {r.term} — {r.year}
                            </Text>
                            <Badge label={r.average != null ? `${r.average}%` : '—'} variant={(r.average ?? 0) >= 50 ? 'success' : 'danger'} />
                        </View>
                    ))
                )}
            </Card>
        </>
    );
}

function TeacherView({ teacher }: { teacher: TeacherDetail }) {
    const p = teacher.profile;
    return (
        <>
            <Text style={styles.title}>
                {p.first_name} {p.last_name}
            </Text>
            <Text style={styles.subtitle}>{p.role === 'CLASS_TEACHER' ? 'Class Teacher' : p.role === 'SUBJECT_TEACHER' ? 'Subject Teacher' : 'Admin'}</Text>

            <Card style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
                <InfoRow label="Email" value={p.email} />
                <InfoRow label="Phone" value={p.phone} />
                <InfoRow label="Status" value={p.is_active ? 'Active' : 'Inactive'} />
            </Card>

            {teacher.classAssignments.length > 0 ? (
                <>
                    <Text style={styles.sectionLabel}>Classes</Text>
                    <Card style={{ marginBottom: spacing.lg }}>
                        {teacher.classAssignments.map((c) => (
                            <Text key={c.id} style={styles.rowTitle}>
                                {c.stream} ({c.year})
                            </Text>
                        ))}
                    </Card>
                </>
            ) : null}

            {teacher.subjectAssignments.length > 0 ? (
                <>
                    <Text style={styles.sectionLabel}>Subjects</Text>
                    <Card>
                        {teacher.subjectAssignments.map((s, i) => (
                            <Text key={i} style={styles.rowTitle}>
                                {s.subject} — {s.grade}
                            </Text>
                        ))}
                    </Card>
                </>
            ) : null}
        </>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    backLink: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    title: { fontSize: 22, fontWeight: '800', color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: spacing.sm,
    },
    listCard: { padding: 0, overflow: 'hidden' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, paddingVertical: 4 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    infoLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
    infoValue: { fontSize: 13, color: colors.foreground, fontWeight: '700' },
});
