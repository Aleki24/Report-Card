import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { ASSIGNMENT_UPLOAD_MAX_BYTES } from '@/lib/assignments';
import { resolveAttachmentType } from '@/lib/attachments';
import { attachmentTarget, signedUploadHeaders, uploaderSchool } from '@/lib/upload-server';

const signSchema = z.object({
    name: z.string().trim().min(1).max(255),
    type: z.string().max(255).nullish(),
    size: z.number().int().nonnegative(),
});

/**
 * A one-time link to upload a homework attachment straight to storage.
 *
 * Files used to pass through /api/school/upload, and Vercel refuses request
 * bodies over 4.5 MB before the route runs, so the 10 MB the app promised was
 * really 4.5 MB and bigger photos and scans failed without a word. The file
 * now goes from the phone or browser to storage; this route only checks who
 * is uploading, what and how big, and says where it will be.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const uploader = await uploaderSchool(supabase);
        if ('error' in uploader) return NextResponse.json({ error: uploader.error }, { status: uploader.status });

        const parsed = signSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
        const { name, type: reported, size } = parsed.data;

        const type = resolveAttachmentType(name, reported);
        if (!type) return NextResponse.json({ error: 'Choose an image, PDF, Word, PowerPoint, Excel or text file.' }, { status: 400 });
        if (size > ASSIGNMENT_UPLOAD_MAX_BYTES) return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 400 });

        const { bucket, path } = attachmentTarget(uploader.schoolId, name, type);
        const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
        if (error || !data) return internalError('upload sign', error);

        return NextResponse.json({
            uploadUrl: data.signedUrl,
            headers: signedUploadHeaders(),
            type,
            url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
        });
    } catch (err: unknown) {
        return internalError('upload sign', err);
    }
}
