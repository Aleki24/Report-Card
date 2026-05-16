import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { schoolId } = session.user;
        if (!schoolId) return NextResponse.json({ data: [] });

        const supabase = createSupabaseAdmin();

        const { data, error } = await supabase
            .from('learning_materials')
            .select(`
                id, title, description, file_url, file_size_bytes, file_type, created_at,
                subjects!subject_id ( id, code, name ),
                grade_streams!grade_stream_id ( id, name, full_name )
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const mapped = (data ?? []).map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            fileUrl: m.file_url,
            fileSizeBytes: m.file_size_bytes,
            fileType: m.file_type,
            subject: m.subjects?.name || 'Unknown',
            subjectCode: m.subjects?.code,
            stream: m.grade_streams?.full_name || null,
            createdAt: m.created_at,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
