import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
};
/** Worksheets and notes teachers attach to homework, and work learners hand in. */
const DOCUMENT_EXT: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
};
/** Documents live apart from photos; the bucket is made on first use. */
const DOCUMENT_BUCKET = 'assignment-files';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: profile } = await supabase
            .from('users')
            .select('school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!profile || profile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!profile.school_id) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const ext = IMAGE_EXT[file.type] ?? DOCUMENT_EXT[file.type];
        if (!ext) {
            return NextResponse.json({ error: 'Choose an image, PDF, Word, PowerPoint, Excel or text file.' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
        }

        const bucket = IMAGE_EXT[file.type] ? 'photos' : DOCUMENT_BUCKET;
        if (bucket === DOCUMENT_BUCKET) {
            // Already there after the first upload; any other failure shows on the upload below.
            await supabase.storage.createBucket(DOCUMENT_BUCKET, { public: true, fileSizeLimit: MAX_SIZE }).catch(() => undefined);
        }
        const timestamp = Date.now();
        const fileName = `${profile.school_id}/submissions/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, buffer, { contentType: file.type, upsert: true });

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
