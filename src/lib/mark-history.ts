/**
 * A mark's change history (see migration 20261023120000_exam_mark_history).
 * Client-safe and shared with the mobile app, so imports stay relative.
 */

export type MarkChangeAction = 'entered' | 'changed' | 'removed';

export interface MarkChange {
    id: number;
    studentId: string;
    studentName: string;
    action: MarkChangeAction;
    oldScore: number | null;
    newScore: number | null;
    oldGrade: string | null;
    newGrade: string | null;
    /** Who saved it; null for a recalculation or before names were recorded. */
    changedBy: string | null;
    /** ISO time. */
    changedAt: string;
}

/** GET /api/school/exam-marks/history */
export interface MarkHistoryResponse {
    data: MarkChange[];
    /** False until the migration is applied: nothing is recorded yet. */
    recording: boolean;
}

const score = (value: number | null, grade: string | null): string =>
    value === null ? '—' : `${value}${grade ? ` (${grade})` : ''}`;

/** "45 (C) → 52 (B-)", "Entered 52 (B-)", "Removed 45 (C)" */
export function describeMarkChange(change: Pick<MarkChange, 'action' | 'oldScore' | 'newScore' | 'oldGrade' | 'newGrade'>): string {
    switch (change.action) {
        case 'entered': return `Entered ${score(change.newScore, change.newGrade)}`;
        case 'removed': return `Removed ${score(change.oldScore, change.oldGrade)}`;
        default: return `${score(change.oldScore, change.oldGrade)} → ${score(change.newScore, change.newGrade)}`;
    }
}
