import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, fileSafe, formatPercent, scoreColor } from '@/lib/format';
import { DEFAULT_TEMPLATE, REPORT_TEMPLATES, templateParam, type ReportTemplateId } from '@/lib/reportTemplates';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SectionLabel, SegmentedTabs,
} from '@/components/ui';
import type { ExamResult, ReportCard } from '@/lib/types';

export default function ResultsScreen() {
    const [tab, setTab] = useState<'marks' | 'reports'>('marks');
    return (
        <Screen>
            <ScreenHeader title="My Results" description="Exam marks and official report cards." />
            <SegmentedTabs
                tabs={[
                    { value: 'marks', label: 'Exam marks' },
                    { value: 'reports', label: 'Report cards' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'marks' ? <ExamMarksTab /> : <ReportCardsTab />}
        </Screen>
    );
}

function uniqueOptions(results: readonly ExamResult[], pick: (r: ExamResult) => { id: string; name: string } | null | undefined) {
    const map = new Map<string, string>();
    for (const r of results) {
        const v = pick(r);
        if (v) map.set(v.id, v.name);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
}

function ExamMarksTab() {
    const [year, setYear] = useState('');
    const [term, setTerm] = useState('');
    const [subject, setSubject] = useState('');
    const { data, loading, error, reload } = useApiQuery<ExamResult[]>(withQuery('/api/school/student/results', { year, term, subject }));
    // Filter options come from the unfiltered list so choosing one doesn't hide the others.
    const all = useApiQuery<ExamResult[]>('/api/school/student/results');
    const results = data ?? [];
    const base = all.data ?? [];

    const groups = useMemo(() => {
        const map = new Map<string, { title: string; items: ExamResult[] }>();
        for (const r of results) {
            const key = `${r.exams?.terms?.id ?? 'x'}_${r.exams?.academic_years?.id ?? 'x'}`;
            const title = `${r.exams?.terms?.name ?? '?'} — ${r.exams?.academic_years?.name ?? ''}`;
            map.set(key, { title, items: [...(map.get(key)?.items ?? []), r] });
        }
        // Best subject first within each term.
        return [...map.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => Number(b.percentage) - Number(a.percentage)) }));
    }, [results]);

    const all$ = (opts: { value: string; label: string }[], label: string) => [{ value: '', label }, ...opts];

    return (
        <View>
            <ChipSelect options={all$(uniqueOptions(base, (r) => r.exams?.academic_years), 'All years')} value={year} onChange={setYear} />
            <ChipSelect options={all$(uniqueOptions(base, (r) => r.exams?.terms), 'All terms')} value={term} onChange={setTerm} />
            <ChipSelect options={all$(uniqueOptions(base, (r) => r.exams?.subjects), 'All subjects')} value={subject} onChange={setSubject} />
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {loading ? (
                <LoadingView />
            ) : results.length === 0 ? (
                <EmptyState title="No results yet" description="Results appear once your teachers release exam marks." />
            ) : (
                groups.map((g) => {
                    const avg = g.items.reduce((s, r) => s + Number(r.percentage), 0) / g.items.length;
                    return (
                        <View key={g.title}>
                            <SectionLabel action={<Text style={[styles.avg, { color: scoreColor(avg) }]}>avg {formatPercent(avg, 1)}</Text>}>
                                {g.title} · {g.items.length} recorded
                            </SectionLabel>
                            <ListCard>
                                {g.items.map((r) => (
                                    <ListRow
                                        key={r.id}
                                        title={r.exams?.subjects?.name ?? '—'}
                                        subtitle={`${r.raw_score}/${r.exams?.max_score ?? '—'}${r.remarks ? ` · ${r.remarks}` : ''}`}
                                        right={
                                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                <Text style={[styles.pct, { color: scoreColor(Number(r.percentage)) }]}>{formatPercent(Number(r.percentage), 1)}</Text>
                                                <Badge label={r.grade_symbol ?? '—'} variant={Number(r.percentage) >= 50 ? 'success' : 'danger'} />
                                            </View>
                                        }
                                    />
                                ))}
                            </ListCard>
                        </View>
                    );
                })
            )}
        </View>
    );
}

