/**
 * Drafting a grading system's bands before saving: standard KCSE points
 * that follow the grade, a sensible next row, and the checks and payload
 * the academic-structure API takes. Platform-neutral: the web Grading tab
 * and the mobile app share it.
 */

export type SystemKind = 'SUBJECT' | 'OVERALL';

export interface DraftRow { symbol: string; label: string; min_percentage: string; max_percentage: string; points: string }

export const emptyRow = (): DraftRow => ({ symbol: '', label: '', min_percentage: '', max_percentage: '', points: '' });
export const firstRow = (): DraftRow => ({ symbol: 'A', label: '', min_percentage: '', max_percentage: '100', points: '12' });

// Standard KCSE 12-point scale — points follow definitively from the grade
// (A = 12, A- = 11 … E = 1), so they auto-fill and the user rarely types them.
export const STANDARD_GRADE_POINTS: Record<string, number> = {
    'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8, 'C+': 7,
    'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
};
const GRADE_SEQUENCE = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

export function pointsForSymbol(symbol: string): string {
    const p = STANDARD_GRADE_POINTS[symbol.trim().toUpperCase()];
    return p !== undefined ? String(p) : '';
}

/** The next grade down, starting just below the previous row's low bound. */
export function nextRowFrom(last: DraftRow | undefined): DraftRow {
    if (!last) return emptyRow();
    const idx = GRADE_SEQUENCE.indexOf(last.symbol.trim().toUpperCase());
    const nextSymbol = idx >= 0 && idx < GRADE_SEQUENCE.length - 1 ? GRADE_SEQUENCE[idx + 1] : '';
    const lastLow = Number(last.min_percentage);
    const nextHigh = last.min_percentage !== '' && !Number.isNaN(lastLow) ? String(lastLow - 1) : '';
    return { symbol: nextSymbol, label: '', min_percentage: '', max_percentage: nextHigh, points: pointsForSymbol(nextSymbol) };
}

/** A row edit; changing the grade refills its points (still editable afterwards). */
export function editRow(row: DraftRow, field: keyof DraftRow, value: string): DraftRow {
    const next = { ...row, [field]: value };
    if (field === 'symbol') {
        const auto = pointsForSymbol(value);
        if (auto) next.points = auto;
    }
    return next;
}

/** Checks the draft and builds the create payload, or says what to fix. */
export function gradingSystemPayload(input: { name: string; academicLevelId: string; kind: SystemKind; rows: readonly DraftRow[]; subjectIds: readonly string[] }):
    { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
    const { name, academicLevelId, kind, rows, subjectIds } = input;
    const isOverall = kind === 'OVERALL';
    if (!name.trim()) return { ok: false, error: 'Grading system name is required.' };
    if (!academicLevelId) return { ok: false, error: 'Please select an academic level.' };

    const filledRows = rows.filter(r => r.symbol.trim() || r.min_percentage !== '' || r.max_percentage !== '');
    if (filledRows.length === 0) return { ok: false, error: 'Add at least one grade row to the grading grid.' };

    const ceiling = isOverall ? 100000 : 100;
    const boundLabel = isOverall ? 'points' : '%';
    const scales = [];
    for (const r of filledRows) {
        if (!r.symbol.trim()) return { ok: false, error: 'Every row needs a grade (e.g. A, B+, E).' };
        if (r.min_percentage === '' || r.max_percentage === '') return { ok: false, error: `Row "${r.symbol}" needs both a Low and High value.` };
        const min = Number(r.min_percentage);
        const max = Number(r.max_percentage);
        if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > ceiling) return { ok: false, error: `Row "${r.symbol}": Low/High must be between 0 and ${ceiling} ${boundLabel}.` };
        if (min > max) return { ok: false, error: `Row "${r.symbol}": Low cannot be greater than High.` };
        scales.push({
            symbol: r.symbol.trim(),
            label: r.label.trim(),
            min_percentage: min,
            max_percentage: max,
            points: isOverall ? undefined : (r.points === '' ? undefined : Number(r.points)),
        });
    }

    const payload: Record<string, unknown> = { name: name.trim(), academic_level_id: academicLevelId, system_kind: kind, scales };
    if (!isOverall) payload.subject_ids = subjectIds;
    return { ok: true, payload };
}
