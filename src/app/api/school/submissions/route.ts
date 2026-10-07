import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { internalError } from '@/lib/api-errors';
import { submitAssignmentSchema } from '@/lib/assignments';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = userProfile?.role;
        const schoolId = userProfile?.school_id;

        let query = supabase
            .from('assignment_submissions')
            .select(`
                id, assignment_id, file_url, submission_text, submitted_at, grade, feedback, graded_at,
                assignments!inner ( id, title, due_date, created_by, subjects ( name ) ),
                students!inner (
                    id,
                    admission_number,
                    users!inner ( school_id, first_name, last_name )
                )
            `);

        // Students see only their own submissions; staff see their school's.
        // A staff account with no school used to fall through with no filter
        // at all and receive every school's submissions.
        if (role === 'STUDENT') {
            query = query.eq('student_id', userId);
        } else if (schoolId && isRoleIn(role, STAFF_TEACHING_ROLES)) {
            query = query.eq('students.users.school_id', schoolId);
            // A teacher grades the work set by them (as PATCH allows), so other
            // teachers' hand-ins only cluttered the list and failed to save.
            if (role !== 'ADMIN') query = query.eq('assignments.created_by', userId);
        } else {
            return NextResponse.json({ data: [] });
        }
        // One assignment's work, for the teacher reviewing it.
        const assignmentId = new URL(request.url).searchParams.get('assignment_id');
        if (assignmentId) query = query.eq('assignment_id', assignmentId);

        const { data, error } = await query.order('submitted_at', { ascending: false });

        if (error) return internalError('submissions list', error);

        const mapped = (data ?? []).map((s: any) => ({
            id: s.id,
            assignmentId: s.assignment_id,
            fileUrl: s.file_url,
            submissionText: s.submission_text,
            submittedAt: s.submitted_at,
            // A grade of 0 is a grade: `s.grade ? … : null` read it as ungraded.
            grade: s.grade != null ? Number(s.grade) : null,
            feedback: s.feedback,
            gradedAt: s.graded_at,
            assignmentTitle: s.assignments?.title,
            assignmentDueDate: s.assignments?.due_date,
            subjectName: s.assignments?.subjects?.name,
            studentName: s.students?.users ? `${s.students.users.first_name} ${s.students.users.last_name}` : null,
            admissionNumber: s.students?.admission_number,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        // A database error is a plain object, not an Error: it used to reach
        // the app as "Unknown error" and was never logged.
        return internalError('submissions list', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const student = await getCurrentStudent();
        if (!student) {
            return NextResponse.json({ error: 'Only students can submit' }, { status: 403 });
        }

        const parsed = submitAssignmentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your submission and try again.' }, { status: 400 });
        }
        const body = parsed.data;
        const supabase = createSupabaseAdmin();

        // Verify assignment belongs to the student's school and, if
        // stream-scoped, to the student's own stream.
        const { data: assignment } = await supabase
            .from('assignments')
            .select('id, grade_stream_id')
            .eq('id', body.assignment_id)
            .eq('school_id', student.schoolId)
            .maybeSingle();

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found in your school' }, { status: 403 });
        }

        if (assignment.grade_stream_id && assignment.grade_stream_id !== student.gradeStreamId) {
            return NextResponse.json({ error: 'This assignment is not assigned to your class' }, { status: 403 });
        }

        // Handing in again replaces the earlier work, which is fine until the
        // teacher has marked it: after that a resubmission would sit beside a
        // grade given for different work.
        const { data: existing } = await supabase
            .from('assignment_submissions')
            .select('graded_at, grade')
            .eq('assignment_id', body.assignment_id)
            .eq('student_id', student.userId)
            .maybeSingle();
        if (existing && (existing.graded_at || existing.grade != null)) {
            return NextResponse.json({ error: 'Your teacher has already marked this work, so it can’t be changed.' }, { status: 409 });
        }

        const { data, error } = await supabase
            .from('assignment_submissions')
            .upsert({
                assignment_id: body.assignment_id,
                student_id: student.userId,
                file_url: body.file_url,
                submission_text: body.submission_text,
                submitted_at: new Date().toISOString(),
            }, {
                // One submission per learner per assignment (UNIQUE in the
                // schema). Without the conflict target the upsert keyed on the
                // primary key, so every resubmission hit the unique constraint.
                onConflict: 'assignment_id,student_id',
            })
            .select()
            .single();

        if (error) return internalError('submission upsert', error);
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('submission create', err);
    }
}
