import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { ExamResult, ReportCard } from '@/lib/types';

export default function ResultsScreen() {
    const [tab, setTab] = useState<'marks' | 'reports'>('marks');

    return (
        <Screen>
            <ScreenHeader title="My Results" description="Exam marks and official report cards." />
            <View style={styles.tabBar}>
                <Pressable onPress={() => setTab('marks')} style={[styles.tabButton, tab === 'marks' && styles.tabButtonActive]}>
                    <Text style={[styles.tabButtonText, tab === 'marks' && styles.tabButtonTextActive]}>Exam Marks</Text>
                </Pressable>
                <Pressable onPress={() => setTab('reports')} style={[styles.tabButton, tab === 'reports' && styles.tabButtonActive]}>
                    <Text style={[styles.tabButtonText, tab === 'reports' && styles.tabButtonTextActive]}>Report Cards</Text>
                </Pressable>
            </View>
            {tab === 'marks' ? <ExamMarksTab /> : <ReportCardsTab />}
        </Screen>
    );
}

function ExamMarksTab() {
    const api = useApi();
    const [results, setResults] = useState<ExamResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api
            .get<{ data: ExamResult[] }>('/api/school/student/results')
            .then((res) => setResults(res.data ?? []))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load results'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const grouped = useMemo(() => {
        const map: Record<string, { term: string; year: string; items: ExamResult[] }> = {};
        results.forEach((r) => {
            const ex = r.exams;
            const key = `${ex?.terms?.id ?? 'x'}_${ex?.academic_years?.id ?? 'x'}`;
            if (!map[key]) map[key] = { term: ex?.terms?.name ?? '?', year: ex?.academic_years?.name ?? '', items: [] };
            map[key].items.push(r);
        });
        return Object.values(map);
    }, [results]);

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} />;
    if (results.length === 0) return <EmptyState title="No results yet" description="Results appear once teachers publish exam marks." />;

    return (
        <View>
            {grouped.map((g, idx) => (
                <View key={idx} style={{ marginBottom: spacing.lg }}>
                    <Text style={styles.groupTitle}>
                        {g.term} — {g.year}
                    </Text>
                    <Card style={styles.listCard}>
                        {g.items.map((r) => (
                            <View key={r.id} style={styles.resultRow}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.resultSubject}>{r.exams?.subjects?.name ?? '—'}</Text>
                                    <Text style={styles.resultScore}>
                                        {r.raw_score}/{r.exams?.max_score}
                                        {r.remarks ? ` · ${r.remarks}` : ''}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={[styles.resultPct, { color: r.percentage >= 50 ? colors.success : colors.danger }]}>{r.percentage}%</Text>
                                    <Badge label={r.grade_symbol ?? '—'} variant={r.percentage >= 50 ? 'success' : 'danger'} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </View>
            ))}
        </View>
    );
}

function ReportCardsTab() {
    const api = useApi();
    const [reports, setReports] = useState<ReportCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        api
            .get<{ data: ReportCard[] }>('/api/school/student/report-cards')
            .then((res) => setReports(res.data ?? []))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report cards'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} />;
    if (reports.length === 0) return <EmptyState title="No report cards" description="Report cards appear once generated by your teachers." />;

    return (
        <View style={{ gap: spacing.md }}>
            {reports.map((rc) => {
                const isOpen = expanded === rc.id;
                const attendPct = rc.attendance_total > 0 ? Math.round((rc.attendance_present / rc.attendance_total) * 100) : null;
                return (
                    <Card key={rc.id}>
                        <Text style={styles.reportTitle}>
                            {rc.terms?.name ?? 'Term'} — {rc.academic_years?.name ?? 'Year'}
                        </Text>
                        <Text style={styles.reportSub}>{rc.grade_streams?.full_name ?? rc.grade_streams?.name ?? ''}</Text>

                        <View style={styles.reportStatsRow}>
                            <View>
                                <Text style={styles.reportStatLabel}>Average</Text>
                                <Text style={[styles.reportStatValue, { color: (rc.overall_average ?? 0) >= 50 ? colors.success : colors.danger }]}>
                                    {rc.overall_average != null ? `${rc.overall_average}%` : '—'}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.reportStatLabel}>Position</Text>
                                <Text style={styles.reportStatValue}>{rc.overall_position ?? '—'}</Text>
                            </View>
                            {attendPct != null ? (
                                <View>
                                    <Text style={styles.reportStatLabel}>Attendance</Text>
                                    <Text style={styles.reportStatValue}>{attendPct}%</Text>
                                </View>
                            ) : null}
                        </View>

                        <Pressable onPress={() => setExpanded(isOpen ? null : rc.id)} style={styles.detailsButton}>
                            <Text style={styles.detailsButtonText}>{isOpen ? 'Hide details' : 'Show details'}</Text>
                        </Pressable>

                        {isOpen ? (
                            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                                {rc.comments_class_teacher ? (
                                    <Text style={styles.comment}>
                                        <Text style={styles.commentLabel}>Class Teacher: </Text>
                                        {rc.comments_class_teacher}
                                    </Text>
                                ) : null}
                                {rc.comments_principal ? (
                                    <Text style={styles.comment}>
                                        <Text style={styles.commentLabel}>Principal: </Text>
                                        {rc.comments_principal}
                                    </Text>
                                ) : null}
                                {(rc.report_card_subjects ?? []).map((s) => (
                                    <View key={s.id} style={styles.subjectRow}>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.foreground }}>{s.subjects?.name ?? '—'}</Text>
                                        <Text style={{ fontSize: 13, color: colors.muted, marginRight: spacing.sm }}>
                                            {s.total_score ?? '—'}/{s.total_max_score ?? '—'}
                                        </Text>
                                        <Badge label={s.grade_symbol ?? '—'} variant={(s.percentage ?? 0) >= 50 ? 'success' : 'danger'} />
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </Card>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    tabBar: { flexDirection: 'row', marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabButtonActive: { borderBottomColor: colors.primary },
    tabButtonText: { fontSize: 13, fontWeight: '600', color: colors.muted },
    tabButtonTextActive: { color: colors.primary },
    groupTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
    listCard: { padding: 0, overflow: 'hidden' },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    resultSubject: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    resultScore: { fontSize: 12, color: colors.muted, marginTop: 2 },
    resultPct: { fontSize: 14, fontWeight: '800' },
    reportTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    reportSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    reportStatsRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    reportStatLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 2 },
    reportStatValue: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    detailsButton: { marginTop: spacing.md, alignSelf: 'flex-start' },
    detailsButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    comment: { fontSize: 12, color: colors.foreground, lineHeight: 18 },
    commentLabel: { fontWeight: '700' },
    subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
