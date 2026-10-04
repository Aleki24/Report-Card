import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, ClipboardList } from 'lucide-react-native';
import { markingState, type MarkingProgressItem, type MarkingProgressResponse } from '@shared/marking-progress';
import { examTypeLabel } from '@/lib/academics';
import { useApiQuery } from '@/lib/useApiQuery';
import { pluralize } from '@/lib/format';
import { fonts, spacing, makeStyles, useTheme } from '@/lib/theme';
import { Card, EmptyState, ListCard, ListRow, ProgressBar, SectionLabel, StatGrid, StatTile } from '@/components/ui';

const ORDER = { 'in-progress': 0, 'not-started': 1, complete: 2, 'no-learners': 3 } as const;
const SHOWN = 5;

/**
 * The web teacher dashboard's marking card (/api/school/teacher/marking): how
 * far each of this term's exams has got, and one tap to the next mark sheet.
 */
export function MarkingProgress() {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const query = useApiQuery<MarkingProgressResponse>('/api/school/teacher/marking', { raw: true });
    const items = useMemo(() => query.data?.items ?? [], [query.data]);
    const progress = useMemo(() => {
        let left = 0;
        let complete = 0;
        for (const i of items) {
            left += Math.max(0, i.expected - i.entered);
            if (markingState(i) === 'complete') complete++;
        }
        return { left, complete };
    }, [items]);
    const queue = useMemo(
        () => [...items].filter((i) => markingState(i) !== 'no-learners').sort((a, b) => ORDER[markingState(a)] - ORDER[markingState(b)]).slice(0, SHOWN),
        [items],
    );

    if (query.loading || query.error || !query.data) return null;

    const open = (item: MarkingProgressItem) =>
        router.push({ pathname: '/staff/exams', params: { tab: 'entry', exam: item.examId, term: item.termId } });

    return (
        <>
            <SectionLabel>Marking{query.data.term ? ` · ${query.data.term.name}` : ''}</SectionLabel>
            <StatGrid>
                <StatTile label="Marks to enter" value={progress.left.toLocaleString()} icon={ClipboardList} tone={progress.left > 0 ? colors.warning : undefined} />
                <StatTile
                    label="Exams fully marked"
                    value={`${progress.complete}/${items.length}`}
                    icon={CircleCheck}
                    tone={items.length > 0 && progress.complete === items.length ? colors.success : undefined}
                />
            </StatGrid>
            {items.length === 0 ? (
                <Card style={{ marginTop: spacing.sm }}>
                    <EmptyState title="No exams to mark this term" description="When your exams are set up, each one appears here with how many marks are in." />
                </Card>
            ) : (
                <ListCard style={{ marginTop: spacing.sm }}>
                    {queue.map((item) => {
                        const state = markingState(item);
                        const pct = item.expected ? (item.entered / item.expected) * 100 : 0;
                        return (
                            <ListRow
                                key={item.examId}
                                title={`${item.subjectName} · ${item.className}`}
                                subtitle={`${examTypeLabel(item.examType)} · ${state === 'complete' ? 'all marks in' : `${item.entered} of ${pluralize(item.expected, 'learner')} entered`}`}
                                right={
                                    <View style={styles.bar}>
                                        <ProgressBar value={pct} color={state === 'complete' ? colors.success : state === 'in-progress' ? colors.warning : colors.border} />
                                        <Text style={styles.pct}>{Math.round(pct)}%</Text>
                                    </View>
                                }
                                onPress={() => open(item)}
                            />
                        );
                    })}
                </ListCard>
            )}
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    bar: { width: 64, alignItems: 'flex-end', gap: 2 },
    pct: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted },
}));
