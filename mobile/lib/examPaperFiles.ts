import { PAPER_MIME_TYPES, type PaperFileKind } from '@shared/academics/exam-papers';
import { SERVER_UPLOAD_MAX_BYTES, resolveAttachmentType } from '@shared/attachments';
import { ApiError, type Api, type PickedFile, type SignedTarget } from './api';

export type PaperFiles = Partial<Record<PaperFileKind, PickedFile | null>>;

/**
 * Picks an exam paper or marking scheme. Any file can be chosen and the type
 * is then checked by name too: filtering the picker by type hid the Word and
 * PDF files Android labels "application/octet-stream", so they could not be
 * chosen at all, and a cancelled or failed pick said nothing.
 */
export async function pickPaperFile(api: Api): Promise<PickedFile | null> {
    const picked = await api.pickFile(['*/*']);
    if (!picked) return null;
    const type = resolveAttachmentType(picked.name, picked.type);
    if (!type || !PAPER_MIME_TYPES[type]) throw new ApiError('Choose a PDF or Word document.', 400);
    return { ...picked, type };
}

/**
 * The form for saving a paper: each file is uploaded straight to the private
 * papers bucket and named by its staged path (files sent with the form pass
 * through Vercel, which refuses bodies over 4.5 MB). A file that cannot go
 * direct is sent with the form instead, if it is small enough.
 */
export async function paperUploadForm(api: Api, files: PaperFiles): Promise<{ fields: Record<string, string>; files: PaperFiles }> {
    const fields: Record<string, string> = {};
    const inline: PaperFiles = {};
    for (const [kind, file] of Object.entries(files) as [PaperFileKind, PickedFile | null][]) {
        if (!file) continue;
        const { data } = await api.post<{ data: SignedTarget & { field: string; path: string } }>('/api/academics/exam-papers/upload-url', {
            kind, name: file.name, type: file.type, size: file.size ?? 0,
        });
        if (await api.putSigned(data, file)) fields[data.field] = data.path;
        else if ((file.size ?? 0) <= SERVER_UPLOAD_MAX_BYTES) inline[kind] = file;
        else throw new ApiError('The file did not upload. Check your connection and try again.', 0);
    }
    return { fields, files: inline };
}
