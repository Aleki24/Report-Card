import { useAuth } from '@clerk/clerk-expo';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { apiErrorMessage } from '@shared/api-error-message';
import { saveToDevice, type SavedFile } from './saveFile';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** A page on the web app (same origin as the API), for flows the app hands to the browser. */
export function webUrl(path: `/${string}`): string {
    return `${API_URL}${path}`;
}

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
        // Zod `details` name the rejected fields; fold them in as the web does.
        throw new ApiError(apiErrorMessage(json, `Request failed (${res.status})`), res.status, body.code ?? null);
    }
    return json as T;
}

/** GET a public (signed-out) endpoint, e.g. result verification. Throws ApiError. */
export function publicGet<T>(path: string): Promise<T> {
    return request<T>(path, null);
}

/** POST to a public (signed-out) endpoint, e.g. during sign-in. Throws ApiError. */
export function publicPost<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, null, { method: 'POST', body: JSON.stringify(body) });
}

export interface Api {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    patch: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    del: <T>(path: string, body?: unknown) => Promise<T>;
    /**
     * Downloads a server-rendered file (report cards, mark sheets) with the
     * Clerk token attached, and saves it on the phone (see saveToDevice).
     * The web hands these URLs to the browser; a phone app has to fetch them
     * itself because the URL needs auth.
     */
    download: (path: string, fileName: string, mimeType?: string) => Promise<SavedFile>;
    /**
     * Lets the user pick an image and uploads it to `/api/school/upload`
     * (the endpoint the web uses for assignment files, photos and logos).
     * Resolves to the public URL, or null if the user cancelled.
     */
    pickAndUploadImage: (path?: string) => Promise<string | null>;
    /** Lets the user pick one file of the given MIME types; null if they cancelled. */
    pickFile: (types: readonly string[]) => Promise<PickedFile | null>;
    /** A multipart request (text fields plus picked files), answered with JSON like every other call. */
    sendForm: <T>(method: 'POST' | 'PATCH', path: string, fields: Readonly<Record<string, string>>, files: Readonly<Record<string, PickedFile | null>>) => Promise<T>;
}

/** A file chosen with the system picker, ready to upload. */
export interface PickedFile {
    uri: string;
    name: string;
    type: string;
    size: number | null;
    /** The browser's File, in the web build. */
    blob?: Blob;
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
    // @clerk/clerk-expo's useAuth returns a new getToken on every render. Reading
    // it through a ref keeps this client stable; otherwise every screen's query
    // effect re-runs after each render and refetches forever.
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    return useMemo<Api>(() => {
        const send = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
            const token = await getTokenRef.current();
            return request<T>(path, token, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        };
        const pickFile = async (types: readonly string[]): Promise<PickedFile | null> => {
            const picked = await DocumentPicker.getDocumentAsync({ type: [...types], copyToCacheDirectory: true });
            if (picked.canceled || picked.assets.length === 0) return null;
            const asset = picked.assets[0];
            return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? null, blob: asset.file };
        };
        const sendForm = async <T,>(method: 'POST' | 'PATCH', path: string, fields: Readonly<Record<string, string>>, files: Readonly<Record<string, PickedFile | null>>): Promise<T> => {
            const form = new FormData();
            Object.entries(fields).forEach(([k, v]) => form.append(k, v));
            Object.entries(files).forEach(([k, f]) => {
                if (!f) return;
                // React Native's FormData takes a { uri, name, type } descriptor for files.
                if (Platform.OS === 'web' && f.blob) form.append(k, f.blob, f.name);
                else form.append(k, { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
            });
            const token = await getTokenRef.current();
            const res = await fetch(`${API_URL}${path}`, { method, body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) throw new ApiError(apiErrorMessage(json, `Upload failed (${res.status})`), res.status, (json as ErrorBody).code ?? null);
            return json as T;
        };
        return {
            get: (path) => send('GET', path),
            post: (path, body) => send('POST', path, body),
            patch: (path, body) => send('PATCH', path, body),
            put: (path, body) => send('PUT', path, body),
            del: (path, body) => send('DELETE', path, body),
            download: async (path, fileName, mimeType = 'application/pdf') => {
                const token = await getTokenRef.current();
                if (Platform.OS === 'web') {
                    await downloadInBrowser(`${API_URL}${path}`, token, fileName);
                    return { uri: fileName, name: fileName, mimeType, folder: 'Downloads' };
                }
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
                return saveToDevice(file, fileName, mimeType);
            },
            pickFile,
            sendForm,
            pickAndUploadImage: async (path = '/api/school/upload') => {
                const picked = await pickFile(UPLOAD_TYPES);
                if (!picked) return null;
                if (!UPLOAD_TYPES.includes(picked.type)) throw new ApiError('Choose a JPEG, PNG, GIF or WebP image.', 400);
                if ((picked.size ?? 0) > MAX_UPLOAD_BYTES) throw new ApiError('Images must be 10 MB or smaller.', 400);
                const json = await sendForm<{ url?: string }>('POST', path, {}, { file: picked });
                if (!json.url) throw new ApiError('Upload failed', 0);
                return json.url;
            },
        };
    }, []);
}
