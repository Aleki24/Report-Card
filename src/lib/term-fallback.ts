/**
 * Which term a results view opens on: the school's current term, and when it
 * has no marks yet (the first weeks of a term), the term before it, and so on.
 * Shared by the web dashboard's results card and the app's.
 */
export interface TermLike { id: string; is_current?: boolean | null; start_date?: string | null; name?: string }

/** Newest first by start date; terms without dates keep their order at the end. */
export function termsNewestFirst<T extends TermLike>(terms: readonly T[]): T[] {
    return [...terms].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
}

/** Where to start looking: the current term, or the newest one that has begun. */
export function startingTermIndex(ordered: readonly TermLike[], today: string = new Date().toISOString().slice(0, 10)): number {
    const current = ordered.findIndex(t => t.is_current);
    if (current !== -1) return current;
    const begun = ordered.findIndex(t => !t.start_date || t.start_date <= today);
    return begun === -1 ? 0 : begun;
}
