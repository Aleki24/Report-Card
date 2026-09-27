/**
 * Billing rules, kept pure so they can be tested and shared:
 * which fee structure applies to a learner, what a term's share of the
 * annual fee is, and how money received is spread across vote heads.
 */

export type Residence = 'DAY' | 'BOARDER';
export type StructureResidence = 'ALL' | Residence;

export interface StructureForMatch {
    id: string;
    academic_year_id: string;
    grade_id: string | null;
    residence: StructureResidence;
}

/**
 * The most specific structure for a learner in a year: one for their grade
 * beats one for every grade, and one for their residence beats `ALL`.
 */
export function pickStructure<S extends StructureForMatch>(
    structures: readonly S[],
    learner: { academicYearId: string; gradeId: string | null; residence: Residence },
): S | null {
    const score = (s: S) => {
        if (s.academic_year_id !== learner.academicYearId) return -1;
        if (s.grade_id && s.grade_id !== learner.gradeId) return -1;
        if (s.residence !== 'ALL' && s.residence !== learner.residence) return -1;
        return (s.grade_id ? 2 : 0) + (s.residence !== 'ALL' ? 1 : 0);
    };
    let best: S | null = null;
    let bestScore = -1;
    for (const s of structures) {
        const sc = score(s);
        if (sc > bestScore) { best = s; bestScore = sc; }
    }
    return best;
}

/** A term's share of an annual amount, rounded to whole shillings. */
export function termShare(annual: number, split: readonly number[], termIndex: number): number {
    const pct = split[termIndex] ?? (split.length > 0 ? 0 : 100);
    return Math.round((annual * pct) / 100);
}

export interface AllocationLine { voteHeadId: string | null; amount: number; priority: number }

/**
 * Spreads `paid` across invoice lines in ascending vote-head priority, each
 * filled before the next; anything left over is an overpayment.
 */
export function allocateByPriority(lines: readonly AllocationLine[], paid: number): { allocated: Map<string | null, number>; overpaid: number } {
    const allocated = new Map<string | null, number>();
    let left = Math.max(0, paid);
    for (const line of [...lines].sort((a, b) => a.priority - b.priority)) {
        const take = Math.min(left, Math.max(0, line.amount));
        allocated.set(line.voteHeadId, (allocated.get(line.voteHeadId) ?? 0) + take);
        left -= take;
    }
    return { allocated, overpaid: left };
}
