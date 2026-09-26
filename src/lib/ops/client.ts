/**
 * Browser helpers for the operations API: typed JSON calls that throw a
 * readable Error (the server's message, Zod details folded in) on failure.
 */
import { apiErrorMessage } from '@/lib/api-error-message';

export async function opsFetch<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
    const { json, ...rest } = init ?? {};
    const res = await fetch(url, {
        ...rest,
        headers: json !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(body, `Request failed (${res.status})`));
    return (body as { data: T }).data;
}

export const opsUrl = (resource: string, params?: Record<string, string | undefined | null>) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    return `/api/ops/${resource}${qs ? `?${qs}` : ''}`;
};

export const errorText = (err: unknown, fallback = 'Something went wrong.') => (err instanceof Error ? err.message : fallback);
