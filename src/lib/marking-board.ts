/**
 * The marking board: for each class's open exam, how far every subject has
 * got in every stream ("Maths · 7 East — 38 of 42"), so whoever opens exams
 * can see who is behind before report-card day.
 *
 * Client-safe: no server imports. Shared with the mobile app, so imports
 * stay relative.
 */

export interface MarkingBoardCell {
    /** The paper to open: the stream's own, else the grade-wide one. */
    examId: string;
    entered: number;
    expected: number;
    /** Who is assigned this subject in this stream. */
    teachers: string[];
}

export interface MarkingBoardStream {
    id: string;
    name: string;
}

export interface MarkingBoardSubject {
    id: string;
    name: string;
    /** Keyed by stream id; a stream without the paper has no cell. */
    cells: Record<string, MarkingBoardCell>;
}

export interface MarkingBoardGrade {
    gradeId: string;
    gradeName: string;
    examType: string;
    streams: MarkingBoardStream[];
    subjects: MarkingBoardSubject[];
    entered: number;
    expected: number;
}

/** GET /api/school/exam-windows/progress */
export interface MarkingBoardResponse {
    termId: string | null;
    grades: MarkingBoardGrade[];
}

/** Share entered, 0–100; a cell nobody sits counts as done. */
export function percentEntered({ entered, expected }: { entered: number; expected: number }): number {
    return expected === 0 ? 100 : Math.min(100, Math.round((entered / expected) * 100));
}

/** Whether anything in this cell is still to enter. */
export const isBehind = (cell: Pick<MarkingBoardCell, 'entered' | 'expected'>): boolean => cell.entered < cell.expected;
