import { z } from 'zod';
import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { MAX_PAPER_BYTES, PAPER_FILE_KINDS } from '@/lib/academics/exam-papers';
import { BUCKET, paperFileType, stagedPaperPath, stagedField } from '@/lib/academics/exam-papers-server';
import { signedUploadHeaders } from '@/lib/upload-server';

const READERS = ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] as const;

const bodySchema = z.object({
    kind: z.enum(PAPER_FILE_KINDS),
    name: z.string().trim().min(1).max(255),
    type: z.string().max(255).nullish(),
    size: z.number().int().nonnegative(),
});

/**
 * A one-time link to upload an exam paper (or its marking scheme) straight to
 * the private papers bucket. Files sent with the form pass through Vercel,
 * which refuses bodies over 4.5 MB, so the 15 MB allowed was really 4.5 MB
 * and larger scans failed. The client uploads here, then saves the paper with
 * the returned `field` set to `path`; the save checks the file is there.
 */
export const POST = route('exam paper upload url', { module: 'exam_papers', permission: READERS }, async ({ access, request }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Choose a file to upload.');
    const { kind, name, type: reported, size } = parsed.data;
    const type = paperFileType(name, reported);
    if (!type) throw new HttpError(400, 'Upload a PDF or Word document.');
    if (size > MAX_PAPER_BYTES) throw new HttpError(400, 'Files must be 15 MB or smaller.');

    const path = stagedPaperPath(access.schoolId, kind, type);
    const { data, error } = await createSupabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('could not sign the upload');

    return {
        uploadUrl: data.signedUrl,
        headers: signedUploadHeaders(),
        type,
        field: stagedField(kind),
        path,
    };
});
