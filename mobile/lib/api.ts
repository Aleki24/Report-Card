import { useAuth } from '@clerk/clerk-expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useMemo } from 'react';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
    readonly status: number;
    readonly code: string | null;
    constructor(message: string, status: number, code: string | null = null) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

type QueryValue = string | number | boolean | null | undefined;

/** Builds `path?a=1&b=2`, dropping empty values so callers can pass optional filters directly. */
export function withQuery(path: string, query: Record<string, QueryValue>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}

interface ErrorBody {
    error?: string;
    code?: string;
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
    const json: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
        const body = (json ?? {}) as ErrorBody;
        throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code ?? null);
    }
    return json as T;
}

export interface Api {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    patch: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    del: <T>(path: string) => Promise<T>;
    /**
     * Downloads a server-rendered file (report cards, mark sheets) with the
     * Clerk token attached, then opens the system share sheet so it can be
     * saved, printed or sent. The web hands these URLs to the browser; a
     * phone app has to fetch them itself because the URL needs auth.
     */
    downloadAndShare: (path: string, fileName: string, mimeType?: string) => Promise<void>;
    /**
     * Lets the user pick an image and uploads it to `/api/school/upload`
     * (the endpoint the web uses for assignment files, photos and logos).
     * Resolves to the public URL, or null if the user cancelled.
     */
    pickAndUploadImage: (path?: string) => Promise<string | null>;
}

/**
 * Web build (deployed to Vercel): there is no file system or share sheet, so
 * fetch the file with the token and hand it to the browser as a download.
 */
async function downloadInBrowser(url: string, token: string | null, fileName: string): Promise<void> {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ErrorBody;
        throw new ApiError(body.error ?? `Download failed (${res.status})`, res.status, body.code ?? null);
    }
    const href = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke after the browser has had the chance to read it.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Same backend the web app talks to — every route accepts a Clerk Bearer
// token the same way it accepts the web session cookie, since `auth()` from
// `@clerk/nextjs/server` reads either.
export function useApi(): Api {
    const { getToken } = useAuth();

    return useMemo<Api>(() => {
        const send = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
            const token = await getToken();
            return request<T>(path, token, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        };
        return {
            get: (path) => send('GET', path),
            post: (path, body) => send('POST', path, body),
            patch: (path, body) => send('PATCH', path, body),
            put: (path, body) => send('PUT', path, body),
            del: (path) => send('DELETE', path),
            downloadAndShare: async (path, fileName, mimeType = 'application/pdf') => {
                const token = await getToken();
                if (Platform.OS === 'web') return downloadInBrowser(`${API_URL}${path}`, token, fileName);
                const target = new File(Paths.cache, fileName);
                if (target.exists) target.delete();
                let file: File;
                try {
                    file = await File.downloadFileAsync(`${API_URL}${path}`, target, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });
                } catch (err) {
                    throw new ApiError(err instanceof Error ? err.message : 'Download failed', 0);
                }
                // A failed request still lands on disk; a small JSON body is the
                // backend's `{ error }`, not a document.
                if (file.size < 4096) {
                    const text = await file.text();
                    if (text.trimStart().startsWith('{')) {
                        file.delete();
                        const body = JSON.parse(text) as ErrorBody;
                        throw new ApiError(body.error ?? 'Download failed', 0, body.code ?? null);
                    }
                }
                if (!(await Sharing.isAvailableAsync())) {
                    throw new ApiError('Sharing is not available on this device.', 0);
                }
                await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
            },
            pickAndUploadImage: async (path = '/api/school/upload') => {
                const picked = await DocumentPicker.getDocumentAsync({ type: UPLOAD_TYPES, copyToCacheDirectory: true });
                if (picked.canceled || picked.assets.length === 0) return null;
                const asset = picked.assets[0];
                const type = asset.mimeType ?? 'image/jpeg';
                if (!UPLOAD_TYPES.includes(type)) throw new ApiError('Choose a JPEG, PNG, GIF or WebP image.', 400);
                if ((asset.size ?? 0) > MAX_UPLOAD_BYTES) throw new ApiError('Images must be 10 MB or smaller.', 400);

                const form = new FormData();
                // React Native's FormData takes a { uri, name, type } descriptor for files.
                if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, asset.name);
                else form.append('file', { uri: asset.uri, name: asset.name, type } as unknown as Blob);
                const token = await getToken();
                const res = await fetch(`${API_URL}${path}`, {
                    method: 'POST',
                    body: form,
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const json = (await res.json().catch(() => ({}))) as ErrorBody & { url?: string };
                if (!res.ok || !json.url) throw new ApiError(json.error ?? 'Upload failed', res.status, json.code ?? null);
                return json.url;
            },
        };
    }, [getToken]);
}
