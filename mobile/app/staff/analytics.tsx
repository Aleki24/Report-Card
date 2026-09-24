import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { useGradeStreams } from '@/lib/useSchoolData';
import { examTypeLabel } from '@/lib/academics';
import { TONE_COLORS, formatPercent, passRateTone, pluralize, scoreColor, shortCurriculumLabel } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, ProgressBar,
    Screen, ScreenHeader, SectionLabel, StatGrid, StatTile,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { AnalyticsOverview, ClassAnalytics } from '@/lib/types';

const ALL = 'all';

/**
 * Two levels, as on the web: the school compares classes (the one comparison
 * valid across curricula), and everything else — subjects, merit list, trend —
 * lives inside a class, where there is one grade and one set of scales.
 */
export default function AnalyticsScreen() {
    return (
        <RequireScreen screen="analytics">
            <AnalyticsContent />
        </RequireScreen>
    );
}

function AnalyticsContent() {
    const { streams } = useGradeStreams();
    const [streamId, setStreamId] = useState<string>(ALL);
    const selected = streams.find((s) => s.id === streamId);

    return (
        <Screen>
            <ScreenHeader
                title="Analytics"
                description={selected ? `${selected.full_name} — subjects, merit list and trend` : 'How each class is doing. Open a class for its subjects and merit list.'}
            />
            <ChipSelect options={[{ value: ALL, label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]} value={streamId} onChange={setStreamId} />
            {streamId === ALL ? <SchoolOverview onSelect={setStreamId} /> : <ClassView key={streamId} streamId={streamId} />}
        </Screen>
    );
}

function SchoolOverview({ onSelect }: { onSelect: (id: string) => void }) {
    const { data, loading, error, reload } = useApiQuery<AnalyticsOverview>('/api/school/analytics/overview', { raw: true });
    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={reload} />;
    const withMarks = (data?.classes ?? []).filter((c) => c.mark_count > 0);
    if (!data || withMarks.length === 0) {
        return <EmptyState title="No marks recorded yet" description="Once exams are marked, each class will appear here." />;
    }
    const s = data.summary;
    return (
        <>
            <StatGrid>
                <StatTile label="Classes with marks" value={`${s.classes_with_marks} / ${s.classes_total}`} />
                <StatTile label="Learners" value={s.learners.toLocaleString()} />
                <StatTile label="Marks" value={s.mark_count.toLocaleString()} sub={data.academic_year ?? undefined} />
                <StatTile label="Exams awaiting marks" value={s.exams_awaiting_marks} tone={s.exams_awaiting_marks > 0 ? colors.warning : undefined} />
            </StatGrid>
            <SectionLabel>Classes, weakest first</SectionLabel>
            <ListCard>
                {data.classes.map((c) => {
                    const tone = TONE_COLORS[passRateTone(c.pass_rate)];
                    return (
                        <View key={c.id} style={styles.classRow}>
                            <View style={styles.classHeader}>
                                <Text style={styles.className} numberOfLines={1} onPress={() => onSelect(c.id)}>
                                    {c.name} ›
                                </Text>
                                {shortCurriculumLabel(c.level_code) ? <Badge label={shortCurriculumLabel(c.level_code) ?? ''} /> : null}
                                <Text style={[styles.rate, { color: tone }]}>{c.pass_rate == null ? '—' : `${c.pass_rate}%`}</Text>
                            </View>
                            <ProgressBar value={c.pass_rate ?? 0} color={tone} />
                            <Text style={styles.meta}>
                                {pluralize(c.students, 'learner')} · mean {formatPercent(c.mean, 1)} · {pluralize(c.mark_count, 'mark')}
                                {c.unmarked > 0 ? ` · ${c.unmarked} unmarked` : ''}
                            </Text>
                        </View>
                    );
                })}
            </ListCard>
        </>
    );
}

const MERIT_PREVIEW = 15;

function ClassView({ streamId }: { streamId: string }) {
    const [termId, setTermId] = useState<string | null>(null);
    const [examType, setExamType] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const { data, loading, error, reload } = useApiQuery<ClassAnalytics>(
        withQuery('/api/school/analytics/class', { stream_id: streamId, term_id: termId, exam_type: examType }),
        { raw: true },
    );

    // Best first by mean; equal means share a rank.
    const subjects = useMemo(() => {
        const sorted = [...(data?.subjects ?? [])].sort((a, b) => b.mean_percentage - a.mean_percentage || b.pass_rate - a.pass_rate);
        return sorted.map((s) => ({ ...s, rank: sorted.findIndex((o) => o.mean_percentage === s.mean_percentage) + 1 }));
    }, [data]);

    if (loading && !data) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={reload} />;
    if (!data) return null;

    const examTypes = [...new Set(data.series.filter((s) => s.term_id === data.scope.term_id).map((s) => s.exam_type))];
    const merit = showAll ? data.merit : data.merit.slice(0, MERIT_PREVIEW);

    return (
        <>
            {data.terms.length > 1 ? (
                <ChipSelect label="Term" options={data.terms.map((t) => ({ value: t.id, label: t.name }))} value={data.scope.term_id} onChange={setTermId} />
            ) : null}
            {examTypes.length > 0 ? (
                <ChipSelect
                    label="Sitting"
                    options={[{ value: '', label: 'Whole term' }, ...examTypes.map((t) => ({ value: t, label: examTypeLabel(t) }))]}
                    value={examType ?? ''}
                    onChange={(v) => setExamType(v || null)}
                />
            ) : null}

            {data.summary.mark_count === 0 ? (
                <EmptyState title="No marks for this selection" description="Pick another term or sitting." />
            ) : (
                <>
                    <StatGrid>
                        <StatTile label="Mean" value={formatPercent(data.summary.mean_percentage, 1)} tone={scoreColor(data.summary.mean_percentage)} />
                        <StatTile label="Pass rate" value={`${data.summary.pass_rate}%`} tone={TONE_COLORS[passRateTone(data.summary.pass_rate)]} />
                        <StatTile label="Learners" value={data.summary.student_count} />
                        <StatTile label="Subjects" value={data.summary.subject_count} />
                    </StatGrid>

                    <SectionLabel>Subjects, best first</SectionLabel>
                    <ListCard>
                        {subjects.map((s) => (
                            <ListRow
                                key={s.subject_id}
                                left={<Text style={styles.rank}>{s.rank}</Text>}
                                title={s.subject_name}
                                subtitle={`Pass ${s.pass_rate}% · high ${formatPercent(s.highest)} · low ${formatPercent(s.lowest)} · ${pluralize(s.student_count, 'learner')}`}
                                right={
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.rate, { color: scoreColor(s.mean_percentage) }]}>{formatPercent(s.mean_percentage, 1)}</Text>
                                        {s.grade_symbol ? <Text style={styles.meta}>{s.grade_symbol}</Text> : null}
                                    </View>
                                }
                            />
                        ))}
                    </ListCard>

                    <SectionLabel>Merit list</SectionLabel>
                    <ListCard>
                        {merit.map((m) => (
                            <ListRow
                                key={m.student_id}
                                left={<Text style={styles.rank}>{m.rank ?? '—'}</Text>}
                                title={m.student_name}
                                subtitle={`${m.admission_number ?? '—'} · ${pluralize(m.subjects_sat, 'subject')}${m.incomplete ? ' · incomplete, ranked separately' : ''}`}
                                right={<Text style={[styles.rate, { color: scoreColor(m.mean_percentage) }]}>{formatPercent(m.mean_percentage, 1)}</Text>}
                            />
                        ))}
                    </ListCard>
                    {data.merit.length > MERIT_PREVIEW ? (
                        <View style={{ marginTop: spacing.sm }}>
                            <Button variant="ghost" label={showAll ? 'Show top 15' : `Show all ${data.merit.length}`} onPress={() => setShowAll((v) => !v)} />
                        </View>
                    ) : null}

                    {data.series.length > 1 ? (
                        <>
                            <SectionLabel>Trend across sittings</SectionLabel>
                            <Card>
                                {data.series.map((p) => (
                                    <View key={`${p.term_id}-${p.exam_type}`} style={styles.trendRow}>
                                        <Text style={styles.trendLabel} numberOfLines={1}>{p.label}</Text>
                                        <View style={{ flex: 1 }}>
                                            <ProgressBar value={p.mean_percentage} color={scoreColor(p.mean_percentage)} />
                                        </View>
                                        <Text style={styles.trendValue}>{formatPercent(p.mean_percentage, 1)}</Text>
                                    </View>
                                ))}
                            </Card>
                        </>
                    ) : null}
                </>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    classRow: { padding: spacing.md, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    classHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    className: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.primary },
    rate: { fontSize: 14, fontWeight: '800' },
    meta: { fontSize: 11, color: colors.muted },
    rank: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.muted },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    trendLabel: { width: 110, fontSize: 12, fontWeight: '600', color: colors.foreground },
    trendValue: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.foreground },
});
