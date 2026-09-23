import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView } from '@/components/ui';
import { colors } from '@/lib/theme';
import { examTypeLabel, sortExamTypes } from '@/lib/academics';
import { examClasses, examLabel, useExams, useTerms } from '@/lib/useSchoolData';
import type { ExamSlot, Term } from '@/lib/types';

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
}: {
    onSelect: (exam: ExamSlot, term: Term | null) => void;
    /** Shown when the term has no exams (the admin's "set up exams" button). */
    emptyAction?: (term: Term, reload: () => void) => React.ReactNode;
    /** Rendered under the term picker (the admin's "new exam" button). */
    headerAction?: (term: Term, reload: () => void) => React.ReactNode;
    renderBadge?: (exam: ExamSlot) => React.ReactNode;
}) {
    const { terms, activeTermId, loading: termsLoading, error: termsError, reload: reloadTerms } = useTerms();
    const [termId, setTermId] = useState<string | null>(null);
    const effectiveTermId = termId ?? activeTermId;
    const { exams, loading, error, reload } = useExams(effectiveTermId ? { term_id: effectiveTermId } : null);

    const [examType, setExamType] = useState<string | null>(null);
    const [gradeId, setGradeId] = useState<string | null>(null);

    const types = useMemo(() => sortExamTypes(exams.map((e) => e.exam_type)), [exams]);
    const effectiveType = examType && types.includes(examType) ? examType : types.length === 1 ? types[0] : null;
    const ofType = useMemo(() => exams.filter((e) => e.exam_type === effectiveType), [exams, effectiveType]);
    const classes = useMemo(() => examClasses(ofType), [ofType]);
    const effectiveGrade = gradeId && classes.some((c) => c.key === gradeId) ? gradeId : classes.length === 1 ? classes[0].key : null;
    const slots = useMemo(
        () => ofType.filter((e) => e.grade_id === effectiveGrade).sort((a, b) => examLabel(a).localeCompare(examLabel(b))),
        [ofType, effectiveGrade],
    );

    // Picking a new term starts the later steps over.
    useEffect(() => {
        setExamType(null);
        setGradeId(null);
    }, [effectiveTermId]);

    if (termsLoading) return <LoadingView />;
    if (termsError) return <ErrorBanner message={termsError} onRetry={reloadTerms} />;
    if (terms.length === 0) {
        return <EmptyState title="No terms set up" description="Ask your administrator to add terms in Settings." />;
    }

    const term = terms.find((t) => t.id === effectiveTermId) ?? null;

    return (
        <>
            <ChipSelect
                label="① Term"
                options={terms.map((t) => ({ value: t.id, label: t.id === activeTermId ? `${t.name} • active` : t.name }))}
                value={effectiveTermId}
                onChange={setTermId}
            />

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
            ) : (
                <>
                    <ChipSelect label="② Exam" options={types.map((t) => ({ value: t, label: examTypeLabel(t) }))} value={effectiveType} onChange={setExamType} />
                    {effectiveType ? (
                        <ChipSelect label="③ Class" options={classes.map((c) => ({ value: c.key, label: c.label }))} value={effectiveGrade} onChange={setGradeId} />
                    ) : null}
                    {effectiveGrade ? (
                        <>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>④ Subject</Text>
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
            )}
        </>
    );
}

export function StatusBadge({ status }: { status: ExamSlot['status'] }) {
    if (status === 'APPROVED') return <Badge label="Released" variant="success" />;
    if (status === 'PENDING_APPROVAL') return <Badge label="Pending" variant="warning" />;
    return <Badge label="Draft" />;
}
