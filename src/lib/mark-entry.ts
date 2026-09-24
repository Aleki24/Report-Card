/**
 * mark-entry.ts
 * Pure helpers behind the mark sheet: what a row holds, whether it is valid,
 * and whether it differs from what is already saved.
 *
 * The sheet lists every learner with their saved mark filled in, and the
 * teacher's edits sit on top of it. Keeping "saved" and "edited" apart is what
 * lets a mistake be corrected in place — overtype the score, save — and lets
 * the sheet say exactly which rows are about to change.
 *
 * Client-safe: no server imports.
 */

import type { ExamSubjectComponent } from '@/types';

/** What the teacher can type for one learner. Everything is kept as text so a half-typed "4" or "" is representable. */
export interface EntryValues {
    score: string;
    /** Per-paper scores keyed by component id (multi-paper exams only). */
    componentScores: Record<string, string>;
    grade: string;
    remarks: string;
    /** The teacher picked the grade by hand, so a score change must not overwrite it. */
    gradeOverridden: boolean;
}

/** A mark already stored on the server. */
export interface SavedMark extends EntryValues {
    /** exam_marks row id; absent for a mark queued offline and not yet synced. */
    id?: string;
}

/**
 * - `saved`   — on the server, untouched
 * - `changed` — on the server, edited here and not yet saved
 * - `new`     — typed here, not on the server yet
 * - `removing`— on the server, cleared here: saving removes it
 * - `empty`   — nothing entered
 */
export type RowStatus = 'saved' | 'changed' | 'new' | 'removing' | 'empty';

export const emptyEntry = (): EntryValues => ({
    score: '',
    componentScores: {},
    grade: '',
    remarks: '',
    gradeOverridden: false,
});

/** Format a stored number for an input without trailing ".00" noise. */
export function scoreToText(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
}

/** Whether the row carries a score (single paper) or at least one paper score. */
export function hasScore(values: EntryValues, components: readonly ExamSubjectComponent[]): boolean {
    if (components.length > 0) {
        return components.some(c => (values.componentScores[c.id] ?? '').trim() !== '');
    }
    return values.score.trim() !== '';
}

/** Compare the parts of a row that are stored — the override flag is UI state only. */
export function sameEntry(a: EntryValues, b: EntryValues, components: readonly ExamSubjectComponent[]): boolean {
    const norm = (s: string) => s.trim();
    const num = (s: string) => (norm(s) === '' ? '' : String(Number(norm(s))));
    if (norm(a.grade) !== norm(b.grade) || norm(a.remarks) !== norm(b.remarks)) return false;
    if (components.length > 0) {
        return components.every(c => num(a.componentScores[c.id] ?? '') === num(b.componentScores[c.id] ?? ''));
    }
    return num(a.score) === num(b.score);
}

export function rowStatus(
    saved: SavedMark | undefined,
    edit: EntryValues | undefined,
    components: readonly ExamSubjectComponent[],
): RowStatus {
    if (!edit) return saved ? 'saved' : 'empty';
    const filled = hasScore(edit, components);
    if (saved) {
        if (!filled) return 'removing';
        return sameEntry(saved, edit, components) ? 'saved' : 'changed';
    }
    return filled ? 'new' : 'empty';
}

/** Validate a row's scores against the exam (or paper) maximum. Returns a message, or null when valid. */
export function validateEntry(
    values: EntryValues,
    maxScore: number,
    components: readonly ExamSubjectComponent[],
): string | null {
    const check = (raw: string, max: number, label: string): string | null => {
        const text = raw.trim();
        if (text === '') return null;
        const n = Number(text);
        if (!Number.isFinite(n)) return `${label} must be a number`;
        if (n < 0 || n > max) return `${label} must be between 0 and ${max}`;
        return null;
    };

    if (components.length > 0) {
        for (const c of components) {
            const error = check(values.componentScores[c.id] ?? '', Number(c.max_score), c.component_code);
            if (error) return error;
        }
        return null;
    }
    return check(values.score, maxScore, 'Score');
}
