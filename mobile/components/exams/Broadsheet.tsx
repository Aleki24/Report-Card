import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatPercent, pluralize, scoreColor } from '@/lib/format';
import type { GradeStream } from '@/lib/types';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';
import { Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, SearchField } from '@/components/ui';

/** One row of GET /api/school/exam-marks/stream (the parts used here). */
interface StreamMark {
    student_id: string;
    percentage: number | string | null;
    grade_symbol: string | null;
    students: { admission_number: string | null; users: { first_name: string | null; last_name: string | null } | null } | null;
    exams: { subjects: { code: string | null; name: string | null } | null } | null;
}

interface Row {
    studentId: string;
    name: string;
    admNo: string;
    subjects: Record<string, { score: number; grade: string }>;
    average: number;
    rank: number;
}

/**
 * The web's AllSubjectsView: every learner in a class against every subject,
 * best mark per subject, average over the subjects entered, and position.
 */
function aggregate(marks: readonly StreamMark[]): { rows: Row[]; subjects: string[] } {
    const byStudent = new Map<string, { name: string; admNo: string; subjects: Record<string, { score: number; grade: string }> }>();
    const subjectSet = new Set<string>();
    for (const m of marks) {
        const subject = m.exams?.subjects?.code || m.exams?.subjects?.name;
        if (!m.students || !subject) continue;
        const pct = Number(m.percentage);
        if (!Number.isFinite(pct)) continue;
        subjectSet.add(subject);
        const entry = byStudent.get(m.student_id) ?? {
            name: `${m.students.users?.first_name ?? ''} ${m.students.users?.last_name ?? ''}`.trim() || 'Unknown',
            admNo: m.students.admission_number ?? '',
            subjects: {},
        };
        const existing = entry.subjects[subject];
        if (!existing || pct > existing.score) entry.subjects[subject] = { score: pct, grade: m.grade_symbol || '–' };
        byStudent.set(m.student_id, entry);
    }
    const subjects = [...subjectSet].sort();
    const rows: Row[] = [...byStudent.entries()].map(([studentId, s]) => {
        const scores = Object.values(s.subjects).map((x) => x.score);
        const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { studentId, name: s.name, admNo: s.admNo, subjects: s.subjects, average, rank: 0 };
    });
    rows.sort((a, b) => b.average - a.average);
    rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1].average === row.average ? rows[i - 1].rank : i + 1; });
    return { rows, subjects };
}

const NAME_WIDTH = 150;
const CELL_WIDTH = 58;

export function Broadsheet({ streams }: { streams: readonly GradeStream[] }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [streamId, setStreamId] = useState<string | null>(streams[0]?.id ?? null);
    const [search, setSearch] = useState('');
    const query = useApiQuery<StreamMark[]>(streamId ? withQuery('/api/school/exam-marks/stream', { stream_id: streamId }) : null);
    const { rows, subjects } = useMemo(() => aggregate(query.data ?? []), [query.data]);
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.admNo.toLowerCase().includes(q)) : rows;
    }, [rows, search]);

    return (
        <>
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={setStreamId} />
            {query.loading ? <LoadingView /> : query.error ? (
                <ErrorBanner message={query.error} onRetry={query.reload} />
            ) : rows.length === 0 ? (
                <Card><EmptyState title="No marks yet for this class" description="Enter marks in individual exams first; every subject appears here side by side." /></Card>
            ) : (
                <>
                    <Text style={styles.summary}>{pluralize(rows.length, 'learner')} · {pluralize(subjects.length, 'subject')} · best mark per subject this year</Text>
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
