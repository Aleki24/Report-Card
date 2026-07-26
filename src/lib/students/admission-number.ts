/**
 * Auto-generated admission numbers.
 *
 * These used to read `ADM-2026-48213` — fifteen characters of mostly noise,
 * which then had to fit in a marksheet column and be read aloud in class.
 * Schools number their learners with a short running number, so a generated
 * one is now just that: the next free number, never more than five digits.
 *
 * Numbers continue from the highest one the school already uses, so a school
 * that has been numbering by hand keeps its sequence instead of restarting
 * at 1 and colliding.
 */

/** Five digits, as requested — 99999 learners is far beyond any one school. */
export const MAX_ADMISSION_NUMBER = 99999;

/** Purely numeric admission numbers, with or without leading zeros. */
const NUMERIC_ADMISSION = /^0*(\d{1,5})$/;

function numericValue(admissionNumber: string): number | null {
    const match = NUMERIC_ADMISSION.exec(admissionNumber.trim());
    if (!match) return null;
    const value = Number(match[1]);
    return value >= 1 && value <= MAX_ADMISSION_NUMBER ? value : null;
}

/**
 * The next free admission number, as a string.
 *
 * `taken` holds every admission number already in use in the school,
 * lower-cased — including any the caller is about to insert in the same
 * batch, so a bulk import doesn't hand the same number to two learners.
 * Non-numeric numbers (ADM-2026-123, KIS/001) are ignored when picking the
 * starting point but still block their own value if it happens to be numeric.
 *
 * Returns null only when all 99999 numbers are used.
 */
export function nextAdmissionNumber(taken: Set<string>): string | null {
    let highest = 0;
    for (const entry of taken) {
        const value = numericValue(entry);
        if (value !== null && value > highest) highest = value;
    }

    const isFree = (n: number) => !taken.has(String(n).toLowerCase());

    // Continue the school's existing run.
    for (let n = highest + 1; n <= MAX_ADMISSION_NUMBER; n++) {
        if (isFree(n)) return String(n);
    }
    // The tail is full (or the school numbers near the ceiling) — fill any gap.
    for (let n = 1; n <= highest; n++) {
        if (isFree(n)) return String(n);
    }
    return null;
}
