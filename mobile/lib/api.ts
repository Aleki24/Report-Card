import { useAuth } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init?.headers ?? {}),
        },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
    }
    return json as T;
}

// Same backend the web app talks to — every route here already accepts a
// Clerk Bearer token the same way it accepts the web session cookie, since
// `auth()` from `@clerk/nextjs/server` reads either. No API changes needed.
export function useApi() {
    const { getToken } = useAuth();

    return {
        get: async <T,>(path: string): Promise<T> => {
            const token = await getToken();
            return request<T>(path, token);
        },
        post: async <T,>(path: string, body?: unknown): Promise<T> => {
            const token = await getToken();
            return request<T>(path, token, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
        },
        patch: async <T,>(path: string, body?: unknown): Promise<T> => {
            const token = await getToken();
            return request<T>(path, token, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
        },
        del: async <T,>(path: string): Promise<T> => {
            const token = await getToken();
            return request<T>(path, token, { method: 'DELETE' });
        },
    };
}