function ReportCardsTab() {
    const api = useApi();
    const { data, loading, error, reload } = useApiQuery<ReportCard[]>('/api/school/student/report-cards');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [template, setTemplate] = useState<ReportTemplateId>(DEFAULT_TEMPLATE);
    const [busy, setBusy] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const download = async (rc: ReportCard) => {
        if (!rc.student_id) return;
        setBusy(rc.id);
        setDownloadError(null);
        try {
            await api.downloadAndShare(
                withQuery(`/api/reports/student/${rc.student_id}`, { term: rc.terms?.id, year: rc.academic_years?.id, template: templateParam(template) }),
                `Report_card_${fileSafe(`${rc.terms?.name ?? ''}_${rc.academic_years?.name ?? ''}`)}.pdf`,
            );
        } catch (err) {
            setDownloadError(errorMessage(err, 'Download failed'));
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={reload} />;
    const reports = data ?? [];
    if (reports.length === 0) return <EmptyState title="No report cards" description="Report cards appear once your teachers generate them." />;

    return (
        <View>
            <ChipSelect label="PDF style" options={REPORT_TEMPLATES} value={template} onChange={setTemplate} />
            {downloadError ? <Notice tone="danger" message={downloadError} onDismiss={() => setDownloadError(null)} /> : null}
            {reports.map((rc) => {
                const open = expanded === rc.id;
                const attend = rc.attendance_total > 0 ? Math.round((rc.attendance_present / rc.attendance_total) * 100) : null;
                const subjects = [...(rc.report_card_subjects ?? [])].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
                return (
                    <Card key={rc.id} style={{ marginBottom: spacing.md }}>
                        <Text style={styles.title}>
                            {rc.terms?.name ?? 'Term'} — {rc.academic_years?.name ?? 'Year'}
                        </Text>
                        <Text style={styles.sub}>{rc.grade_streams?.full_name ?? rc.grade_streams?.name ?? ''}</Text>
                        <View style={styles.stats}>
                            <Stat label="Average" value={formatPercent(rc.overall_average, 1)} color={scoreColor(rc.overall_average)} />
                            <Stat label="Position" value={rc.overall_position != null ? String(rc.overall_position) : '—'} />
                            {attend != null ? <Stat label="Attendance" value={`${attend}%`} /> : null}
                        </View>
                        <ButtonRow>
                            <Button size="sm" variant="ghost" label={open ? 'Hide details' : 'Show details'} onPress={() => setExpanded(open ? null : rc.id)} />
                            {rc.student_id ? <Button size="sm" label="Download PDF" onPress={() => void download(rc)} loading={busy === rc.id} /> : null}
                        </ButtonRow>
                        {open ? (
                            <View style={{ marginTop: spacing.sm }}>
                                {rc.comments_class_teacher ? <Comment label="Class teacher" text={rc.comments_class_teacher} /> : null}
                                {rc.comments_principal ? <Comment label="Principal" text={rc.comments_principal} /> : null}
                                {rc.behaviour_summary ? <Comment label="Conduct" text={rc.behaviour_summary} /> : null}
                                {subjects.map((s) => (
                                    <View key={s.id} style={styles.subjectRow}>
                                        <Text style={styles.subjectName} numberOfLines={1}>{s.subjects?.name ?? '—'}</Text>
                                        <Text style={styles.subjectScore}>{s.total_score ?? '—'}/{s.total_max_score ?? '—'}</Text>
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
        </View>
    );
}

function Comment({ label, text }: { label: string; text: string }) {
    return (
        <Text style={styles.comment}>
            <Text style={{ fontWeight: '700' }}>{label}: </Text>
            {text}
        </Text>
    );
}

const styles = StyleSheet.create({
    avg: { fontSize: 12, fontWeight: '800' },
    pct: { fontSize: 14, fontWeight: '800' },
    title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    statLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 2 },
    statValue: { fontSize: 16, fontWeight: '800', color: colors.foreground },
    comment: { fontSize: 12, color: colors.foreground, lineHeight: 18, marginBottom: spacing.sm },
    subjectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    subjectName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.foreground },
    subjectScore: { fontSize: 12, color: colors.muted },
});
