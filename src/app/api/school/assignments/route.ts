import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { fetchAllRows, embedOne } from '@/lib/postgrest';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { getCurrentStudent } from '@/lib/student/get-current-student';
import { assignmentSchema, type Assignment } from '@/lib/assignments';
import { assignmentRefsBelongToSchool } from '@/lib/assignments-server';

type Named = { id: string; first_name: string | null; last_name: string | null };
interface AssignmentRow {
    id: string;
    title: string;
    description: string | null;
    due_date: string;
    file_url: string | null;
    created_at: string;
    created_by: string | null;
    subjects: { id: string; name: string } | { id: string; name: string }[] | null;
    grade_streams: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
    users: Named | Named[] | null;
    assignment_submissions: { count: number }[] | null;
}

const toAssignment = (a: AssignmentRow): Assignment => {
    const subject = embedOne(a.subjects);
    const stream = embedOne(a.grade_streams);
    const author = embedOne(a.users);
    return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.due_date,
        fileUrl: a.file_url,
        subject: subject?.name ?? 'Unknown subject',
        subjectId: subject?.id ?? '',
        stream: stream?.full_name ?? null,
        streamId: stream?.id ?? null,
        createdBy: author ? `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim() : 'Unknown',
        createdById: a.created_by,
        createdAt: a.created_at,
        submissionCount: a.assignment_submissions?.[0]?.count ?? 0,
    };
};

/**
 * The school's assignments, soonest due first.
 *
 * This returned the first 50 by due date, oldest first, so once a school had
 * set 50 pieces of work every new one was cut off the end of the list.
 */
export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { schoolId, role } = caller;
        if (!schoolId) return NextResponse.json({ data: [] });

        const student = role === 'STUDENT' ? await getCurrentStudent() : null;
        const supabase = createSupabaseAdmin();
        const { rows, error } = await fetchAllRows<AssignmentRow>(() => {
            let query = supabase
                .from('assignments')
                .select(`
                    id, title, description, due_date, file_url, created_at, created_by,
                    subjects!subject_id ( id, name ),
                    grade_streams!grade_stream_id ( id, full_name ),
                    users!created_by ( id, first_name, last_name ),
                    assignment_submissions ( count )
                `)
                .eq('school_id', schoolId);
            // Students see their class's work, and anything set for the whole
            // school; a student with no class sees only the latter.
            if (role === 'STUDENT') {
                query = student?.gradeStreamId
                    ? query.or(`grade_stream_id.eq.${student.gradeStreamId},grade_stream_id.is.null`)
                    : query.is('grade_stream_id', null);
            }
            return query.order('due_date', { ascending: true }).order('id') as unknown as {
                range: (from: number, to: number) => PromiseLike<{ data: AssignmentRow[] | null; error: unknown }>;
            };
        });
        if (error) return internalError('assignments list', error);

        const data = rows.map(toAssignment);
        // A learner has no business counting the class's submissions.
        if (role === 'STUDENT') for (const a of data) a.submissionCount = 0;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('assignments', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { schoolId, userId, role } = caller;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });
        if (!isRoleIn(role, STAFF_TEACHING_ROLES)) {
            return NextResponse.json({ error: 'Only admins and teachers can set assignments.' }, { status: 403 });
        }

        const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid assignment.' }, { status: 400 });
        }
        const body = parsed.data;
        const refsProblem = await assignmentRefsBelongToSchool(schoolId, body.subject_id, body.grade_stream_id);
        if (refsProblem) return NextResponse.json({ error: refsProblem }, { status: 404 });

        const { data, error } = await createSupabaseAdmin()
            .from('assignments')
            .insert({ school_id: schoolId, created_by: userId, ...body })
            .select('id')
            .single();
        if (error) return internalError('assignment insert', error);
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('assignment create', err);
    }
}
