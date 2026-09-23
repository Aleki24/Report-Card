import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { errorMessage, getTimeAgo } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, LoadingView, Notice, Screen, ScreenHeader, TextField, ToggleRow } from '@/components/ui';
import type { StaffAnnouncement } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

interface Draft {
    id: string | null;
    title: string;
    content: string;
    isImportant: boolean;
    sendSms: boolean;
}

const EMPTY: Draft = { id: null, title: '', content: '', isImportant: false, sendSms: false };

export default function AnnouncementsScreen() {
    const api = useApi();
    const { role, profile } = useCurrentUser();
    const canPost = isRoleIn(role, STAFF_TEACHING_ROLES);
    const { data, loading, error, refresh, refreshing } = useApiQuery<StaffAnnouncement[]>('/api/school/announcements');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    // Admins and class teachers manage any post; a subject teacher only their own (as on the server).
    const canManage = (a: StaffAnnouncement) => role === 'ADMIN' || role === 'CLASS_TEACHER' || (role === 'SUBJECT_TEACHER' && a.postedById === profile?.id);

    const submit = async () => {
        if (!draft || !draft.title.trim() || !draft.content.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const body = { title: draft.title.trim(), content: draft.content.trim(), is_important: draft.isImportant };
            if (draft.id) await api.patch(`/api/school/announcements/${draft.id}`, body);
            else await api.post('/api/school/announcements', { ...body, send_sms: draft.sendSms });
            setMessage({ tone: 'success', text: draft.id ? 'Announcement updated.' : draft.sendSms ? 'Posted and sent by SMS.' : 'Announcement posted.' });
            setDraft(null);
            refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to save announcement') });
        } finally {
            setSaving(false);
        }
    };

    const remove = (a: StaffAnnouncement) =>
        confirmAlert('Delete announcement?', a.title, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.del(`/api/school/announcements/${a.id}`);
                        refresh();
                    } catch (err) {
                        setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to delete') });
                    }
                },
            },
        ]);

    const announcements = data ?? [];

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader
                title="Announcements"
                description="School-wide news and updates."
                action={canPost && !draft ? <Button size="sm" label="+ New" onPress={() => setDraft(EMPTY)} /> : undefined}
            />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            {draft ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    <TextField label="Title" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
                    <TextField label="Message" value={draft.content} onChangeText={(content) => setDraft({ ...draft, content })} multiline />
                    <ToggleRow label="Mark as important" value={draft.isImportant} onValueChange={(isImportant) => setDraft({ ...draft, isImportant })} />
                    {draft.id ? null : (
                        <ToggleRow label="Also send by SMS" description="Texts every active learner's guardian (first 300 characters)." value={draft.sendSms} onValueChange={(sendSms) => setDraft({ ...draft, sendSms })} />
                    )}
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setDraft(null)} />
                        <Button label={draft.id ? 'Save' : 'Post'} onPress={submit} loading={saving} disabled={!draft.title.trim() || !draft.content.trim()} />
                    </ButtonRow>
                </Card>
            ) : null}

            {loading ? (
                <LoadingView />
            ) : announcements.length === 0 ? (
                <EmptyState title="No announcements yet" />
            ) : (
                announcements.map((a) => (
                    <Card key={a.id} style={[{ marginBottom: spacing.sm }, a.isImportant && { borderColor: colors.danger }]}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>{a.title}</Text>
                            {a.isImportant ? <Badge label="Important" variant="danger" /> : null}
                        </View>
                        <Text style={styles.content}>{a.content}</Text>
                        <Text style={styles.meta}>
                            {a.postedBy} · {getTimeAgo(a.createdAt)}
                        </Text>
                        {canManage(a) ? (
                            <ButtonRow>
                                <Button size="sm" variant="ghost" label="Edit" onPress={() => setDraft({ id: a.id, title: a.title, content: a.content, isImportant: a.isImportant, sendSms: false })} />
                                <Button size="sm" variant="ghost" label="Delete" onPress={() => remove(a)} />
                            </ButtonRow>
                        ) : null}
                    </Card>
                ))
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
    title: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.foreground },
    content: { fontSize: 13, color: colors.foreground, marginTop: spacing.sm, lineHeight: 19 },
    meta: { fontSize: 11, color: colors.muted, marginTop: spacing.sm },
});
