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

        const { role, id: userId } = session.user;
        const supabase = createSupabaseAdmin();

        let query = supabase
            .from('assignment_submissions')
            .select(`
                id, file_url, submission_text, submitted_at, grade, feedback, graded_at,
                assignments ( id, title, due_date, subjects ( name ) ),
                students ( id, users ( first_name, last_name, admission_number ) )
            `);

        // Students see only their own submissions
        if (role === 'STUDENT') {
            query = query.eq('student_id', userId);
        }

        const { data, error } = await query.order('submitted_at', { ascending: false });

        if (error) throw error;

        const mapped = (data ?? []).map((s: any) => ({
            id: s.id,
            fileUrl: s.file_url,
            submissionText: s.submission_text,
            submittedAt: s.submitted_at,
            grade: s.grade ? Number(s.grade) : null,
            feedback: s.feedback,
            gradedAt: s.graded_at,
            assignmentTitle: s.assignments?.title,
            assignmentDueDate: s.assignments?.due_date,
            subjectName: s.assignments?.subjects?.name,
            studentName: s.students?.users ? `${s.students.users.first_name} ${s.students.users.last_name}` : null,
            admissionNumber: s.students?.users?.admission_number,
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
        if (!session?.user?.id || session.user.role !== 'STUDENT') {
            return NextResponse.json({ error: 'Only students can submit' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.assignment_id) {
            return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('assignment_submissions')
            .upsert({
                assignment_id: body.assignment_id,
                student_id: session.user.id,
                file_url: body.file_url || null,
                submission_text: body.submission_text || null,
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
