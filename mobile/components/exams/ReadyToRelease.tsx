import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { groupReadyPapers, type ReadyGroup, type ReadyPaper } from '@shared/release-ready';
import { Button, Card, ErrorBanner, Notice } from '@/components/ui';
import { confirmAlert } from '@/lib/confirm';
import { pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing } from '@/lib/theme';
import { useReleasePapers, type ReleaseOutcome } from './useReleasePapers';

/**
 * Every paper this term with marks in and not yet released, grouped by class
 * and exam, each group a tap from released. The dashboard's "N papers ready
 * to release" opens here; it used to open on a class picker, so the admin
 * still had to hunt class by class for what the card had counted.
 */
export function ReadyToRelease({ papers, error, onRetry, onReleased }: {
    papers: readonly ReadyPaper[] | null;
    error: string | null;
    onRetry: () => void;
    onReleased: () => void;
}) {
    const styles = useStyles();
    const { release, busy } = useReleasePapers();
    const [releasing, setReleasing] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<ReleaseOutcome | null>(null);
    const groups = useMemo(() => groupReadyPapers(papers ?? []), [papers]);

    if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
    if (!papers || (groups.length === 0 && !outcome)) return null;

    const confirmRelease = (key: string, list: readonly ReadyPaper[], what: string) =>
        confirmAlert(`Release ${pluralize(list.length, 'paper')}?`, `${what}: learners and parents will see these marks. A learner with no mark in a subject simply won't see it.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Release',
                onPress: () => void (async () => {
                    setReleasing(key);
                    setOutcome(await release(list, 'paper'));
                    setReleasing(null);
                    onReleased();
                })(),
            },
        ]);

    return (
        <View style={styles.wrap}>
            {outcome ? <Notice tone={outcome.tone} message={outcome.text} onDismiss={() => setOutcome(null)} /> : null}
            {groups.length > 0 ? (
                <Card>
                    <View style={styles.head}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Ready to release</Text>
                            <Text style={styles.sub}>{pluralize(papers.length, 'paper')} this term with marks in · {pluralize(groups.length, 'class exam', 'class exams')}</Text>
                        </View>
                        {groups.length > 1 ? (
                            <Button size="sm" label={`Release all ${papers.length}`} loading={busy && releasing === 'all'} disabled={busy} onPress={() => confirmRelease('all', papers, 'Every class below')} />
                        ) : null}
                    </View>
                    {groups.map((g) => (
                        <GroupRow key={g.key} group={g} busy={busy} releasing={releasing === g.key} onRelease={() => confirmRelease(g.key, g.papers, `${g.classLabel} · ${g.examName}`)} />
                    ))}
                </Card>
            ) : null}
        </View>
    );
}

function GroupRow({ group: g, busy, releasing, onRelease }: { group: ReadyGroup; busy: boolean; releasing: boolean; onRelease: () => void }) {
    const styles = useStyles();
    const marks = g.papers.reduce((sum, p) => sum + p.mark_count, 0);
    return (
        <View style={styles.group}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.groupTitle}>{g.classLabel} · {g.examName}</Text>
                <Text style={styles.sub} numberOfLines={2}>{g.papers.map((p) => p.subject_name).join(', ')}</Text>
                <Text style={styles.meta}>{pluralize(g.papers.length, 'paper')} · {pluralize(marks, 'mark')} entered</Text>
            </View>
            <Button size="sm" variant="secondary" label={`Release ${g.papers.length}`} loading={releasing} disabled={busy} onPress={onRelease} />
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    wrap: { marginBottom: spacing.md, gap: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    title: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    meta: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, marginTop: 4 },
    group: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: radius.sm },
    groupTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
}));
