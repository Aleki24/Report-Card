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

/**
 * `fetch` that treats a 4xx/5xx as the failure it is.
 *
 * `fetch` only rejects on network errors, so pages that awaited it and moved on
 * closed their modals and reported success on a refused save. This throws with
 * the server's own message instead, ready for a toast.
 */
export async function requestJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(body, `Request failed (${res.status})`));
    return body as T;
}

/** JSON request options for a body-carrying call. */
export function jsonBody(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
