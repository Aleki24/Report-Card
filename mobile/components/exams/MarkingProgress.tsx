import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ListChecks } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { examTypeName } from '@/lib/academics';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { ErrorBanner, ProgressBar, ToggleRow } from '@/components/ui';
import { isBehind, percentEntered, type MarkingBoardCell, type MarkingBoardResponse } from '@shared/marking-board';

/**
 * The web's marking progress board, for whoever opens exams: for each class's
 * open exam, how far every subject has got in every stream and who teaches
 * it. Tapping a stream opens its mark sheet.
 */
export function MarkingProgress({ termId, termName, onOpenExam }: { termId: string; termName: string; onOpenExam: (examId: string) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [open, setOpen] = useState(false);
    const [onlyBehind, setOnlyBehind] = useState(true);
    const query = useApiQuery<MarkingBoardResponse>(withQuery('/api/school/exam-windows/progress', { term_id: termId }), { raw: true });
    const grades = query.data?.termId === termId ? query.data.grades : null;
    if (grades && grades.length === 0) return null;

    let entered = 0;
    let expected = 0;
    let behind = 0;
    let notStarted = 0;
    for (const g of grades ?? []) {
        entered += g.entered;
        expected += g.expected;
        for (const s of g.subjects) for (const c of Object.values(s.cells)) {
            if (!isBehind(c)) continue;
            behind++;
            if (c.entered === 0) notStarted++;
        }
    }
    const summary = !grades
        ? query.error ? `Couldn’t load: ${query.error}` : 'Counting marks…'
        : behind === 0
            ? `All ${expected.toLocaleString()} marks are in for the open exams.`
            : `${entered.toLocaleString()} of ${expected.toLocaleString()} marks in · ${behind} ${behind === 1 ? 'sheet' : 'sheets'} unfinished${notStarted > 0 ? `, ${notStarted} not started` : ''}`;
    const cellTone = (c: MarkingBoardCell) =>
        !isBehind(c) ? { bg: colors.successBg, fg: colors.successText } : c.entered === 0 ? { bg: colors.dangerBg, fg: colors.danger } : { bg: colors.warningBg, fg: colors.warningText };

    return (
        <View style={styles.box}>
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.head}>
                <View style={[styles.icon, { backgroundColor: behind > 0 ? colors.warningBg : colors.successBg }]}>
                    <ListChecks size={18} color={behind > 0 ? colors.warningText : colors.successText} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={styles.title}>Marking progress · {termName}</Text>
                    <Text style={styles.sub}>{summary}</Text>
                    {grades ? <ProgressBar value={percentEntered({ entered, expected })} /> : null}
                </View>
                <ChevronDown size={16} color={colors.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>
            {query.error && !grades ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {open && grades ? (
                <View style={styles.body}>
                    <ToggleRow label="Only unfinished subjects" value={onlyBehind} onValueChange={setOnlyBehind} />
                    {grades.map((grade) => {
                        const subjects = onlyBehind ? grade.subjects.filter((s) => Object.values(s.cells).some(isBehind)) : grade.subjects;
                        const pct = percentEntered(grade);
                        return (
                            <View key={grade.gradeId} style={styles.grade}>
                                <View style={styles.gradeHead}>
                                    <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
                                        {grade.gradeName} <Text style={styles.sub}>· {examTypeName(grade.examType)}</Text>
                                    </Text>
                                    <Text style={styles.sub}>{pct}%</Text>
                                </View>
                                {subjects.length === 0 ? (
                                    <Text style={[styles.sub, { color: colors.successText, padding: spacing.sm }]}>Every subject is fully marked.</Text>
                                ) : (
                                    subjects.map((subject) => (
                                        <View key={subject.id} style={styles.subject}>
                                            <Text style={styles.subjectName}>{subject.name}</Text>
                                            <View style={styles.cells}>
                                                {grade.streams.map((stream) => {
                                                    const cell = subject.cells[stream.id];
                                                    if (!cell || cell.expected === 0) return null;
                                                    const tone = cellTone(cell);
                                                    const teacher = `${cell.teachers[0] ?? 'No teacher'}${cell.teachers.length > 1 ? ` +${cell.teachers.length - 1}` : ''}`;
                                                    return (
                                                        <Pressable
                                                            key={stream.id}
                                                            onPress={() => onOpenExam(cell.examId)}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`${subject.name}, ${stream.name}: ${cell.entered} of ${cell.expected} marks, ${teacher}`}
                                                            style={[styles.cell, { backgroundColor: tone.bg }]}
                                                        >
                                                            <Text style={[styles.cellTop, { color: tone.fg }]}>{stream.name} · {cell.entered}/{cell.expected}</Text>
                                                            <Text style={[styles.cellSub, { color: tone.fg }]} numberOfLines={1}>{teacher}</Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, marginBottom: spacing.md, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
    icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    body: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.md },
    grade: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
    gradeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.mutedBg },
    subject: { padding: spacing.sm, gap: 6, borderTopWidth: 1, borderTopColor: colors.border },
    subjectName: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    cell: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 160 },
    cellTop: { fontSize: 12, fontFamily: fonts.bold },
    cellSub: { fontSize: 11, fontFamily: fonts.regular },
}));
