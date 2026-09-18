/**
 * Shape every API route in this app returns on a 4xx/5xx: a headline `error`,
 * plus the per-field `details` a Zod failure produces.
 *
 * Declared here rather than in `api-errors.ts` because that module imports
 * `next/server`; this one is safe for client components to import.
 */
export interface ApiErrorBody {
    error?: string;
    details?: string[];
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
    return typeof body === 'object' && body !== null;
}

/**
 * Builds the message shown to the user from a failed response body.
 *
 * A bare `"Validation failed"` tells nobody which field was rejected, so the
 * Zod `details` are folded into the message — that string is what reaches the
 * error toast.
 */
export function apiErrorMessage(body: unknown, fallback = 'Request failed'): string {
    if (!isApiErrorBody(body)) return fallback;

    const details = Array.isArray(body.details)
        ? body.details.filter((detail): detail is string => typeof detail === 'string')
        : [];
    const headline = typeof body.error === 'string' && body.error.trim() ? body.error : fallback;

    return details.length ? `${headline}: ${details.join('; ')}` : headline;
}
