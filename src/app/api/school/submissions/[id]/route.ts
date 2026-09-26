import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { gradeSubmissionSchema } from '@/lib/assignments';
import { authorizeAssignment } from '@/lib/assignments-server';

/**
 * Grades a submission. The admin, or the teacher who set the assignment:
 * the same people who may edit it. Any teacher in the school could once
 * grade any submission, and a grade of 0 was saved as "no grade".
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = createSupabaseAdmin();

        const { data: submission } = await supabase
            .from('assignment_submissions')
            .select('id, assignment_id')
            .eq('id', id)
            .maybeSingle();
        if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

        // Checks the assignment is the caller's school's and theirs to grade.
        const access = await authorizeAssignment(submission.assignment_id, 'edit');
        if (!access.ok) return access.response;

        const parsed = gradeSubmissionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid grade.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('assignment_submissions')
            .update({
                ...parsed.data,
                graded_by: access.caller.userId,
                graded_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id')
            .single();
        if (error) return internalError('submission grade', error);
        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('submission grade', err);
    }
}
