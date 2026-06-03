import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        const role = userProfile?.role;
        const schoolId = userProfile?.school_id;

        let query = supabase
            .from('assignment_submissions')
            .select(`
                id, file_url, submission_text, submitted_at, grade, feedback, graded_at,
                assignments ( id, title, due_date, subjects ( name ) ),
                students!inner (
                    id,
                    users!inner ( school_id, first_name, last_name, admission_number )
                )
            `);

        // Students see only their own submissions
        if (role === 'STUDENT') {
            query = query.eq('student_id', userId);
        } else if (schoolId) {
            // Non-students scope to their school
            query = query.eq('students.users.school_id', schoolId);
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
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Only students can submit' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.role !== 'STUDENT') {
            return NextResponse.json({ error: 'Only students can submit' }, { status: 403 });
        }

        const body = await request.json();
        if (!body.assignment_id) {
            return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
        }

        // Verify assignment belongs to the student's school
        const { data: assignment } = await supabase
            .from('assignments')
            .select('id')
            .eq('id', body.assignment_id)
            .eq('school_id', userProfile.school_id)
            .maybeSingle();

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found in your school' }, { status: 403 });
        }

        const { data, error } = await supabase
            .from('assignment_submissions')
            .upsert({
                assignment_id: body.assignment_id,
                student_id: userId,
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
