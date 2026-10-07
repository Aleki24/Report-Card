import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DateField } from '@/components/DateField';
import { Pressable, Text, View } from 'react-native';
import { ClipboardList, FileText, Paperclip, Upload, X } from 'lucide-react-native';
import { FormSheet } from '@/components/ops/FormSheet';
import { useToast } from '@/components/Toast';
import { useCurrentUser } from '@/lib/UserContext';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useGradeStreams } from '@/lib/useSchoolData';
import { errorMessage, formatDate, getDueLabel, pluralize, shiftISODate, toISODate } from '@/lib/format';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SegmentedTabs, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { StaffAssignment, TeacherSubject } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';
import { openAttachment } from '@/lib/openAttachment';
import { attachmentName } from '@shared/attachments';

interface Draft {
    id: string | null;
    title: string;
    description: string;
    subjectId: string | null;
    streamId: string;
    dueDate: string;
    fileUrl: string | null;
    /** The picked file's name, shown until the draft is saved. */
    fileName: string | null;
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

type View_ = 'upcoming' | 'past' | 'mine';

const QUICK_DUE = [
    { value: '1', label: 'Tomorrow' },
    { value: '3', label: '3 days' },
    { value: '7', label: '1 week' },
    { value: '14', label: '2 weeks' },
] as const;

/** A class is required (the API sets work for one class); a teacher with one class gets it chosen. */
const newDraft = (onlyStreamId: string | null): Draft => ({ id: null, title: '', description: '', subjectId: null, streamId: onlyStreamId ?? '', dueDate: shiftISODate(toISODate(), 7), fileUrl: null, fileName: null });

/** The picked file's name until saved, then the name the upload kept. */
const attachmentLabel = (url: string, name: string | null): string => name ?? attachmentName(url);

export default function AssignmentsScreen() {
    return (
        <RequireScreen screen="assignments">
            <AssignmentsContent />
        </RequireScreen>
    );
}

function AssignmentsContent() {
    // The teacher home's "Work to grade" tile opens straight on submissions.
    const params = useLocalSearchParams<{ tab?: string }>();
    const [tab, setTab] = useState<'list' | 'submissions'>(params.tab === 'submissions' ? 'submissions' : 'list');
    const [draft, setDraft] = useState<Draft | null>(null);
    const { streams } = useGradeStreams();
    const startDraft = () => setDraft(newDraft(streams.length === 1 ? streams[0].id : null));
    return (
        <Screen>
            <ScreenHeader
                title="Assignments"
                description="Set homework for a class, attach worksheets, and grade what learners hand in."
                action={tab === 'list' ? <Button size="sm" label="+ New" onPress={startDraft} /> : undefined}
            />
            <SegmentedTabs
                tabs={[
                    { value: 'list', label: 'Assignments' },
                    { value: 'submissions', label: 'Submissions' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'list' ? <AssignmentList draft={draft} setDraft={setDraft} startDraft={startDraft} /> : <Submissions />}
        </Screen>
    );
}

function AssignmentList({ draft, setDraft, startDraft }: { draft: Draft | null; setDraft: (d: Draft | null) => void; startDraft: () => void }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
    const { profile, role } = useCurrentUser();
    const { data, loading, error, refresh } = useApiQuery<StaffAssignment[]>('/api/school/assignments');
    const subjects = useApiQuery<TeacherSubject[]>('/api/school/data?type=subjects');
    const { streams } = useGradeStreams();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Shown in the form itself, so a missing field or failed upload is never silent.
    const [problem, setProblem] = useState<string | null>(null);
    const [view, setView] = useState<View_>('upcoming');
    const edit = (d: Draft | null) => { setProblem(null); setDraft(d); };

    const today = toISODate();
    const canManage = (a: StaffAssignment) => role === 'ADMIN' || (!!profile && a.createdById === profile.id);
    // A class's subjects only: CBC and 8-4-4 classes take different ones.
    const level = draft?.streamId ? streams.find((s) => s.id === draft.streamId)?.grades?.academic_level_id ?? null : null;
    const subjectOptions = (subjects.data ?? []).filter((s) => !level || !s.academic_level_id || s.academic_level_id === level);

    const save = async () => {
        if (!draft) return;
        const missing = [!draft.title.trim() && 'a title', !draft.streamId && 'the class', !draft.subjectId && 'the subject'].filter(Boolean);
        if (missing.length > 0) { setProblem(`Add ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} to set the assignment.`); return; }
        setProblem(null);
        setSaving(true);
        const body = {
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            subject_id: draft.subjectId,
            grade_stream_id: draft.streamId,
            due_date: draft.dueDate,
            file_url: draft.fileUrl,
        };
        try {
            if (draft.id) await api.patch(`/api/school/assignments/${draft.id}`, body);
            else await api.post('/api/school/assignments', body);
            toast.success(draft.id ? 'Assignment updated.' : 'Assignment set. Learners in the class can see it now.');
            setDraft(null);
            refresh();
        } catch (err) {
            setProblem(errorMessage(err, 'Failed to save assignment'));
        } finally {
            setSaving(false);
        }
    };

    const attach = async () => {
        if (!draft) return;
        setUploading(true);
        setProblem(null);
        try {
            const file = await api.pickAndUploadAttachment();
            if (file) setDraft({ ...draft, fileUrl: file.url, fileName: file.name });
        } catch (err) {
            setProblem(errorMessage(err, 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    const open = (url: string) => void openAttachment(url).catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the file')));

    const remove = (a: StaffAssignment) =>
        confirmAlert('Delete this assignment?', `${a.title}${a.submissionCount > 0 ? ` and its ${pluralize(a.submissionCount, 'submission')}` : ''} will be removed.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.del(`/api/school/assignments/${a.id}`);
                        toast.success('Assignment deleted.');
                        refresh();
                    } catch (err) {
                        toast.error(errorMessage(err, 'Failed to delete'));
                    }
                },
            },
        ]);

    const all = data ?? [];
    const counts = {
        upcoming: all.filter((a) => a.dueDate.slice(0, 10) >= today).length,
        past: all.filter((a) => a.dueDate.slice(0, 10) < today).length,
        mine: all.filter((a) => profile && a.createdById === profile.id).length,
    };
    const shown = all
        .filter((a) => (view === 'upcoming' ? a.dueDate.slice(0, 10) >= today : view === 'past' ? a.dueDate.slice(0, 10) < today : !!profile && a.createdById === profile.id))
        .sort((x, y) => (view === 'past' ? y.dueDate.localeCompare(x.dueDate) : x.dueDate.localeCompare(y.dueDate)));
    const quickDue = QUICK_DUE.find((q) => draft && shiftISODate(today, Number(q.value)) === draft.dueDate)?.value ?? null;

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <ChipSelect
                layout="segmented"
                options={[
                    { value: 'upcoming', label: `Upcoming ${counts.upcoming}` },
                    { value: 'past', label: `Past ${counts.past}` },
                    { value: 'mine', label: `Mine ${counts.mine}` },
                ]}
                value={view}
                onChange={setView}
            />

            {loading && !data ? <LoadingView /> : shown.length === 0 ? (
                <EmptyState
                    icon={ClipboardList}
                    title={view === 'past' ? 'Nothing past due' : view === 'mine' ? 'You have not set any assignments' : 'No upcoming assignments'}
                    description="Set homework for a class; learners see it on their home screen and can hand work in."
                    action={<Button label="+ New assignment" onPress={startDraft} />}
                />
            ) : shown.map((a) => {
                const due = getDueLabel(a.dueDate);
                const tone = due === 'Overdue' ? tones.rose : due === 'Due today' || due === 'Due tomorrow' ? tones.amber : tones.blue;
                return (
                    <Card key={a.id} style={styles.card}>
                        <View style={[styles.stripe, { backgroundColor: tone.solid }]} />
                        <View style={styles.cardHead}>
                            <View style={[styles.dueTile, { backgroundColor: tone.bg }]}>
                                <Text style={[styles.dueMonth, { color: tone.fg }]}>{formatDate(a.dueDate, { month: 'short' }).toUpperCase()}</Text>
                                <Text style={[styles.dueDay, { color: tone.fg }]}>{formatDate(a.dueDate, { day: 'numeric' })}</Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.title} numberOfLines={2}>{a.title}</Text>
                                <Text style={styles.sub} numberOfLines={1}>{a.subject} · {a.stream ?? 'All classes'}</Text>
                                <View style={styles.metaRow}>
                                    <Badge label={due} variant={due === 'Overdue' ? 'danger' : due === 'Due today' || due === 'Due tomorrow' ? 'warning' : 'info'} />
                                    <Text style={styles.meta}>{pluralize(a.submissionCount, 'submission')} · by {a.createdBy}</Text>
                                </View>
                            </View>
                        </View>
                        {a.description ? <Text style={styles.body} numberOfLines={4}>{a.description}</Text> : null}
                        {a.fileUrl ? (
                            <Pressable onPress={() => open(a.fileUrl as string)} style={styles.file} accessibilityRole="link">
                                <Paperclip size={15} color={colors.primary} />
                                <Text style={styles.fileText} numberOfLines={1}>{attachmentLabel(a.fileUrl, null)}</Text>
                            </Pressable>
                        ) : null}
                        {canManage(a) ? (
                            <View style={styles.actions}>
                                <Button size="sm" variant="secondary" label="Edit" onPress={() => edit({ id: a.id, title: a.title, description: a.description ?? '', subjectId: a.subjectId, streamId: a.streamId ?? '', dueDate: a.dueDate.slice(0, 10), fileUrl: a.fileUrl, fileName: null })} />
                                <Button size="sm" variant="ghost" label="Delete" onPress={() => remove(a)} />
                            </View>
                        ) : null}
                    </Card>
                );
            })}

            <FormSheet
                visible={!!draft}
                title={draft?.id ? 'Edit assignment' : 'New assignment'}
                onClose={() => edit(null)}
                onSubmit={() => void save()}
                submitLabel={draft?.id ? 'Save changes' : 'Set assignment'}
                submitting={saving || uploading}
                error={problem}
            >
                {draft ? (
                    <>
                        <TextField label="Title *" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder="e.g. Fractions worksheet" />
                        <ChipSelect
                            label="Class *"
                            layout="picker"
                            placeholder="Choose the class"
                            options={streams.map((s) => ({ value: s.id, label: s.full_name }))}
                            value={draft.streamId || null}
                            onChange={(streamId) => setDraft({ ...draft, streamId, subjectId: null })}
                        />
                        <ChipSelect
                            label="Subject *"
                            layout="picker"
                            placeholder="Choose the subject"
                            options={subjectOptions.map((s) => ({ value: s.id, label: s.name, hint: s.code ?? undefined }))}
                            value={draft.subjectId}
                            onChange={(subjectId) => setDraft({ ...draft, subjectId })}
                        />
                        <DateField label="Due date *" min={draft.id ? undefined : today} value={draft.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} />
                        <ChipSelect
                            layout="segmented"
                            options={QUICK_DUE}
                            value={quickDue}
                            onChange={(d) => setDraft({ ...draft, dueDate: shiftISODate(today, Number(d)) })}
                        />
                        <TextField label="Instructions" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} multiline placeholder="What should learners do, and how should they hand it in?" />
                        <Text style={styles.fieldLabel}>Attachment</Text>
                        {draft.fileUrl ? (
                            <View style={styles.attached}>
                                <View style={styles.attachIcon}><FileText size={18} color={colors.primary} /></View>
                                <Text style={styles.fileText} numberOfLines={1}>{attachmentLabel(draft.fileUrl, draft.fileName)}</Text>
                                <Pressable onPress={() => setDraft({ ...draft, fileUrl: null, fileName: null })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove attachment">
                                    <X size={18} color={colors.muted} />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable onPress={() => void attach()} disabled={uploading} style={({ pressed }) => [styles.dropzone, pressed && { borderColor: colors.primary }]} accessibilityRole="button">
                                <Upload size={20} color={colors.primary} />
                                <Text style={styles.dropTitle}>{uploading ? 'Uploading…' : 'Attach a worksheet or notes'}</Text>
                                <Text style={styles.meta}>PDF, Word, PowerPoint, Excel or a photo · up to 10 MB</Text>
                            </Pressable>
                        )}
                    </>
                ) : null}
            </FormSheet>
        </View>
    );
}

function Submissions() {
    const styles = useStyles();
    const api = useApi();
    const toast = useToast();
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
                                        {s.fileUrl ? <Button size="sm" variant="ghost" label="Open file" onPress={() => void openAttachment(s.fileUrl as string).catch((err: unknown) => toast.error(errorMessage(err, 'Could not open the file')))} /> : null}
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

const useStyles = makeStyles((colors) => ({
    card: { marginBottom: spacing.sm, overflow: 'hidden', paddingLeft: spacing.lg + 4 },
    stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    cardHead: { flexDirection: 'row', gap: spacing.md },
    dueTile: { width: 48, borderRadius: radius.lg, alignItems: 'center', paddingVertical: 6 },
    dueMonth: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.5 },
    dueDay: { fontSize: 20, lineHeight: 24, fontFamily: fonts.display },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
    meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    file: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
    fileText: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    fieldLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginBottom: 6, marginTop: spacing.sm },
    attached: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    attachIcon: { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    dropzone: { alignItems: 'center', gap: 4, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.card },
    dropTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, marginTop: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    title: { flex: 1, fontSize: 15, fontFamily: fonts.display, color: colors.foreground },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    body: { fontFamily: fonts.regular, fontSize: 13, color: colors.foreground, marginTop: spacing.sm, lineHeight: 19 },
}));
