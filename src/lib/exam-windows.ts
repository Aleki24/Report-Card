import { bandForGrade, BAND_LABELS, type CurriculumBand, type GradeLike } from './curriculum-bands';

/**
 * Which exam each class is marking now (see migration
 * 20261023090000_exam_marking_windows): the shapes the API returns and how
 * classes group into levels. Client-safe and shared with the mobile app, so
 * imports stay relative; the database reads are in exam-windows-server.ts.
 */

export interface ExamWindow {
    grade_id: string;
    exam_type: string;
}

/** A class with scheduled exams this term, and which ones. */
export interface ExamClass {
    grade_id: string;
    name: string;
    code: string | null;
    /** Scheduled exam types this class has this term, in running order. */
    types: string[];
    /** When each of those exams starts (YYYY-MM-DD): its earliest paper. */
    dates: Record<string, string>;
}

/** Teachers waiting for an exam to be opened in a class. */
export interface ExamRequest {
    grade_id: string;
    names: string[];
    /** ISO time of the latest request. */
    latest: string;
}

/** GET /api/school/exam-windows */
export interface ExamWindowsResponse {
    termId: string | null;
    termName: string | null;
    data: ExamWindow[];
    /** Whether the caller can open exams (marking.open). */
    canOpen: boolean;
    /** For those who can open exams: every class with scheduled exams this term. */
    classes: ExamClass[];
    /** For those who can open exams: who is waiting, per class. */
    requests: ExamRequest[];
    /** Classes the caller has asked about and is still waiting on. */
    myRequests: string[];
    /** Set when the term's marks are locked: nobody can change them until it is unlocked. */
    lock: TermLock | null;
}

export interface TermLock {
    /** ISO time. */
    lockedAt: string;
    lockedBy: string | null;
}

/** A level's key for grouping classes; classes we can't place share one group. */
export type LevelKey = CurriculumBand | 'OTHER';

export const LEVEL_ORDER: readonly LevelKey[] = [
    'CBC_PRE_PRIMARY', 'CBC_LOWER_PRIMARY', 'CBC_UPPER_PRIMARY', 'CBC_JUNIOR_SCHOOL', 'CBC_SENIOR_SCHOOL',
    '844_PRIMARY', '844_SECONDARY', 'OTHER',
];

export function levelOf(grade: GradeLike): LevelKey {
    return bandForGrade(grade) ?? 'OTHER';
}

export function levelLabel(level: LevelKey): string {
    return level === 'OTHER' ? 'Other classes' : BAND_LABELS[level];
}

/** PATCH /api/school/exam-windows: when an exam starts for some classes. */
export interface ExamDateUpdate {
    termId: string;
    gradeIds: string[];
    examType: string;
    /** YYYY-MM-DD */
    date: string;
}
