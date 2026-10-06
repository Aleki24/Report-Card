import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatPercent, pluralize, scoreColor } from '@/lib/format';
import type { GradeStream } from '@/lib/types';
import { useTerms } from '@/lib/useSchoolData';
import {
    ALL_EXAMS, broadsheetExamName, broadsheetExamTypes, broadsheetTermIds, buildBroadsheet, defaultBroadsheetFilter, type BroadsheetMark,
} from '@shared/broadsheet';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';
import { Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, SearchField } from '@/components/ui';

const NAME_WIDTH = 150;
const CELL_WIDTH = 58;

export function Broadsheet({ streams }: { streams: readonly GradeStream[] }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [streamId, setStreamId] = useState<string | null>(streams[0]?.id ?? null);
    const [search, setSearch] = useState('');
    const query = useApiQuery<BroadsheetMark[]>(streamId ? withQuery('/api/school/exam-marks/stream', { stream_id: streamId }) : null);
    const marks = useMemo(() => query.data ?? [], [query.data]);
    const { terms, activeTermId } = useTerms();
    // Picks are per class: null until chosen, then the class's latest term and exam stand in.
    const [picked, setPicked] = useState<{ streamId: string | null; termId: string | null; examType: string | null }>({ streamId: null, termId: null, examType: null });
    const fallback = useMemo(() => defaultBroadsheetFilter(marks, terms.map((t) => t.id), activeTermId), [marks, terms, activeTermId]);
    const own = picked.streamId === streamId ? picked : { termId: null, examType: null };
    const termIds = useMemo(() => broadsheetTermIds(marks), [marks]);
    const termId = own.termId && termIds.has(own.termId) ? own.termId : fallback.termId;
    const examTypes = useMemo(() => broadsheetExamTypes(marks, termId), [marks, termId]);
    // The term's latest exam unless another (or all of them) was picked.
    const examType = own.examType === ALL_EXAMS ? null
        : own.examType && examTypes.includes(own.examType) ? own.examType
        : examTypes[examTypes.length - 1] ?? null;
    const { rows, subjects } = useMemo(() => buildBroadsheet(marks, { termId, examType }), [marks, termId, examType]);
    const termName = terms.find((t) => t.id === termId)?.name ?? 'This term';
    const termOptions = terms.filter((t) => termIds.has(t.id)).map((t) => ({ value: t.id, label: t.name }));
    const examOptions = [...examTypes.map((t) => ({ value: t, label: broadsheetExamName(t) })), ...(examTypes.length > 1 ? [{ value: ALL_EXAMS, label: broadsheetExamName(null) }] : [])];
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.admNo.toLowerCase().includes(q)) : rows;
    }, [rows, search]);

    return (
        <>
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={setStreamId} />
            {termOptions.length > 0 ? (
                <View style={styles.filters}>
                    <View style={{ flex: 1 }}>
                        <ChipSelect label="Term" options={termOptions} value={termId} onChange={(t) => setPicked({ streamId, termId: t, examType: null })} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <ChipSelect label="Exam" options={examOptions} value={examType ?? ALL_EXAMS} onChange={(e) => setPicked({ streamId, termId, examType: e })} />
                    </View>
                </View>
            ) : null}
            {query.loading ? <LoadingView /> : query.error ? (
                <ErrorBanner message={query.error} onRetry={query.reload} />
            ) : rows.length === 0 ? (
                <Card><EmptyState title="No marks yet for this class" description="Enter marks for an exam first; every subject then appears here side by side." /></Card>
            ) : (
                <>
                    <Text style={styles.summary}>{termName} · {broadsheetExamName(examType)} · {pluralize(rows.length, 'learner')} · {pluralize(subjects.length, 'subject')}</Text>
                    <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or admission no." />
                    <View style={styles.table}>
                        {/* Names stay put while the subject columns scroll sideways. */}
                        <View style={{ width: NAME_WIDTH }}>
                            <View style={[styles.cell, styles.head, { width: NAME_WIDTH, alignItems: 'flex-start' }]}><Text style={styles.headText}>Learner</Text></View>
                            {shown.map((r) => (
                                <View key={r.studentId} style={[styles.cell, styles.nameCell]}>
                                    <Text style={styles.rank}>{r.rank}</Text>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                                        {r.admNo ? <Text style={styles.adm} numberOfLines={1}>{r.admNo}</Text> : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator>
                            <View>
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={[styles.cell, styles.head, styles.avgCol]}><Text style={styles.headText}>Avg</Text></View>
                                    {subjects.map((s) => (
                                        <View key={s} style={[styles.cell, styles.head]}><Text style={styles.headText} numberOfLines={1}>{s}</Text></View>
                                    ))}
                                </View>
                                {shown.map((r) => (
                                    <View key={r.studentId} style={{ flexDirection: 'row' }}>
                                        <View style={[styles.cell, styles.avgCol]}>
                                            <Text style={[styles.score, { color: scoreColor(colors, r.average), fontFamily: fonts.bold }]}>{formatPercent(r.average)}</Text>
                                        </View>
                                        {subjects.map((s) => {
                                            const mark = r.subjects[s];
                                            return (
                                                <View key={s} style={styles.cell}>
                                                    {mark ? (
                                                        <>
                                                            <Text style={[styles.score, { color: scoreColor(colors, mark.score) }]}>{Math.round(mark.score)}</Text>
                                                            <Text style={styles.grade}>{mark.grade}</Text>
                                                        </>
                                                    ) : <Text style={styles.empty}>–</Text>}
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </>
            )}
        </>
    );
}

const ROW_HEIGHT = 48;

const useStyles = makeStyles((colors) => ({
    filters: { flexDirection: 'row', gap: spacing.sm },
    summary: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm },
    table: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cell: { width: CELL_WIDTH, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    head: { height: 36, backgroundColor: colors.mutedBg },
    headText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted },
    nameCell: { width: NAME_WIDTH, flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
    rank: { width: 22, fontSize: 12, fontFamily: fonts.bold, color: colors.muted, textAlign: 'center' },
    name: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    adm: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
    avgCol: { backgroundColor: colors.primarySoft },
    score: { fontSize: 13, fontFamily: fonts.semibold },
    grade: { fontSize: 10, fontFamily: fonts.medium, color: colors.muted },
    empty: { fontSize: 13, color: colors.placeholder },
}));
