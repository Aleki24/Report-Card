import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { StaffAnnouncement } from '@/lib/types';

function getTimeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AnnouncementsScreen() {
    const api = useApi();
    const { data, loading, error, refresh, refreshing } = useApiQuery<StaffAnnouncement[]>('/api/school/announcements');
    const announcements = data ?? [];

    const [composing, setComposing] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);

    const handlePost = async () => {
        if (!title.trim() || !content.trim()) return;
        setPosting(true);
        setPostError(null);
        try {
            await api.post('/api/school/announcements', { title: title.trim(), content: content.trim() });
            setTitle('');
            setContent('');
            setComposing(false);
            refresh();
        } catch (err) {
            setPostError(err instanceof Error ? err.message : 'Failed to post announcement');
        } finally {
            setPosting(false);
        }
    };

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Announcements" description="School-wide news and updates." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            {composing ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    {postError ? <ErrorBanner message={postError} /> : null}
                    <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} />
                    <TextInput
                        value={content}
                        onChangeText={setContent}
                        placeholder="What's the announcement?"
                        placeholderTextColor={colors.muted}
                        multiline
                        numberOfLines={4}
                        style={[styles.input, styles.textArea]}
                    />
                    <View style={styles.composeActions}>
                        <Pressable onPress={() => setComposing(false)} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handlePost} disabled={posting || !title.trim() || !content.trim()} style={styles.primaryButton}>
                            <Text style={styles.primaryButtonText}>{posting ? 'Posting…' : 'Post'}</Text>
                        </Pressable>
                    </View>
                </Card>
            ) : (
                <Pressable onPress={() => setComposing(true)} style={styles.newButton}>
                    <Text style={styles.newButtonText}>+ New Announcement</Text>
                </Pressable>
            )}

            {loading ? (
                <LoadingView />
            ) : announcements.length === 0 ? (
                <EmptyState title="No announcements yet" />
            ) : (
                <Card style={styles.listCard}>
                    {announcements.map((a) => (
                        <View key={a.id} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowTitle}>{a.title}</Text>
                                <Text style={styles.rowContent}>{a.content}</Text>
                                <Text style={styles.rowMeta}>
                                    {a.postedBy} · {getTimeAgo(a.createdAt)}
                                </Text>
                            </View>
                            {a.isImportant ? <View style={styles.importantDot} /> : null}
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
    textArea: { minHeight: 90, textAlignVertical: 'top' },
    composeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
    primaryButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.lg },
    primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 13 },
    secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.lg },
    secondaryButtonText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    rowContent: { fontSize: 12, color: colors.muted, marginTop: 2 },
    rowMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
    importantDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 4 },
});
