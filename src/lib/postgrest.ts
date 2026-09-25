/**
 * Escape LIKE/ILIKE wildcards in user-supplied text so `.ilike()` matches it
 * literally. `.ilike()` is used for case-insensitive equality; without this,
 * input containing `%` or `_` becomes a pattern and can match other rows.
 */
export function escapeLikePattern(value: string): string {
    return value.replace(/([\\%_])/g, '\\$1');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a value is a UUID. Check before interpolating request input into a
 * PostgREST filter string (`.or(...)`), where commas and parentheses in the
 * value would otherwise be read as filter syntax.
 */
export function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value);
}

/**
 * A many-to-one embed (`grade_streams (...)` on a student) comes back as one
 * object at runtime, but supabase-js without generated types infers an array.
 * Normalise either shape to the single row, or null when there is none.
 */
export function embedOne<T>(value: T | T[] | null | undefined): T | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const PAGE_SIZE = 1000;
/** Hard ceiling for {@link fetchAllRows}: a backstop, not a limit we expect to reach. */
export const MAX_PAGED_ROWS = 50000;

/**
 * Every row a query matches. PostgREST answers with at most 1,000 rows unless
 * told otherwise, and says nothing when it cuts a result short — Analytics
 * once averaged an arbitrary 1,000 of a school's 1,819 marks that way. Pages
 * until a short page arrives; reaching the ceiling is reported as
 * `truncated`, never hidden.
 *
 * `build` must return a fresh query each call, with a stable order.
 */
export async function fetchAllRows<T>(
    build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<{ rows: T[]; error: unknown; truncated: boolean }> {
    const rows: T[] = [];
    for (let from = 0; from < MAX_PAGED_ROWS; from += PAGE_SIZE) {
        const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
        if (error) return { rows, error, truncated: false };
        const page = data ?? [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return { rows, error: null, truncated: false };
    }
    return { rows, error: null, truncated: true };
}
