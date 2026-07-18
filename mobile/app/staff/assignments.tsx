import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { StaffAssignment, Subject } from '@/lib/types';

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

export default function AssignmentsScreen() {
    const api = useApi();
    const { data, loading, error, refresh, refreshing } = useApiQuery<StaffAssignment[]>('/api/school/assignments');
    const assignments = data ?? [];

    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [composing, setComposing] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subjectId, setSubjectId] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);

    useEffect(() => {
        api
            .get<{ data: Subject[] }>('/api/school/data?type=subjects')
            .then((res) => setSubjects(res.data ?? []))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePost = async () => {
        if (!title.trim() || !subjectId) return;
        setPosting(true);
        setPostError(null);
        try {
            await api.post('/api/school/assignments', { title: title.trim(), subject_id: subjectId, due_date: dueDate, description: description.trim() || undefined });
            setTitle('');
            setDescription('');
            setComposing(false);
            refresh();
        } catch (err) {
            setPostError(err instanceof Error ? err.message : 'Failed to create assignment');
        } finally {
            setPosting(false);
        }
    };

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Assignments" description="Homework and coursework for your classes." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            {composing ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    {postError ? <ErrorBanner message={postError} /> : null}
                    <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} />
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Description (optional)"
                        placeholderTextColor={colors.muted}
                        multiline
                        numberOfLines={3}
                        style={[styles.input, styles.textArea]}
                    />
                    <Text style={styles.label}>Subject</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                        {subjects.map((s) => (
                            <Pressable key={s.id} onPress={() => setSubjectId(s.id)} style={[styles.chip, subjectId === s.id && styles.chipActive]}>
                                <Text style={[styles.chipText, subjectId === s.id && styles.chipTextActive]}>{s.name}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                    <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                    <TextInput value={dueDate} onChangeText={setDueDate} placeholder="2026-08-01" placeholderTextColor={colors.muted} style={styles.input} />
                    <View style={styles.composeActions}>
                        <Pressable onPress={() => setComposing(false)} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handlePost} disabled={posting || !title.trim() || !subjectId} style={styles.primaryButton}>
                            <Text style={styles.primaryButtonText}>{posting ? 'Creating…' : 'Create'}</Text>
                        </Pressable>
                    </View>
                </Card>
            ) : (
                <Pressable onPress={() => setComposing(true)} style={styles.newButton}>
                    <Text style={styles.newButtonText}>+ New Assignment</Text>
                </Pressable>
            )}

            {loading ? (
                <LoadingView />
            ) : assignments.length === 0 ? (
                <EmptyState title="No assignments yet" />
            ) : (
                <Card style={styles.listCard}>
                    {assignments.map((a) => (
                        <View key={a.id} style={styles.row}>
                            <Text style={styles.rowTitle}>{a.title}</Text>
                            <Text style={styles.rowSub}>
                                {a.subject} · {a.stream || 'All classes'}
                            </Text>
                            <Text style={styles.rowDue}>{getDueLabel(a.dueDate)}</Text>
                        </View>
                    ))}
                </Card>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    newButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg, backgroundColor: colors.card },
    newButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 14, color: colors.foreground, marginBottom: spacing.sm },
    textArea: { minHeight: 70, textAlignVertical: 'top' },
    label: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    chipTextActive: { color: colors.white },
    composeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
    primaryButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.lg },
    primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
    secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.lg },
    secondaryButtonText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    rowDue: { fontSize: 11, fontWeight: '700', color: colors.danger, marginTop: 4 },
});
