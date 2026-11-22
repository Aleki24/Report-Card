import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, History } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { ErrorBanner, LoadingView } from '@/components/ui';
import { describeMarkChange, type MarkChangeAction, type MarkHistoryResponse } from '@shared/mark-history';

const when = (iso: string) => formatDate(new Date(iso), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The web's "Change history" under a mark sheet: who entered, changed or
 * removed each mark, newest first. Loads when opened; `version` bumps after a save.
 */
export function MarkHistory({ examId, search, version }: { examId: string; search: string; version: number }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [open, setOpen] = useState(false);
    const query = useApiQuery<MarkHistoryResponse>(open ? withQuery('/api/school/exam-marks/history', { exam_id: examId }) : null, { raw: true });
    const { refresh } = query;
    const seen = useRef(version);
    useEffect(() => {
        if (seen.current === version) return;
        seen.current = version;
        if (open) refresh();
    }, [version, open, refresh]);

    const tone: Record<MarkChangeAction, string> = { entered: colors.success, changed: colors.warning, removed: colors.danger };
    const q = search.trim().toLowerCase();
    const changes = (query.data?.data ?? []).filter((c) => !q || c.studentName.toLowerCase().includes(q));

    return (
        <View style={styles.box}>
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.head}>
                <History size={16} color={colors.muted} />
                <Text style={styles.title}>Change history{q ? ` · matching “${search.trim()}”` : ''}</Text>
                <ChevronDown size={16} color={colors.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>
            {open ? (
                <View style={styles.body}>
                    {query.error && !query.data ? (
                        <ErrorBanner message={query.error} onRetry={query.reload} />
                    ) : !query.data ? (
                        <LoadingView />
                    ) : !query.data.recording ? (
                        <Text style={styles.muted}>Changes aren’t being recorded yet. Ask your administrator to finish the update.</Text>
                    ) : changes.length === 0 ? (
                        <Text style={styles.muted}>{q ? 'No changes for that learner.' : 'No changes recorded yet. Every mark saved from now on is listed here.'}</Text>
                    ) : (
                        changes.map((c) => (
                            <View key={c.id} style={styles.row}>
                                <View style={[styles.dot, { backgroundColor: tone[c.action] }]} />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.text}>
                                        <Text style={{ fontFamily: fonts.bold }}>{c.studentName}</Text> · {describeMarkChange(c)}
                                    </Text>
                                    <Text style={styles.muted}>{c.changedBy ?? (c.action === 'changed' ? 'Recalculated from paper scores' : 'Not recorded')} · {when(c.changedAt)}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, marginTop: spacing.md, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
    title: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    text: { fontSize: 13, fontFamily: fonts.regular, color: colors.foreground },
    muted: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
}));
