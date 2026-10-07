import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CheckCircle2, ClipboardList, EyeOff } from 'lucide-react-native';
import { Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, LoadingView, Notice, ProgressBar, StatGrid, StatTile } from '@/components/ui';
import { spacing, fonts, makeStyles, radius, useTheme } from '@/lib/theme';
import { examTypeName, sortExamTypes } from '@/lib/academics';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { pluralize } from '@/lib/format';
import { confirmAlert } from '@/lib/confirm';
import { useExams, useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { ReleaseControl } from './ReleaseControl';
import { useReleasePapers } from './useReleasePapers';
import type { ExamSlot } from '@/lib/types';

/** The part of GET /api/school/exam-marks/stream used to count marks per exam. */
interface MarkRef { exam_id: string }

const isReleased = (e: ExamSlot) => e.status !== 'DRAFT';

/**
 * Release results, as on the web: choose a class, term and exam, see which
 * subjects have marks and which learners can already see, then release them
 * one at a time or all the marked ones at once.
 */
export function PublishList({ onChanged }: { onChanged?: () => void }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { streams, loading: streamsLoading } = useGradeStreams();
    const { terms, activeTermId, loading: termsLoading } = useTerms();
    const [streamPick, setStreamPick] = useState<string | null>(null);
    const [termPick, setTermPick] = useState<string | null>(null);
    const [typePick, setTypePick] = useState<string | null>(null);
    const { release, busy } = useReleasePapers();
    const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

    const stream = streams.find((s) => s.id === streamPick) ?? (streams.length === 1 ? streams[0] : null);
    const termId = termPick ?? activeTermId;
    const examsQuery = useExams(stream && termId ? { term_id: termId, stream_id: stream.id, grade_id: stream.grade_id } : null);
    const termExams = examsQuery.exams;

    // Marks for the term (any of its exams scopes the endpoint to the term), counted per exam.
    const marksQuery = useApiQuery<MarkRef[]>(stream && termExams[0] ? withQuery('/api/school/exam-marks/stream', { stream_id: stream.id, exam_id: termExams[0].id }) : null);
    const markedByExam = useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of marksQuery.data ?? []) counts.set(m.exam_id, (counts.get(m.exam_id) ?? 0) + 1);
        return counts;
    }, [marksQuery.data]);

    const types = useMemo(() => sortExamTypes(termExams.map((e) => e.exam_type)), [termExams]);
    // The chosen exam while it exists, else the latest one with marks, else the first.
    const examType = typePick && types.includes(typePick) ? typePick
        : [...types].reverse().find((t) => termExams.some((e) => e.exam_type === t && (markedByExam.get(e.id) ?? 0) > 0)) ?? types[0] ?? null;
    const exams = useMemo(
        () => termExams.filter((e) => e.exam_type === examType).sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
        [termExams, examType],
    );
    const released = exams.filter(isReleased);
    const marked = exams.filter((e) => (markedByExam.get(e.id) ?? 0) > 0);
    const releasable = exams.filter((e) => !isReleased(e) && (markedByExam.get(e.id) ?? 0) > 0);
    const unmarkedHidden = exams.filter((e) => !isReleased(e)).length - releasable.length;

    const reload = () => { examsQuery.reload(); marksQuery.reload(); onChanged?.(); };

    const releaseAll = () => {
        if (releasable.length === 0) return;
        const skip = unmarkedHidden > 0 ? ` ${pluralize(unmarkedHidden, 'subject')} with no marks yet stay hidden.` : '';
        confirmAlert(`Release ${pluralize(releasable.length, 'subject')}?`, `Learners and parents will see these marks. A learner with no mark in a subject simply won't see it.${skip}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Release', onPress: () => void (async () => {
                    setMessage(null);
                    setMessage(await release(releasable));
                    reload();
                })(),
            },
        ]);
    };

    if (termsLoading || streamsLoading) return <LoadingView />;
    if (streams.length === 0) return <EmptyState title="No classes yet" description="Add classes first; their exams can then be released here." />;

    return (
        <View>
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={stream?.id ?? null} onChange={setStreamPick} placeholder="Choose a class" />
            <View style={styles.filters}>
                <View style={{ flex: 1 }}>
                    <ChipSelect label="Term" options={terms.map((t) => ({ value: t.id, label: t.name }))} value={termId} onChange={(t) => { setTermPick(t); setTypePick(null); }} />
                </View>
                {types.length > 0 ? (
                    <View style={{ flex: 1 }}>
                        <ChipSelect label="Exam" options={types.map((t) => ({ value: t, label: examTypeName(t) }))} value={examType} onChange={setTypePick} />
                    </View>
                ) : null}
            </View>

            <Text style={styles.help}>Releasing a subject lets learners and parents see its marks. Staff always see every mark, marks can still be corrected, and you can withdraw a subject at any time.</Text>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {examsQuery.error ? <ErrorBanner message={examsQuery.error} onRetry={reload} /> : null}

            {!stream ? (
                <EmptyState title="Choose a class" description="Pick the class whose results you want to release." />
            ) : examsQuery.loading || marksQuery.loading ? (
                <LoadingView />
            ) : exams.length === 0 ? (
                <EmptyState title="No exams this term" description={`${stream.full_name} has no exams set up for this term yet.`} />
            ) : (
                <>
                    <Card style={{ marginBottom: spacing.md }}>
                        <Text style={styles.title}>{stream.full_name} · {examTypeName(examType ?? '')}</Text>
                        <Text style={styles.sub}>{released.length} of {pluralize(exams.length, 'subject')} released · {marked.length} have marks</Text>
                        <View style={{ marginVertical: spacing.sm }}>
                            <ProgressBar value={(released.length / exams.length) * 100} color={colors.success} />
                        </View>
                        <StatGrid>
                            <StatTile label="Released" value={released.length} icon={CheckCircle2} />
                            <StatTile label="Ready to release" value={releasable.length} icon={ClipboardList} />
                            <StatTile label="No marks yet" value={unmarkedHidden} icon={EyeOff} />
                        </StatGrid>
                        {releasable.length > 0 ? (
                            <ButtonRow>
                                <Button label={`Release ${pluralize(releasable.length, 'marked subject')}`} onPress={releaseAll} loading={busy} />
                            </ButtonRow>
                        ) : (
                            <Text style={styles.sub}>{released.length === exams.length ? 'Everything is released.' : 'Enter marks before releasing the rest.'}</Text>
                        )}
                    </Card>

                    {exams.map((e) => {
                        const count = markedByExam.get(e.id) ?? 0;
                        return (
                            <Card key={e.id} style={styles.subject}>
                                <View style={styles.subjectHead}>
                                    <Text style={styles.name} numberOfLines={1}>{e.subject_name}</Text>
                                    <Text style={[styles.count, { color: count > 0 ? colors.foreground : colors.muted }]}>
                                        {count > 0 ? `${pluralize(count, 'mark')} entered` : 'No marks yet'}
                                    </Text>
                                </View>
                                <ReleaseControl exam={e} compact onChanged={reload} />
                            </Card>
                        );
                    })}
                </>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    filters: { flexDirection: 'row', gap: spacing.sm },
    help: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
    title: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    subject: { marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.xl },
    subjectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
    name: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    count: { fontSize: 12, fontFamily: fonts.semibold },
}));
