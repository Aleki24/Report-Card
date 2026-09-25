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
