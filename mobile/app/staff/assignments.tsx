import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams } from '@/lib/useSchoolData';
import { errorMessage, formatDate, getDueLabel, pluralize, shiftISODate, toISODate } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SegmentedTabs, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { StaffAssignment, TeacherSubject } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

interface Draft {
    id: string | null;
    title: string;
    description: string;
    subjectId: string | null;
    streamId: string;
    dueDate: string;
    fileUrl: string | null;
}

interface Submission {
    id: string;
    fileUrl: string | null;
    submissionText: string | null;
    submittedAt: string;
    grade: number | null;
    feedback: string | null;
    assignmentTitle: string | null;
    subjectName: string | null;
    studentName: string | null;
    admissionNumber: string | null;
}

const ALL_CLASSES = '__all__';

const newDraft = (): Draft => ({ id: null, title: '', description: '', subjectId: null, streamId: ALL_CLASSES, dueDate: shiftISODate(toISODate(), 7), fileUrl: null });

export default function AssignmentsScreen() {
    return (
        <RequireScreen screen="assignments">
            <AssignmentsContent />
        </RequireScreen>
    );
}

function AssignmentsContent() {
    const [tab, setTab] = useState<'list' | 'submissions'>('list');
    return (
        <Screen>
            <ScreenHeader title="Assignments" description="Homework and coursework for your classes." />
            <SegmentedTabs
                tabs={[
                    { value: 'list', label: 'Assignments' },
                    { value: 'submissions', label: 'Submissions' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'list' ? <AssignmentList /> : <Submissions />}
        </Screen>
    );
}

function AssignmentList() {
    const api = useApi();
    const { data, loading, error, refresh } = useApiQuery<StaffAssignment[]>('/api/school/assignments');
    const subjects = useApiQuery<TeacherSubject[]>('/api/school/data?type=subjects');
    const { streams } = useGradeStreams();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const save = async () => {
        if (!draft || !draft.title.trim() || !draft.subjectId) return;
        setSaving(true);
        setMessage(null);
        const body = {
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            subject_id: draft.subjectId,
            grade_stream_id: draft.streamId === ALL_CLASSES ? null : draft.streamId,
            due_date: draft.dueDate,
            file_url: draft.fileUrl,
        };
        try {
            if (draft.id) await api.patch(`/api/school/assignments/${draft.id}`, body);
            else await api.post('/api/school/assignments', body);
            setMessage({ tone: 'success', text: draft.id ? 'Assignment updated.' : 'Assignment created.' });
            setDraft(null);
            refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to save assignment') });
        } finally {
            setSaving(false);
        }
    };

    const attach = async () => {
        if (!draft) return;
        setUploading(true);
        try {
            const url = await api.pickAndUploadImage();
            if (url) setDraft({ ...draft, fileUrl: url });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Upload failed') });
        } finally {
            setUploading(false);
        }
    };

    const remove = (a: StaffAssignment) =>
        confirmAlert('Delete this assignment?', a.title, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.del(`/api/school/assignments/${a.id}`);
                        refresh();
                    } catch (err) {
                        setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to delete') });
                    }
                },
            },
        ]);

    const assignments = data ?? [];

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            {draft ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    <TextField label="Title" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
                    <TextField label="Instructions (optional)" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} multiline />
                    <ChipSelect label="Subject" wrap options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))} value={draft.subjectId} onChange={(subjectId) => setDraft({ ...draft, subjectId })} />
                    <ChipSelect
                        label="Class"
                        options={[{ value: ALL_CLASSES, label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]}
                        value={draft.streamId}
                        onChange={(streamId) => setDraft({ ...draft, streamId })}
                    />
                    <TextField label="Due date (YYYY-MM-DD)" value={draft.dueDate} onChangeText={(dueDate) => setDraft({ ...draft, dueDate })} />
                    <ButtonRow>
                        {[1, 3, 7, 14].map((d) => (
                            <Button key={d} size="sm" variant="ghost" label={`+${d}d`} onPress={() => setDraft({ ...draft, dueDate: shiftISODate(toISODate(), d) })} />
                        ))}
                    </ButtonRow>
                    <ButtonRow>
                        {draft.fileUrl ? <Button size="sm" variant="ghost" label="Remove attachment" onPress={() => setDraft({ ...draft, fileUrl: null })} /> : null}
                        <Button size="sm" variant="secondary" label={draft.fileUrl ? 'Replace image' : 'Attach image'} onPress={attach} loading={uploading} />
                    </ButtonRow>
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setDraft(null)} />
                        <Button label={draft.id ? 'Update' : 'Create'} onPress={save} loading={saving} disabled={!draft.title.trim() || !draft.subjectId || uploading} />
                    </ButtonRow>
                </Card>
            ) : (
                <ButtonRow>
                    <Button label="+ New assignment" onPress={() => setDraft(newDraft())} />
                </ButtonRow>
            )}

            <View style={{ marginTop: spacing.md }}>
                {loading ? (
                    <LoadingView />
                ) : assignments.length === 0 ? (
                    <EmptyState title="No assignments yet" />
                ) : (
                    assignments.map((a) => {
                        const due = getDueLabel(a.dueDate);
                        return (
                            <Card key={a.id} style={{ marginBottom: spacing.sm }}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.title}>{a.title}</Text>
                                    <Badge label={due} variant={due === 'Overdue' ? 'danger' : due === 'Due today' || due === 'Due tomorrow' ? 'warning' : 'info'} />
                                </View>
                                <Text style={styles.sub}>
                                    {a.subject} · {a.stream ?? 'All classes'} · due {formatDate(a.dueDate)} · by {a.createdBy}
                                </Text>
                                {a.description ? <Text style={styles.body}>{a.description}</Text> : null}
                                <ButtonRow>
                                    {a.fileUrl ? <Button size="sm" variant="ghost" label="Open attachment" onPress={() => void Linking.openURL(a.fileUrl as string)} /> : null}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        label="Edit"
                                        onPress={() =>
                                            setDraft({ id: a.id, title: a.title, description: a.description ?? '', subjectId: a.subjectId, streamId: a.streamId ?? ALL_CLASSES, dueDate: a.dueDate.slice(0, 10), fileUrl: a.fileUrl })
                                        }
                                    />
                                    <Button size="sm" variant="ghost" label="Delete" onPress={() => remove(a)} />
                                </ButtonRow>
                            </Card>
                        );
                    })
                )}
            </View>
        </View>
    );
}

