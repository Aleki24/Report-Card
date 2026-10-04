import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import type { AcademicYear, GradeStream, Term } from '@/lib/types';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';
import { Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice } from '@/components/ui';

/** GET /api/reports/term-comparison (src/app/api/reports/term-comparison/route.ts). */
interface TermSummary { mean: number | null; pass_rate: number | null; mark_count: number }
interface SubjectComparison { subject_id: string; subject_name: string; base: number | null; compare: number | null; change: number | null }
interface TermComparisonResponse { pass_mark: number; base: TermSummary; compare: TermSummary; subjects: SubjectComparison[] }

function chronological(terms: readonly Term[]): Term[] {
    return [...terms].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
}

function Change({ value, unit = '%' }: { value: number | null; unit?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    if (value == null) return <Text style={styles.changeNone}>–</Text>;
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    const color = value > 0 ? colors.success : value < 0 ? colors.danger : colors.muted;
    return (
        <View style={styles.change}>
            <Icon size={14} color={color} />
            <Text style={[styles.changeText, { color }]}>{value > 0 ? '+' : ''}{value}{unit}</Text>
        </View>
    );
}

function Figure({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
    const styles = useStyles();
    return (
        <View style={styles.figure}>
            <Text style={styles.figureLabel} numberOfLines={2}>{label}</Text>
            <View style={{ marginTop: 2 }}>{children}</View>
            {sub ? <Text style={styles.figureSub}>{sub}</Text> : null}
        </View>
    );
}

/** The web's TermComparisonModal: how one class moved between two terms, overall and by subject. */
export function CompareTerms({ years, terms, streams, initialStreamId, initialTermId }: {
    years: readonly AcademicYear[];
    terms: readonly Term[];
    streams: readonly GradeStream[];
    initialStreamId: string | null;
    initialTermId: string | null;
}) {
    const styles = useStyles();
    const ordered = useMemo(() => chronological(terms), [terms]);
    const [streamId, setStreamId] = useState<string | null>(initialStreamId ?? (streams.length === 1 ? streams[0].id : null));
    const [compareTermId, setCompareTermId] = useState<string | null>(initialTermId ?? ordered.at(-1)?.id ?? null);
    // The term before the one being looked at, by default.
    const [baseTermId, setBaseTermId] = useState<string | null>(() => {
        const at = ordered.findIndex((t) => t.id === (initialTermId ?? ordered.at(-1)?.id));
        return at > 0 ? ordered[at - 1].id : null;
    });

    const termLabel = (id: string | null) => {
        const term = terms.find((t) => t.id === id);
        const year = years.find((y) => y.id === term?.academic_year_id);
        return term ? [term.name, year?.name].filter(Boolean).join(' · ') : '';
    };
    const termOptions = ordered.map((t) => ({ value: t.id, label: termLabel(t.id) }));
    const sameTerm = !!baseTermId && baseTermId === compareTermId;
    const ready = !!streamId && !!baseTermId && !!compareTermId && !sameTerm;
    const query = useApiQuery<TermComparisonResponse>(
        ready ? withQuery('/api/reports/term-comparison', { grade_stream_id: streamId, base_term_id: baseTermId, compare_term_id: compareTermId }) : null,
        { raw: true },
    );
    const data = query.data;
    const meanChange = data?.base.mean != null && data.compare.mean != null ? data.compare.mean - data.base.mean : null;
    const passChange = data?.base.pass_rate != null && data.compare.pass_rate != null ? data.compare.pass_rate - data.base.pass_rate : null;

    return (
        <>
            <Text style={styles.intro}>The class’s average over every exam it sat each term, overall and by subject.</Text>
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={setStreamId} />
            <ChipSelect label="From" options={termOptions} value={baseTermId} onChange={setBaseTermId} />
            <ChipSelect label="To" options={termOptions} value={compareTermId} onChange={setCompareTermId} />
            {sameTerm ? <Notice tone="warning" message="Choose two different terms to compare." /> : null}

            {!ready ? (
                sameTerm ? null : <Card><EmptyState title="Choose a class and two terms" /></Card>
            ) : query.loading ? <LoadingView /> : query.error ? (
                <ErrorBanner message={query.error} onRetry={query.reload} />
            ) : data ? (
                <>
                    {data.base.mark_count === 0 || data.compare.mark_count === 0 ? (
                        <Notice tone="warning" message={`${data.base.mark_count === 0 ? termLabel(baseTermId) : termLabel(compareTermId)} has no marks for this class, so there is nothing to compare it with yet.`} />
                    ) : null}
                    <View style={styles.figures}>
                        <Figure label={termLabel(baseTermId)} sub={`${data.base.mark_count.toLocaleString()} marks`}>
                            <Text style={styles.figureValue}>{data.base.mean != null ? `${data.base.mean}%` : '–'}</Text>
                        </Figure>
                        <Figure label={termLabel(compareTermId)} sub={`${data.compare.mark_count.toLocaleString()} marks`}>
                            <Text style={styles.figureValue}>{data.compare.mean != null ? `${data.compare.mean}%` : '–'}</Text>
                        </Figure>
                        <Figure label="Average change"><Change value={meanChange} /></Figure>
                        <Figure label="Pass rate change" sub={`Pass mark ${data.pass_mark}%`}><Change value={passChange} unit=" pts" /></Figure>
                    </View>
                    {data.subjects.length > 0 ? (
                        <Card style={styles.table}>
                            <View style={[styles.tr, styles.thead]}>
                                <Text style={[styles.th, { flex: 1 }]}>SUBJECT</Text>
                                <Text style={[styles.th, styles.num]}>FROM</Text>
                                <Text style={[styles.th, styles.num]}>TO</Text>
                                <Text style={[styles.th, styles.changeCol]}>CHANGE</Text>
                            </View>
                            {data.subjects.map((s) => (
                                <View key={s.subject_id} style={styles.tr}>
                                    <Text style={[styles.td, { flex: 1, fontFamily: fonts.medium }]} numberOfLines={1}>{s.subject_name}</Text>
                                    <Text style={[styles.td, styles.num]}>{s.base != null ? `${s.base}%` : '–'}</Text>
                                    <Text style={[styles.td, styles.num]}>{s.compare != null ? `${s.compare}%` : '–'}</Text>
                                    <View style={styles.changeCol}><Change value={s.change} /></View>
                                </View>
                            ))}
                        </Card>
                    ) : null}
                </>
            ) : null}
        </>
    );
}

const useStyles = makeStyles((colors) => ({
    intro: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.md },
    figures: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    figure: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    figureLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.muted, textAlign: 'center' },
    figureValue: { fontSize: 20, fontFamily: fonts.display, color: colors.foreground },
    figureSub: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    changeText: { fontSize: 14, fontFamily: fonts.semibold },
    changeNone: { fontSize: 14, color: colors.placeholder },
    table: { padding: 0, overflow: 'hidden' },
    tr: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    thead: { backgroundColor: colors.mutedBg },
    th: { fontSize: 10, fontFamily: fonts.semibold, color: colors.muted, letterSpacing: 0.6 },
    td: { fontSize: 14, fontFamily: fonts.regular, color: colors.foreground },
    num: { width: 48, textAlign: 'right' },
    changeCol: { width: 64, alignItems: 'flex-end' },
}));
