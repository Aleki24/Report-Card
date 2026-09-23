import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { PASS_MARK, errorMessage, fileSafe, formatPercent, pluralize, scoreColor } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Button, ButtonRow, Card, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice, ProgressBar, SearchField, StatGrid, StatTile,
} from '@/components/ui';
import { ReleaseControl } from './ReleaseControl';
import type { ExamMark, ExamSlot } from '@/lib/types';

/** One exam's results, best first, with the summary the web's results tab shows. */
export function ExamResults({ exam, onChanged, onEdit }: { exam: ExamSlot; onChanged: (status: ExamSlot['status']) => void; onEdit: () => void }) {
    const api = useApi();
    const { data, loading, error, refresh, reload } = useApiQuery<ExamMark[]>(`/api/school/exam-marks?exam_id=${exam.id}`);
    const [search, setSearch] = useState('');
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    const ranked = useMemo(() => {
        const sorted = [...(data ?? [])].sort((a, b) => Number(b.percentage) - Number(a.percentage));
        // Equal scores share a rank (1, 2, 2, 4).
        return sorted.map((m, i) => ({ ...m, rank: sorted.findIndex((o) => Number(o.percentage) === Number(m.percentage)) + 1, index: i }));
    }, [data]);

    const summary = useMemo(() => {
        if (ranked.length === 0) return null;
        const pcts = ranked.map((m) => Number(m.percentage));
        const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        const passed = pcts.filter((p) => p >= PASS_MARK).length;
        const grades = new Map<string, number>();
        for (const m of ranked) grades.set(m.grade_symbol || '—', (grades.get(m.grade_symbol || '—') ?? 0) + 1);
        return {
            mean,
            passRate: (passed / pcts.length) * 100,
            highest: Math.max(...pcts),
            lowest: Math.min(...pcts),
            grades: [...grades.entries()].sort((a, b) => b[1] - a[1]),
        };
    }, [ranked]);

    const visible = search.trim()
        ? ranked.filter((m) => `${m.student_name} ${m.admission_number}`.toLowerCase().includes(search.trim().toLowerCase()))
        : ranked;

    const exportAs = async (format: 'csv' | 'pdf') => {
        setExporting(format);
        setExportError(null);
        try {
            const safe = fileSafe(`${exam.subject_name}-${exam.grade_stream_name ?? exam.grade_name}-${exam.exam_type}`);
            await api.downloadAndShare(`/api/school/exam-marks/export?exam_id=${exam.id}&format=${format}`, `${safe}.${format}`, format === 'pdf' ? 'application/pdf' : 'text/csv');
        } catch (err) {
            setExportError(errorMessage(err, 'Export failed'));
        } finally {
            setExporting(null);
        }
    };

    if (loading) return <LoadingView />;

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={styles.title}>{exam.subject_name}</Text>
                <Text style={styles.sub}>
                    {exam.name} · {exam.grade_stream_name ?? exam.grade_name} · out of {exam.max_score}
                </Text>
                <View style={{ marginTop: spacing.md }}>
                    <ReleaseControl
                        exam={exam}
                        compact
                        onChanged={(status) => {
                            onChanged(status);
                            refresh();
                        }}
                    />
                </View>
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="Edit marks" onPress={onEdit} />
                    <Button size="sm" variant="secondary" label="CSV" onPress={() => exportAs('csv')} loading={exporting === 'csv'} disabled={ranked.length === 0} />
                    <Button size="sm" variant="secondary" label="PDF" onPress={() => exportAs('pdf')} loading={exporting === 'pdf'} disabled={ranked.length === 0} />
                </ButtonRow>
            </Card>

            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {exportError ? <Notice tone="danger" message={exportError} onDismiss={() => setExportError(null)} /> : null}

            {summary ? (
                <>
                    <StatGrid>
                        <StatTile label="Mean" value={formatPercent(summary.mean, 1)} tone={scoreColor(summary.mean)} />
                        <StatTile label="Pass rate" value={formatPercent(summary.passRate)} sub={`at or above ${PASS_MARK}%`} />
                        <StatTile label="Highest" value={formatPercent(summary.highest, 1)} />
                        <StatTile label="Lowest" value={formatPercent(summary.lowest, 1)} />
                    </StatGrid>
                    <Card style={{ marginTop: spacing.md }}>
                        <Text style={styles.cardTitle}>Grade spread · {pluralize(ranked.length, 'learner')}</Text>
                        {summary.grades.map(([grade, count]) => (
                            <View key={grade} style={styles.spreadRow}>
                                <Text style={styles.spreadGrade}>{grade}</Text>
                                <View style={{ flex: 1 }}>
                                    <ProgressBar value={(count / ranked.length) * 100} />
                                </View>
                                <Text style={styles.spreadCount}>{count}</Text>
                            </View>
                        ))}
                    </Card>
                </>
            ) : null}

            <View style={{ marginTop: spacing.md }}>
                {ranked.length > 12 ? <SearchField value={search} onChangeText={setSearch} placeholder="Find a learner" /> : null}
                {ranked.length === 0 ? (
                    <EmptyState title="No marks entered yet" action={<Button label="Enter marks" onPress={onEdit} />} />
                ) : (
                    <ListCard>
                        {visible.map((m) => (
                            <ListRow
                                key={m.id}
                                left={<Text style={styles.rank}>{m.rank}</Text>}
                                title={m.student_name || '—'}
                                subtitle={`${m.admission_number || '—'} · ${m.raw_score}/${exam.max_score}${m.remarks ? ` · ${m.remarks}` : ''}`}
                                right={
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.pct, { color: scoreColor(Number(m.percentage)) }]}>{formatPercent(Number(m.percentage), 1)}</Text>
                                        <Text style={styles.grade}>{m.grade_symbol || '—'}</Text>
                                    </View>
                                }
                            />
                        ))}
                    </ListCard>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    cardTitle: { fontSize: 13, fontWeight: '800', color: colors.foreground, marginBottom: spacing.sm },
    spreadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
    spreadGrade: { width: 36, fontSize: 13, fontWeight: '800', color: colors.foreground },
    spreadCount: { width: 32, textAlign: 'right', fontSize: 12, color: colors.muted },
    rank: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.muted },
    pct: { fontSize: 14, fontWeight: '800' },
    grade: { fontSize: 12, fontWeight: '700', color: colors.muted },
});
