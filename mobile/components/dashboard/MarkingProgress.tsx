import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenLine } from 'lucide-react-native';
import { markingState, type MarkingProgressItem, type MarkingProgressResponse } from '@shared/marking-progress';
import { examTypeLabel } from '@/lib/academics';
import { useApiQuery } from '@/lib/useApiQuery';
import { pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { InsightCard, Meter } from './kit';

const ORDER = { 'in-progress': 0, 'not-started': 1, complete: 2, 'no-learners': 3 } as const;
const SHOWN = 6;

export interface MarkingSummary {
    loading: boolean;
    items: MarkingProgressItem[];
    termName: string | null;
    /** Marks still to enter across every exam. */
    left: number;
    complete: number;
    /** Where to carry on: the exam started but unfinished, else the first not started. */
    next: MarkingProgressItem | null;
}

/** This term's marking for the signed-in teacher (/api/school/teacher/marking). */
export function useMarking(): MarkingSummary {
    const query = useApiQuery<MarkingProgressResponse>('/api/school/teacher/marking', { raw: true });
    return useMemo(() => {
        const items = query.data?.items ?? [];
        let left = 0;
        let complete = 0;
        for (const i of items) {
            left += Math.max(0, i.expected - i.entered);
            if (markingState(i) === 'complete') complete++;
        }
        const next = items.find((i) => markingState(i) === 'in-progress') ?? items.find((i) => markingState(i) === 'not-started') ?? null;
        return { loading: query.loading, items, termName: query.data?.term?.name ?? null, left, complete, next };
    }, [query.data, query.loading]);
}

/** Opens one exam's mark sheet on the Mark Entry tab. */
export function markEntryRoute(item: Pick<MarkingProgressItem, 'examId' | 'termId'>) {
    return { pathname: '/staff/exams' as const, params: { tab: 'entry', exam: item.examId, term: item.termId } };
}

/**
 * The web's "My marking" panel: each of this term's exams with how many marks
 * are in, the unfinished first, one tap to its mark sheet.
 */
export function MarkingPanel({ marking }: { marking: MarkingSummary }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const queue = useMemo(
        () => marking.items.filter((i) => markingState(i) !== 'no-learners').sort((a, b) => ORDER[markingState(a)] - ORDER[markingState(b)]).slice(0, SHOWN),
        [marking.items],
    );
    return (
        <InsightCard title="My marking" meta={marking.termName ?? 'This term'} action={{ label: 'All exams', href: '/staff/exams' }}>
            {marking.loading ? (
                <Text style={styles.empty}>Loading your exams…</Text>
            ) : queue.length === 0 ? (
                <Text style={styles.empty}>No exams to mark yet this term. When your exams are set up, each appears here with how many marks are in.</Text>
            ) : (
                <View>
                    {queue.map((item, i) => {
                        const state = markingState(item);
                        const pct = item.expected ? (item.entered / item.expected) * 100 : 0;
                        const color = state === 'complete' ? colors.success : state === 'in-progress' ? colors.warning : colors.muted;
                        return (
                            <Pressable
                                key={item.examId}
                                onPress={() => router.push(markEntryRoute(item))}
                                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }]}
                                accessibilityRole="link"
                                accessibilityLabel={`${item.subjectName}, ${item.className}: ${item.entered} of ${item.expected} entered`}
                            >
                                <View style={styles.rowHead}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={styles.title} numberOfLines={1}>{item.subjectName} · {item.className}</Text>
                                        <Text style={styles.meta} numberOfLines={1}>
                                            {examTypeLabel(item.examType)} · {state === 'complete' ? 'all marks in' : `${item.entered} of ${pluralize(item.expected, 'learner')}`}
                                        </Text>
                                    </View>
                                    {state === 'complete' ? (
                                        <Text style={[styles.pct, { color }]}>Done</Text>
                                    ) : (
                                        <View style={[styles.go, { backgroundColor: colors.primarySoft }]}><PenLine size={14} color={colors.primary} /></View>
                                    )}
                                </View>
                                <Meter value={pct} color={color} height={6} />
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </InsightCard>
    );
}

const useStyles = makeStyles((colors) => ({
    empty: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, paddingVertical: spacing.sm },
    row: { paddingVertical: spacing.md, gap: spacing.sm },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    title: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    meta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    pct: { fontSize: 12, fontFamily: fonts.bold },
    go: { width: 32, height: 32, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
}));
