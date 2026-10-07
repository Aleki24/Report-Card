import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { ASSIGNMENT_UPLOAD_MAX_BYTES } from '@/lib/assignments';
import { resolveAttachmentType } from '@/lib/attachments';
import { attachmentTarget, uploaderSchool } from '@/lib/upload-server';

/**
 * Uploads a small file through the server (school logos, and attachments when
 * a direct upload is not possible). Vercel caps request bodies at 4.5 MB, so
 * homework attachments go straight to storage via /api/school/upload/sign.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const uploader = await uploaderSchool(supabase);
        if ('error' in uploader) return NextResponse.json({ error: uploader.error }, { status: uploader.status });

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const type = resolveAttachmentType(file.name, file.type);
        if (!type) {
            return NextResponse.json({ error: 'Choose an image, PDF, Word, PowerPoint, Excel or text file.' }, { status: 400 });
        }

        if (file.size > ASSIGNMENT_UPLOAD_MAX_BYTES) {
            return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 400 });
        }

        const { bucket, path: fileName } = attachmentTarget(uploader.schoolId, file.name, type);
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, { contentType: type, upsert: false });

        if (uploadError) {
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

        return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
