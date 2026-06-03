import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentStudent } from '@/lib/student/get-current-student';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('id', userId)
            .maybeSingle();

        const schoolId = userProfile?.school_id;
        const role = userProfile?.role;
        if (!schoolId) return NextResponse.json({ data: [] });

        let query = supabase
            .from('assignments')
            .select(`
                id, title, description, due_date, file_url, created_at,
                subjects!subject_id ( id, code, name ),
                grade_streams!grade_stream_id ( id, name, full_name ),
                users!created_by ( id, first_name, last_name )
            `)
            .eq('school_id', schoolId)
            .order('due_date', { ascending: true })
            .limit(50);

        // Students see only assignments for their stream
        if (role === 'STUDENT') {
            const student = await getCurrentStudent();
            if (student?.gradeStreamId) {
                query = query.or(`grade_stream_id.eq.${student.gradeStreamId},grade_stream_id.is.null`);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        const mapped = (data ?? []).map((a: any) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            dueDate: a.due_date,
            fileUrl: a.file_url,
            subject: a.subjects?.name || 'Unknown',
            subjectId: a.subjects?.id,
            subjectCode: a.subjects?.code,
            stream: a.grade_streams?.full_name || null,
            streamId: a.grade_streams?.id,
            createdBy: a.users ? `${a.users.first_name} ${a.users.last_name}` : 'Unknown',
            createdAt: a.created_at,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('id', userId)
            .single();

        const schoolId = userProfile?.school_id;
        const role = userProfile?.role;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.title || !body.subject_id || !body.due_date) {
            return NextResponse.json({ error: 'title, subject_id, and due_date are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('assignments')
            .insert({
                school_id: schoolId,
                subject_id: body.subject_id,
                grade_stream_id: body.grade_stream_id || null,
                title: body.title,
                description: body.description || null,
                due_date: body.due_date,
                file_url: body.file_url || null,
                created_by: userId,
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
