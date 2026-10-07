import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { ASSIGNMENT_UPLOAD_MAX_BYTES } from '@/lib/assignments';
import { extensionFor, isImageType, resolveAttachmentType, storageSafeName } from '@/lib/attachments';

const MAX_SIZE = ASSIGNMENT_UPLOAD_MAX_BYTES;
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

        const type = resolveAttachmentType(file.name, file.type);
        if (!type) {
            return NextResponse.json({ error: 'Choose an image, PDF, Word, PowerPoint, Excel or text file.' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 400 });
        }

        const bucket = isImageType(type) ? 'photos' : DOCUMENT_BUCKET;
        if (bucket === DOCUMENT_BUCKET) {
            // Already there after the first upload; any other failure shows on the upload below.
            await supabase.storage.createBucket(DOCUMENT_BUCKET, { public: true, fileSizeLimit: MAX_SIZE }).catch(() => undefined);
        }
        // A random folder keeps the link unguessable; the original name inside it
        // is what teachers and learners see ("Fractions-worksheet.pdf").
        const folder = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const fileName = `${profile.school_id}/attachments/${folder}/${storageSafeName(file.name)}.${extensionFor(type)}`;
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
