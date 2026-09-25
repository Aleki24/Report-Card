/**
 * Shared shapes for a teacher's marking progress: how far each exam in the
 * current term has got, so the dashboard can say "Maths · Form 2 East —
 * 31 of 40 entered" and open that exam's mark sheet in one tap.
 *
 * Client-safe: no server imports.
 */

export type ExamWorkflowStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';

export interface MarkingProgressItem {
    examId: string;
    examName: string;
    examType: string;
    subjectId: string;
    subjectName: string;
    /** The stream for a single-stream exam, otherwise the grade. */
    className: string;
    termId: string;
    status: ExamWorkflowStatus;
    /** Learners who have a mark for this exam, among those the teacher records. */
    entered: number;
    /** Learners the teacher records this subject's marks for in this class. */
    expected: number;
}

export interface MarkingProgressResponse {
    term: { id: string; name: string } | null;
    items: MarkingProgressItem[];
}

/** How far an exam has got, for sorting and colouring. */
export type MarkingState = 'complete' | 'in-progress' | 'not-started' | 'no-learners';

export function markingState(item: Pick<MarkingProgressItem, 'entered' | 'expected'>): MarkingState {
    if (item.expected === 0) return 'no-learners';
    if (item.entered >= item.expected) return 'complete';
    return item.entered > 0 ? 'in-progress' : 'not-started';
}

/**
 * Deep link that opens one exam's mark sheet directly on the Mark Entry tab —
 * the one place to both enter marks and correct ones already saved.
 */
export function markEntryHref(termId: string | null | undefined, examId: string): string {
    const params = new URLSearchParams({ tab: 'setup', exam: examId });
    if (termId) params.set('term', termId);
    return `/dashboard/exams-marks?${params.toString()}`;
}
