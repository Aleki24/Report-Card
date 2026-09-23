import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { daysUntil, errorMessage } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, TextField } from '@/components/ui';
import type { Subject } from '@/lib/types';

interface Goal {
    id: string;
    title: string;
    targetValue: number | null;
    deadline: string | null;
    completed: boolean;
    subjectName: string | null;
}

function deadlineLabel(deadline: string | null): { text: string; overdue: boolean } | null {
    if (!deadline) return null;
    const d = daysUntil(deadline);
    if (d < 0) return { text: 'Overdue', overdue: true };
    if (d === 0) return { text: 'Due today', overdue: false };
    return { text: `${d}d left`, overdue: false };
}

/** The web's Study Goals card: personal targets a student sets and ticks off. */
export function StudyGoals() {
    const api = useApi();
    const { data, error, refresh } = useApiQuery<Goal[]>('/api/school/student/goals');
    const subjects = useApiQuery<Subject[]>('/api/school/student/subjects');
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [subjectId, setSubjectId] = useState<string | null>(null);
    const [target, setTarget] = useState('');
    const [deadline, setDeadline] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const goals = data ?? [];
    const done = goals.filter((g) => g.completed).length;

    const add = async () => {
        if (!title.trim()) return setFormError('Give the goal a title.');
        setSaving(true);
        setFormError(null);
        try {
            await api.post('/api/school/student/goals', { title: title.trim(), subject_id: subjectId, target_value: target ? Number(target) : null, deadline: deadline.trim() || null });
            setTitle('');
            setTarget('');
            setDeadline('');
            setSubjectId(null);
            setAdding(false);
            refresh();
        } catch (err) {
            setFormError(errorMessage(err, 'Could not save the goal'));
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (g: Goal) => {
        await api.patch('/api/school/student/goals', { id: g.id, completed: !g.completed }).catch(() => undefined);
        refresh();
    };

    const remove = async (g: Goal) => {
        await api.del(`/api/school/student/goals?id=${g.id}`).catch(() => undefined);
        refresh();
    };

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {adding ? (
                <Card style={{ marginBottom: spacing.sm }}>
                    {formError ? <ErrorBanner message={formError} /> : null}
                    <TextField label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Score 70% in Maths" />
                    <ChipSelect label="Subject (optional)" options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))} value={subjectId} onChange={setSubjectId} />
                    <TextField label="Target % (optional)" value={target} onChangeText={setTarget} keyboardType="number-pad" />
                    <TextField label="Deadline (YYYY-MM-DD, optional)" value={deadline} onChangeText={setDeadline} />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Add goal" onPress={add} loading={saving} />
                    </ButtonRow>
                </Card>
            ) : null}
            <ListCard>
                {goals.length === 0 ? (
                    <EmptyState title="No goals yet" description="Set a target to work towards." />
                ) : (
                    goals.map((g) => {
                        const dl = deadlineLabel(g.deadline);
                        return (
                            <ListRow
                                key={g.id}
                                left={
                                    <Pressable onPress={() => void toggle(g)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: g.completed }}>
                                        <Text style={{ fontSize: 20, color: g.completed ? colors.success : colors.muted }}>{g.completed ? '☑' : '☐'}</Text>
                                    </Pressable>
                                }
                                title={g.title}
                                subtitle={[g.subjectName, g.targetValue != null ? `target ${g.targetValue}%` : null].filter(Boolean).join(' · ') || null}
                                right={
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        {dl && !g.completed ? <Badge label={dl.text} variant={dl.overdue ? 'danger' : 'info'} /> : null}
                                        <Text onPress={() => void remove(g)} style={{ fontSize: 12, color: colors.muted }}>Remove</Text>
                                    </View>
                                }
                            />
                        );
                    })
                )}
            </ListCard>
            <ButtonRow>
                {goals.length > 0 ? <Text style={{ fontSize: 12, color: colors.muted, flex: 1, alignSelf: 'center' }}>{done} of {goals.length} done</Text> : null}
                {!adding ? <Button size="sm" variant="secondary" label="+ Goal" onPress={() => setAdding(true)} /> : null}
            </ButtonRow>
        </View>
    );
}
