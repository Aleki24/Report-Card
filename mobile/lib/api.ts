import { useAuth } from '@clerk/clerk-expo';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { apiErrorMessage } from '@shared/api-error-message';
import { ASSIGNMENT_UPLOAD_MAX_BYTES } from '@shared/assignments';
import { ATTACHMENT_TYPES, IMAGE_TYPES, SERVER_UPLOAD_MAX_BYTES, resolveAttachmentType, type SignedUpload } from '@shared/attachments';
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

/** Shown when the phone can't reach the server at all (no data, dropped connection). */
export const NETWORK_ERROR_MESSAGE = 'Couldn’t reach Skulbase. Check your internet connection and try again.';
export const NETWORK_ERROR_CODE = 'NETWORK';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch, retried when the request never got an answer. Mobile networks drop
 * connections, and a pooled connection the server already closed fails with
 * "Connection reset" on first use, so a quick retry usually succeeds. The
 * raw Java/OkHttp error never reaches the screen.
 */
export async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fetch(url, init);
        } catch {
            if (attempt >= attempts) throw new ApiError(NETWORK_ERROR_MESSAGE, 0, NETWORK_ERROR_CODE);
            await wait(500 * attempt);
        }
    }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
    const res = await fetchWithRetry(`${API_URL}${path}`, {
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
    /** Fetches a file into the app's cache (not saved anywhere the person sees), e.g. to show it. */
    fetchFile: (source: FileSource, fileName: string) => Promise<File>;
    /**
     * Lets the user pick an image and uploads it to `/api/school/upload`
     * (the endpoint the web uses for assignment files, photos and logos).
     * Resolves to the public URL, or null if the user cancelled.
     */
    pickAndUploadImage: (path?: string) => Promise<string | null>;
    /** Lets the user pick an image or document (PDF, Word, PowerPoint, Excel) and uploads it; null if they cancelled. */
    pickAndUploadAttachment: () => Promise<UploadedFile | null>;
    /** Opens the camera for a photo of the work and uploads it; null if they cancelled. */
    captureAndUploadPhoto: () => Promise<UploadedFile | null>;
    /** Sends a picked file straight to storage through a signed upload link; false if it did not arrive. */
    putSigned: (signed: SignedTarget, file: PickedFile) => Promise<boolean>;
    /** Lets the user pick one file of the given MIME types; null if they cancelled. */
    pickFile: (types: readonly string[]) => Promise<PickedFile | null>;
    /** A multipart request (text fields plus picked files), answered with JSON like every other call. */
    sendForm: <T>(method: 'POST' | 'PATCH', path: string, fields: Readonly<Record<string, string>>, files: Readonly<Record<string, PickedFile | null>>) => Promise<T>;
}

/**
 * A form part for a picked file that expo/fetch can send.
 *
 * Since SDK 57 Expo replaces `fetch` with expo/fetch, which builds the
 * multipart body itself and only accepts Blobs or parts with `bytes()`.
 * React Native's `{ uri, name, type }` descriptor made it throw before
 * anything was sent, so every upload from the phone (exam papers, homework,
 * photos) failed as "Couldn't reach Skulbase".
 */
interface BytesPart {
    name: string;
    type: string;
    bytes: () => Promise<Uint8Array>;
}

/** Adds a picked file to a form, as `type` (defaults to what the picker reported). */
function appendFile(form: FormData, field: string, file: PickedFile, type: string = file.type): void {
    if (Platform.OS === 'web' && file.blob) {
        form.append(field, file.blob, file.name);
        return;
    }
    const local = new File(file.uri);
    const part: BytesPart = { name: file.name, type, bytes: async () => new Uint8Array(await local.arrayBuffer()) };
    // expo/fetch reads `name`, `type` and `bytes()` from the part (expo/src/winter/fetch/convertFormData.ts).
    form.append(field, part as unknown as Blob);
}

/** Where a file lives: an API route (sent with the sign-in token) or a public link. */
export type FileSource = { kind: 'api'; path: string } | { kind: 'url'; url: string };

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

const MAX_UPLOAD_BYTES = ASSIGNMENT_UPLOAD_MAX_BYTES;
/** Where and how to send a file to a signed upload link. */
export type SignedTarget = Pick<SignedUpload, 'uploadUrl' | 'headers' | 'type'>;
const WRONG_ATTACHMENT = 'Choose an image, PDF, Word, PowerPoint, Excel or text file.';

/** An uploaded attachment: where it lives and what it was called on the phone. */
export interface UploadedFile { url: string; name: string }

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
                if (f) appendFile(form, k, f);
            });
            const token = await getTokenRef.current();
            const res = await fetchWithRetry(`${API_URL}${path}`, { method, body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
            const json: unknown = await res.json().catch(() => ({}));
            if (!res.ok) throw new ApiError(apiErrorMessage(json, `Upload failed (${res.status})`), res.status, (json as ErrorBody).code ?? null);
            return json as T;
        };
        // The type is checked by name as well as by what the phone reports,
        // which on Android is often "application/octet-stream" for documents.
        const checkPicked = (picked: PickedFile, types: readonly string[], wrongType: string): PickedFile => {
            const type = resolveAttachmentType(picked.name, picked.type);
            if (!type || !types.includes(type)) throw new ApiError(wrongType, 400);
            if ((picked.size ?? 0) > MAX_UPLOAD_BYTES) throw new ApiError('Files must be 10 MB or smaller.', 400);
            return { ...picked, type };
        };
        // The body supabase-js sends to a signed upload link; false if the file did not arrive.
        const putSigned = async (signed: SignedTarget, file: PickedFile): Promise<boolean> => {
            const body = new FormData();
            body.append('cacheControl', '3600');
            appendFile(body, '', file, signed.type);
            const res = await fetch(signed.uploadUrl, { method: 'PUT', headers: { ...signed.headers, 'x-upsert': 'false' }, body }).catch(() => null);
            return !!res?.ok;
        };
        const fetchFile = async (source: FileSource, fileName: string): Promise<File> => {
            const token = source.kind === 'api' ? await getTokenRef.current() : null;
            const url = source.kind === 'api' ? `${API_URL}${source.path}` : source.url;
            const target = new File(Paths.cache, fileName);
            if (target.exists) target.delete();
            let file: File;
            try {
                file = await File.downloadFileAsync(url, target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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
            return file;
        };
        // Through the server: fine for logos and photos, but Vercel refuses bodies over 4.5 MB.
        const uploadPicked = async (picked: PickedFile, types: readonly string[], path: string, wrongType: string): Promise<UploadedFile> => {
            const json = await sendForm<{ url?: string }>('POST', path, {}, { file: checkPicked(picked, types, wrongType) });
            if (!json.url) throw new ApiError('Upload failed', 0);
            return { url: json.url, name: picked.name };
        };
        // Homework attachments go straight to storage with a one-time link, so
        // the full 10 MB works; small files fall back to the server if that fails.
        const uploadAttachment = async (picked: PickedFile, types: readonly string[]): Promise<UploadedFile> => {
            const file = checkPicked(picked, types, WRONG_ATTACHMENT);
            const signed = await send<SignedUpload>('POST', '/api/school/upload/sign', { name: file.name, type: file.type, size: file.size ?? 0 });
            if (await putSigned(signed, file)) return { url: signed.url, name: file.name };
            if ((file.size ?? 0) > SERVER_UPLOAD_MAX_BYTES) throw new ApiError('Upload failed. Check your connection and try again.', 0);
            return uploadPicked(file, types, '/api/school/upload', WRONG_ATTACHMENT);
        };

        return {
            get: (path) => send('GET', path),
            post: (path, body) => send('POST', path, body),
            patch: (path, body) => send('PATCH', path, body),
            put: (path, body) => send('PUT', path, body),
            del: (path, body) => send('DELETE', path, body),
            download: async (path, fileName, mimeType = 'application/pdf') => {
                if (Platform.OS === 'web') {
                    const token = await getTokenRef.current();
                    await downloadInBrowser(`${API_URL}${path}`, token, fileName);
                    return { uri: fileName, name: fileName, mimeType, folder: 'Downloads' };
                }
                return saveToDevice(await fetchFile({ kind: 'api', path }, fileName), fileName, mimeType);
            },
            fetchFile,
            pickFile,
            sendForm,
            putSigned,
            pickAndUploadImage: async (path = '/api/school/upload') => {
                const picked = await pickFile(IMAGE_TYPES);
                return picked ? (await uploadPicked(picked, IMAGE_TYPES, path, 'Choose a JPEG, PNG, GIF or WebP image.')).url : null;
            },
            // Any file can be picked: a type filter hides documents the phone
            // mislabels, so the check happens after picking instead.
            pickAndUploadAttachment: async () => {
                const picked = await pickFile(['*/*']);
                return picked ? uploadAttachment(picked, ATTACHMENT_TYPES) : null;
            },
            captureAndUploadPhoto: async () => {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) throw new ApiError('Allow camera access in your phone’s settings to take a photo of your work.', 0);
                // quality below 1 also saves iPhone photos as JPEG rather than HEIC.
                const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
                if (shot.canceled || shot.assets.length === 0) return null;
                const asset = shot.assets[0];
                return uploadAttachment(
                    { uri: asset.uri, name: asset.fileName ?? `Photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? null, blob: asset.file },
                    IMAGE_TYPES,
                );
            },
        };
    }, []);
}
