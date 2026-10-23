import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, ButtonRow, Card, ChipSelect, FilterGrid, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice } from '@/components/ui';
import { fonts, spacing, useTheme } from '@/lib/theme';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { examTypeLabel, sortExamTypes } from '@/lib/academics';
import { examClasses, examLabel, useExams, useOpenExams, useTerms } from '@/lib/useSchoolData';
import type { ExamSlot, Term } from '@/lib/types';
import { currentExamType, examTypeDates } from '@shared/exam-schedule';
import { localToday } from '@shared/local-date';
import { ExamWindowsCard } from './ExamWindowsCard';

/**
 * The web's step-by-step picker (① term → ② exam → class → subject), laid out
 * for a phone. Every step with a single option is chosen automatically, so a
 * teacher with one class and one subject lands straight on their exam.
 */
export function ExamPicker({
    onSelect,
    emptyAction,
    renderBadge,
    headerAction,
    allClasses,
    fillGaps,
    followOpen = false,
    manageOpen = false,
}: {
    onSelect: (exam: ExamSlot, term: Term | null) => void;
    /** Shown when the term has no exams (the admin's "set up exams" button). */
    emptyAction?: (term: Term, reload: () => void) => React.ReactNode;
    /** Rendered under the term picker (the admin's "new exam" button). */
    headerAction?: (term: Term, reload: () => void) => React.ReactNode;
    renderBadge?: (exam: ExamSlot) => React.ReactNode;
    /**
     * Admins: every class the school runs, so one without this exam yet (a
     * newly added level, say) is listed too instead of missing.
     */
    /** In school order (youngest first); the picker keeps that order. */
    allClasses?: readonly { key: string; label: string }[];
    /** Admins: give classes the term's exams they lack (seeding fills gaps only). */
    fillGaps?: (term: Term, examTypes: string[]) => Promise<void>;
    /**
     * Teachers entering marks: once the school has opened an exam for their
     * class, skip choosing one (class → subject → the open exam), as on the web.
     */
    followOpen?: boolean;
    /** Whoever opens exams sees the "Exam being marked" card (mark entry). */
    manageOpen?: boolean;
}) {
    const { colors } = useTheme();
    const filled = useRef(new Set<string>());
    const [filling, setFilling] = useState(false);
    const { terms, activeTermId, loading: termsLoading, error: termsError, reload: reloadTerms } = useTerms();
    const [termId, setTermId] = useState<string | null>(null);
    const effectiveTermId = termId ?? activeTermId;
    const { exams, loading, error, reload } = useExams(effectiveTermId ? { term_id: effectiveTermId } : null);

    const [examType, setExamType] = useState<string | null>(null);
    const [gradeId, setGradeId] = useState<string | null>(null);
    // A teacher choosing an exam themselves: a CAT, a correction, another term.
    const [pickAny, setPickAny] = useState(false);
    // Also read for results: the exam a class is marking is the one to show first.
    const open = useOpenExams(effectiveTermId);
    const follow = followOpen && !pickAny && open.windows.size > 0;

    const types = useMemo(() => sortExamTypes(exams.map((e) => e.exam_type)), [exams]);
    // Before one is chosen, as on the web: the exam the school opened (when
    // every open class is on the same one), else the one due by date.
    const defaultType = useMemo(() => {
        if (types.length <= 1) return types[0] ?? null;
        const opened = new Set(open.windows.values());
        const only = opened.size === 1 ? [...opened][0] : null;
        if (only && types.includes(only)) return only;
        const due = currentExamType(examTypeDates(exams), localToday());
        return due && types.includes(due) ? due : null;
    }, [types, open.windows, exams]);
    // Following the open exam, classes come first (every class the teacher has
    // exams in) and the exam follows from the class.
    const followClasses = useMemo(() => examClasses(exams), [exams]);
    const followGrade = gradeId && followClasses.some((c) => c.key === gradeId) ? gradeId : followClasses.length === 1 ? followClasses[0].key : null;
    const classTypes = useMemo(() => sortExamTypes(exams.filter((e) => e.grade_id === followGrade).map((e) => e.exam_type)), [exams, followGrade]);
    const openType = followGrade ? open.windows.get(followGrade) ?? null : null;
    const effectiveType = follow
        ? openType ?? (examType && classTypes.includes(examType) ? examType : null)
        : examType && types.includes(examType) ? examType : defaultType;
    const ofType = useMemo(() => exams.filter((e) => e.exam_type === effectiveType), [exams, effectiveType]);
    const classes = useMemo(() => {
        const withExams = examClasses(ofType);
        if (!allClasses) return withExams;
        // allClasses comes in school order (Playgroup first); classes only known from exams follow.
        const listed = new Set(allClasses.map((c) => c.key));
        return [...allClasses, ...withExams.filter((c) => !listed.has(c.key))];
    }, [ofType, allClasses]);
    const effectiveGrade = follow ? followGrade : gradeId && classes.some((c) => c.key === gradeId) ? gradeId : classes.length === 1 ? classes[0].key : null;
    const slots = useMemo(
        () => ofType.filter((e) => e.grade_id === effectiveGrade).sort((a, b) => examLabel(a).localeCompare(examLabel(b))),
        [ofType, effectiveGrade],
    );

    // A class an admin picks with no exam of this type yet gets the term's exams, then the list reloads.
    const termForFill = terms.find((t) => t.id === effectiveTermId) ?? null;
    useEffect(() => {
        if (!fillGaps || !termForFill || !effectiveType || !effectiveGrade || loading || slots.length > 0) return;
        const key = `${termForFill.id}|${effectiveType}|${effectiveGrade}`;
        if (filled.current.has(key)) return;
        filled.current.add(key);
        setFilling(true);
        fillGaps(termForFill, types).then(reload).catch(() => undefined).finally(() => setFilling(false));
    }, [fillGaps, termForFill, effectiveType, effectiveGrade, loading, slots.length, types, reload]);

    // Picking a new term starts the later steps over.
    useEffect(() => {
        setExamType(null);
        setGradeId(null);
    }, [effectiveTermId]);

    // ── Asking for an exam to be opened ──
    const api = useApi();
    const [asking, setAsking] = useState(false);
    const [askError, setAskError] = useState('');
    const askFor = async (gradeIds: string[]) => {
        if (!effectiveTermId || gradeIds.length === 0) return;
        setAsking(true);
        setAskError('');
        try {
            await api.post('/api/school/exam-windows', { termId: effectiveTermId, gradeIds });
            open.reload();
        } catch (err) {
            setAskError(errorMessage(err, 'Could not send your request'));
        } finally {
            setAsking(false);
        }
    };
    const unasked = followClasses.filter((c) => !open.windows.has(c.key) && !open.myRequests.has(c.key)).map((c) => c.key);

    if (termsLoading) return <LoadingView />;
    if (termsError) return <ErrorBanner message={termsError} onRetry={reloadTerms} />;
    if (terms.length === 0) {
        return <EmptyState title="No terms set up" description="Ask your administrator to add terms in Settings." />;
    }

    const term = terms.find((t) => t.id === effectiveTermId) ?? null;

    return (
        <>
            <ChipSelect
                label="Term"
                options={terms.map((t) => ({ value: t.id, label: t.id === activeTermId ? `${t.name} • active` : t.name }))}
                value={effectiveTermId}
                onChange={setTermId}
            />

            {manageOpen && open.data?.canOpen && open.data.termId === effectiveTermId && open.data.classes.length > 0 ? (
                <ExamWindowsCard info={open.data} onSaved={() => { open.reload(); reload(); }} />
            ) : null}
            {term && headerAction ? headerAction(term, reload) : null}
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {loading ? (
                <LoadingView />
            ) : types.length === 0 ? (
                <Card>
                    <EmptyState
                        title={`No exams set up for ${term?.name ?? 'this term'}`}
                        description={emptyAction ? undefined : 'Ask your admin to set up exams for this term.'}
                        action={term && emptyAction ? emptyAction(term, reload) : undefined}
                    />
                </Card>
            ) : follow ? (
                <>
                    <Card style={{ marginBottom: spacing.md }}>
                        <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.foreground }}>Marking now{term ? ` · ${term.name}` : ''}</Text>
                        <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, marginBottom: spacing.sm }}>
                            Choose your class and subject; the mark sheet opens on the exam your school is marking.
                        </Text>
                        {followClasses.map((c) => {
                            const type = open.windows.get(c.key);
                            const subjects = [...new Set(exams.filter((e) => e.grade_id === c.key && e.exam_type === type).map((e) => e.subject_name))].sort();
                            return (
                                <View key={c.key} style={{ paddingVertical: 4 }}>
                                    <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: colors.foreground }}>
                                        {c.label} · <Text style={{ color: type ? colors.primary : colors.warning }}>{type ? examTypeLabel(type) : open.myRequests.has(c.key) ? 'asked · waiting' : 'no exam open yet'}</Text>
                                    </Text>
                                    {subjects.length > 0 ? <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>{subjects.join(', ')}</Text> : null}
                                </View>
                            );
                        })}
                        <ButtonRow>
                            <Button size="sm" variant="ghost" label="CAT, correction or another term" onPress={() => { setPickAny(true); setExamType(null); setGradeId(null); }} />
                        </ButtonRow>
                    </Card>
                    <ChipSelect
                        label="Class"
                        options={followClasses.map((c) => ({ value: c.key, label: c.label }))}
                        value={effectiveGrade}
                        onChange={(g) => { setGradeId(g); setExamType(null); }}
                    />
                    {effectiveGrade && !openType ? (
                        <>
                            <AskForExam
                                title="Your school hasn't opened an exam for this class"
                                asked={open.myRequests.has(effectiveGrade)}
                                busy={asking}
                                error={askError}
                                onAsk={() => void askFor([effectiveGrade])}
                            />
                            <ChipSelect label="Or choose the exam" options={classTypes.map((t) => ({ value: t, label: examTypeLabel(t) }))} value={effectiveType} onChange={setExamType} />
                        </>
                    ) : null}
                </>
            ) : (
                <>
                    {followOpen && pickAny && open.windows.size > 0 ? (
                        <ButtonRow>
                            <Button size="sm" variant="ghost" label="← Back to the exam open for marking" onPress={() => { setPickAny(false); setExamType(null); setGradeId(null); }} />
                        </ButtonRow>
                    ) : null}
                    {followOpen && open.data?.termId === effectiveTermId && open.windows.size === 0 && followClasses.length > 0 ? (
                        <AskForExam
                            title="Your school hasn't chosen which exam is being marked"
                            asked={unasked.length === 0}
                            busy={asking}
                            error={askError}
                            onAsk={() => void askFor(unasked)}
                        />
                    ) : null}
                    <FilterGrid>
                        <ChipSelect label="Exam" options={types.map((t) => ({ value: t, label: examTypeLabel(t) }))} value={effectiveType} onChange={setExamType} />
                        {effectiveType ? (
                            <ChipSelect label="Class" options={classes.map((c) => ({ value: c.key, label: c.label }))} value={effectiveGrade} onChange={setGradeId} />
                        ) : null}
                    </FilterGrid>
                </>
            )}
            {!loading && types.length > 0 ? (
                <>
                    {effectiveGrade && effectiveType ? (
                        <>
                            <Text style={{ fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginBottom: 6 }}>Subject</Text>
                            {slots.length === 0 ? (
                                filling ? <LoadingView /> : <EmptyState title="No subjects for this class yet" description="Offer subjects for this class's level under Subjects, then they appear here." />
                            ) : null}
                            <ListCard>
                                {slots.map((e) => (
                                    <ListRow
                                        key={e.id}
                                        title={examLabel(e)}
                                        subtitle={`${e.name} · out of ${e.max_score}`}
                                        right={renderBadge ? renderBadge(e) : <StatusBadge status={e.status} />}
                                        onPress={() => onSelect(e, term)}
                                    />
                                ))}
                            </ListCard>
                        </>
                    ) : null}
                </>
            ) : null}
        </>
    );
}

/** A teacher's "ask for the exam to be opened", and its answer once sent. */
function AskForExam({ title, asked, busy, error, onAsk }: { title: string; asked: boolean; busy: boolean; error: string; onAsk: () => void }) {
    return (
        <View style={{ marginBottom: spacing.md }}>
            <Notice
                tone="warning"
                message={`${title}. ${asked
                    ? "You've asked: your admin, principal or DOS will see it and open the right exam."
                    : 'Ask your admin, principal or DOS to open it, so your marks go into the right exam.'}`}
            />
            {error ? <Notice tone="danger" message={error} /> : null}
            {!asked ? (
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="Ask for the exam" onPress={onAsk} loading={busy} />
                </ButtonRow>
            ) : null}
        </View>
    );
}

export function StatusBadge({ status }: { status: ExamSlot['status'] }) {
    if (status === 'APPROVED') return <Badge label="Released" variant="success" />;
    if (status === 'PENDING_APPROVAL') return <Badge label="Pending" variant="warning" />;
    return <Badge label="Draft" />;
}
