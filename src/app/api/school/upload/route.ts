import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: profile } = await supabase
            .from('users')
            .select('school_id')
            .eq('id', session.user.id)
            .single();

        if (!profile?.school_id) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
        }

        const ext = file.name.split('.').pop() || 'bin';
        const timestamp = Date.now();
        const fileName = `${profile.school_id}/submissions/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(fileName, buffer, { contentType: file.type, upsert: true });

        if (uploadError) {
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);

        return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
