import { NextRequest, NextResponse } from 'next/server';
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
            .from('announcements')
            .select(`
                id, title, content, is_important, created_at,
                users!posted_by ( first_name, last_name )
            `)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const mapped = (data ?? []).map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            isImportant: a.is_important,
            createdAt: a.created_at,
            postedBy: a.users ? `${a.users.first_name} ${a.users.last_name}` : 'School',
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { schoolId, role, id: userId } = session.user;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.title || !body.content) {
            return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('announcements')
            .insert({
                school_id: schoolId,
                title: body.title,
                content: body.content,
                is_important: body.is_important ?? false,
                posted_by: userId,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
