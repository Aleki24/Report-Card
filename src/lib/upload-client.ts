import { apiErrorMessage } from '@/lib/api-error-message';
import { SERVER_UPLOAD_MAX_BYTES, type SignedUpload } from '@/lib/attachments';

/**
 * Uploads a homework attachment from the browser straight to storage and
 * returns its link. Small files fall back to going through the server.
 */
export async function uploadAttachment(file: File): Promise<string> {
    const signRes = await fetch('/api/school/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
    });
    const signed: unknown = await signRes.json().catch(() => null);
    if (!signRes.ok) throw new Error(apiErrorMessage(signed, 'The attachment did not upload.'));
    const { uploadUrl, headers, type, url } = signed as SignedUpload;


    const sent = await putSignedFile({ uploadUrl, headers, type }, file);
    if (sent) return url;

    if (file.size > SERVER_UPLOAD_MAX_BYTES) throw new Error('The attachment did not upload. Check your connection and try again.');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/school/upload', { method: 'POST', body: fd });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, 'The attachment did not upload.'));
    return (json as { url: string }).url;
}

/** Sends a file to a signed upload link, with the body supabase-js uses; false if it did not arrive. */
export async function putSignedFile(signed: Pick<SignedUpload, 'uploadUrl' | 'headers' | 'type'>, file: File): Promise<boolean> {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob([file], { type: signed.type }), file.name);
    const res = await fetch(signed.uploadUrl, { method: 'PUT', headers: { ...signed.headers, 'x-upsert': 'false' }, body }).catch(() => null);
    return !!res?.ok;
}

/**
 * An exam paper or marking scheme as a form field: uploaded straight to the
 * private papers bucket and named by its staged path, or, if that fails and
 * the file is small, the file itself (as before).
 */
export async function paperFileField(kind: 'paper' | 'scheme', file: File): Promise<[string, string | File]> {
    const res = await fetch('/api/academics/exam-papers/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: file.name, type: file.type, size: file.size }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, 'The file did not upload.'));
    const staged = (json as { data: SignedUpload & { field: string; path: string } }).data;
    if (await putSignedFile(staged, file)) return [staged.field, staged.path];
    if (file.size > SERVER_UPLOAD_MAX_BYTES) throw new Error('The file did not upload. Check your connection and try again.');
    return [kind, file];
}
