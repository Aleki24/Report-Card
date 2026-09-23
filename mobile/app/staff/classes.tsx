import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useAcademicStructure } from '@/lib/useSchoolData';
import { errorMessage, pluralize } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SectionLabel, StatGrid, StatTile, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { GradeStream, StudentListItem } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

export default function ClassesScreen() {
    return (
        <RequireScreen screen="classes">
            <ClassesContent />
        </RequireScreen>
    );
}

function ClassesContent() {
    const api = useApi();
    const router = useRouter();
    const structure = useAcademicStructure();
    const students = useApiQuery<StudentListItem[]>('/api/school/data?type=students');
    const [adding, setAdding] = useState(false);
    const [gradeId, setGradeId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [fullNameInput, setFullNameInput] = useState('');
    const [editing, setEditing] = useState<{ id: string; name: string; full_name: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const grades = structure.data?.grades ?? [];
    const levels = structure.data?.academic_levels ?? [];
    const streams = structure.data?.grade_streams ?? [];
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        for (const s of students.data ?? []) if (s.current_grade_stream_id && s.status === 'ACTIVE') map.set(s.current_grade_stream_id, (map.get(s.current_grade_stream_id) ?? 0) + 1);
        return map;
    }, [students.data]);

    const run = async (work: () => Promise<unknown>, done: string) => {
        setBusy(true);
        setMessage(null);
        try {
            await work();
            setMessage({ tone: 'success', text: done });
            structure.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
        } finally {
            setBusy(false);
        }
    };

    const add = () => {
        const grade = grades.find((g) => g.id === gradeId);
        if (!grade) return setMessage({ tone: 'danger', text: 'Choose a grade.' });
        // Same naming as the web: a blank stream name means the class is just the grade.
        const finalName = name.trim() || grade.name_display;
        const finalFull = fullNameInput.trim() || (name.trim() ? `${grade.name_display} ${finalName}` : finalName);
        void run(async () => {
            await api.post('/api/admin/academic-structure', { type: 'stream', grade_id: grade.id, name: finalName, full_name: finalFull });
            setAdding(false);
            setName('');
            setFullNameInput('');
        }, `Added ${finalFull}.`);
    };

    const rename = () => {
        if (!editing) return;
        void run(async () => {
            await api.patch('/api/admin/academic-structure', { type: 'stream', id: editing.id, name: editing.name.trim(), full_name: editing.full_name.trim() });
            setEditing(null);
        }, 'Class renamed.');
    };

    const remove = (s: GradeStream) =>
        confirmAlert(`Delete ${s.full_name}?`, 'Only empty classes can be deleted safely. Move learners out first.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void run(() => api.del(withQuery('/api/admin/academic-structure', { type: 'stream', id: s.id })), `${s.full_name} deleted.`) },
        ]);

    if (structure.loading) return <LoadingView />;

    return (
        <Screen onRefresh={structure.refresh} refreshing={structure.refreshing}>
            <ScreenHeader title="Classes" description="Every class (grade and stream) your school runs." />
            {structure.error ? <ErrorBanner message={structure.error} onRetry={structure.reload} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            <StatGrid>
                <StatTile label="Classes" value={streams.length} />
                <StatTile label="Active learners" value={[...counts.values()].reduce((a, b) => a + b, 0)} />
            </StatGrid>

            {adding ? (
                <Card style={{ marginVertical: spacing.md }}>
                    <ChipSelect label="Grade" wrap options={grades.map((g) => ({ value: g.id, label: g.name_display }))} value={gradeId} onChange={setGradeId} />
                    <TextField label="Stream name (optional)" value={name} onChangeText={setName} placeholder="e.g. East — leave blank to use the grade" />
                    <TextField label="Display name (optional)" value={fullNameInput} onChangeText={setFullNameInput} placeholder="e.g. Form 2 East" />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Add class" onPress={add} loading={busy} />
                    </ButtonRow>
                </Card>
            ) : (
                <ButtonRow>
                    <Button label="+ Add class" onPress={() => setAdding(true)} />
                </ButtonRow>
            )}

            {streams.length === 0 ? <EmptyState title="No classes yet" description="Add your first class above." /> : null}
            {levels.map((level) => {
                const levelGrades = grades.filter((g) => g.academic_level_id === level.id);
                const levelStreams = streams.filter((s) => levelGrades.some((g) => g.id === s.grade_id));
                if (levelStreams.length === 0) return null;
                return (
                    <View key={level.id}>
                        <SectionLabel>{level.name}</SectionLabel>
                        <ListCard>
                            {levelGrades.flatMap((g) =>
                                levelStreams
                                    .filter((s) => s.grade_id === g.id)
                                    .map((s) =>
                                        editing?.id === s.id ? (
                                            <View key={s.id} style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
                                                <TextField label="Stream name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} />
                                                <TextField label="Display name" value={editing.full_name} onChangeText={(v) => setEditing({ ...editing, full_name: v })} />
                                                <ButtonRow>
                                                    <Button size="sm" variant="danger" label="Delete" onPress={() => remove(s)} />
                                                    <Button size="sm" variant="secondary" label="Cancel" onPress={() => setEditing(null)} />
                                                    <Button size="sm" label="Save" onPress={rename} loading={busy} />
                                                </ButtonRow>
                                            </View>
                                        ) : (
                                            <ListRow
                                                key={s.id}
                                                title={s.full_name}
                                                subtitle={`${g.name_display} · ${pluralize(counts.get(s.id) ?? 0, 'learner')}`}
                                                right={
                                                    <View style={{ flexDirection: 'row', gap: 4 }}>
                                                        <Button size="sm" variant="ghost" label="Roster" onPress={() => router.push('/staff/people')} />
                                                        <Button size="sm" variant="ghost" label="Edit" onPress={() => setEditing({ id: s.id, name: s.name, full_name: s.full_name })} />
                                                    </View>
                                                }
                                            />
                                        ),
                                    ),
                            )}
                        </ListCard>
                    </View>
                );
            })}
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: spacing.md }}>Class teachers are set per person under Users.</Text>
        </Screen>
    );
}
