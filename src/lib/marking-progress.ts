/**
 * Shared shapes for a teacher's marking progress: how far each exam in the
 * current term has got, so the dashboard can say "Maths · Form 2 East —
 * 31 of 40 entered" and open that exam's mark sheet in one tap.
 *
 * Client-safe: no server imports. Shared with the mobile app, so imports
 * stay relative.
 */

import { isAnytimeExamType } from './exam-types';

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
    /** The exam the school has opened for marking in this class. */
    isOpen: boolean;
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

export interface MarkingSummary {
    /** The exams that count now: the open ones and those given any time, or every exam until the school opens one. */
    current: MarkingProgressItem[];
    /** Marks still to enter across `current`. */
    left: number;
    complete: number;
    /** Where to carry on: started but unfinished, else the first not started. */
    next: MarkingProgressItem | null;
}

/**
 * A teacher's marking now. Once the school opens exams for marking, an
 * End-Term nobody has sat yet stops counting as work left.
 */
export function summarizeMarking(items: readonly MarkingProgressItem[]): MarkingSummary {
    const anyOpen = items.some(i => i.isOpen);
    const current = anyOpen ? items.filter(i => i.isOpen || isAnytimeExamType(i.examType)) : [...items];
    let left = 0;
    let complete = 0;
    for (const i of current) {
        left += Math.max(0, i.expected - i.entered);
        if (markingState(i) === 'complete') complete++;
    }
    const next = current.find(i => markingState(i) === 'in-progress') ?? current.find(i => markingState(i) === 'not-started') ?? null;
    return { current, left, complete, next };
}