function Submissions() {
    const api = useApi();
    const { data, loading, error, refresh } = useApiQuery<Submission[]>('/api/school/submissions');
    const [grading, setGrading] = useState<{ id: string; grade: string; feedback: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const save = async () => {
        if (!grading) return;
        setSaving(true);
        try {
            const grade = parseFloat(grading.grade);
            await api.patch(`/api/school/submissions/${grading.id}`, { grade: Number.isNaN(grade) ? null : grade, feedback: grading.feedback.trim() || null });
            setGrading(null);
            refresh();
        } catch (err) {
            setMessage(errorMessage(err, 'Failed to save the grade'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingView />;
    const subs = data ?? [];
    const ungraded = subs.filter((s) => s.grade === null).length;

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone="danger" message={message} onDismiss={() => setMessage(null)} /> : null}
            {subs.length === 0 ? (
                <EmptyState title="No submissions yet" description="Work students hand in appears here for grading." />
            ) : (
                <>
                    <Text style={[styles.sub, { marginBottom: spacing.sm }]}>
                        {pluralize(subs.length, 'submission')} · {ungraded} to grade
                    </Text>
                    <ListCard>
                        {subs.map((s) =>
                            grading?.id === s.id ? (
                                <View key={s.id} style={{ padding: spacing.md }}>
                                    <Text style={styles.title}>{s.studentName}</Text>
                                    <Text style={styles.sub}>{s.assignmentTitle}</Text>
                                    {s.submissionText ? <Text style={styles.body}>{s.submissionText}</Text> : null}
                                    <TextField label="Grade" value={grading.grade} onChangeText={(grade) => setGrading({ ...grading, grade })} keyboardType="decimal-pad" />
                                    <TextField label="Feedback" value={grading.feedback} onChangeText={(feedback) => setGrading({ ...grading, feedback })} multiline />
                                    <ButtonRow>
                                        {s.fileUrl ? <Button size="sm" variant="ghost" label="Open file" onPress={() => void Linking.openURL(s.fileUrl as string)} /> : null}
                                        <Button size="sm" variant="secondary" label="Cancel" onPress={() => setGrading(null)} />
                                        <Button size="sm" label="Save grade" onPress={save} loading={saving} />
                                    </ButtonRow>
                                </View>
                            ) : (
                                <ListRow
                                    key={s.id}
                                    title={`${s.studentName ?? '—'} · ${s.assignmentTitle ?? ''}`}
                                    subtitle={`${s.subjectName ?? ''} · ${formatDate(s.submittedAt)}${s.feedback ? ` · “${s.feedback}”` : ''}`}
                                    right={s.grade !== null ? <Badge label={String(s.grade)} variant="success" /> : <Badge label="To grade" variant="warning" />}
                                    onPress={() => setGrading({ id: s.id, grade: s.grade === null ? '' : String(s.grade), feedback: s.feedback ?? '' })}
                                />
                            ),
                        )}
                    </ListCard>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    title: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    body: { fontSize: 13, color: colors.foreground, marginTop: spacing.sm, lineHeight: 19 },
});
