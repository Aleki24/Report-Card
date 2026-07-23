import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';

const VALID_ACTIONS = ['publish', 'approve', 'unpublish'] as const;
type Action = typeof VALID_ACTIONS[number];

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = await params;
        if (!examId) {
            return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const action = body.action as Action;
        if (!VALID_ACTIONS.includes(action)) {
            return NextResponse.json({ error: `Invalid action. Use one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
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
        if (!userProfile.school_id) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
        }

        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, status, created_by_teacher_id, grade_id, grade_stream_id, subject_id, published_by, name')
            .eq('id', examId)
            .maybeSingle();

        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        const isAdmin = userProfile.role === 'ADMIN';

        // "Those who added" = the teacher who created the exam, or a class/subject
        // teacher whose assignment covers it — the same visibility rule already
        // used to decide who can see/enter marks for this exam.
        const canActAsOwner = async () => {
            if (isAdmin) return true;
            const perms = await getTeacherPermissions(userId);
            return isExamVisibleToTeacher(exam, perms, userId);
        };

        if (action === 'publish') {
            if (exam.status !== 'DRAFT') {
                return NextResponse.json({ error: `Cannot publish — results are already ${exam.status === 'PENDING_APPROVAL' ? 'pending approval' : 'approved'}.` }, { status: 409 });
            }
            if (!(await canActAsOwner())) {
                return NextResponse.json({ error: 'Only the teacher who entered these marks (or an admin) can publish them.' }, { status: 403 });
            }
            const { count: markCount } = await supabase
                .from('exam_marks')
                .select('id', { count: 'exact', head: true })
                .eq('exam_id', examId);
            if (!markCount) {
                return NextResponse.json({ error: 'Enter at least one student\'s marks before publishing.' }, { status: 400 });
            }

            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'PENDING_APPROVAL', published_by: userId, published_at: new Date().toISOString() })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated });
        }

        if (action === 'approve') {
            if (!isAdmin) {
                return NextResponse.json({ error: 'Only an admin can approve results.' }, { status: 403 });
            }
            if (exam.status !== 'PENDING_APPROVAL') {
                return NextResponse.json({ error: exam.status === 'DRAFT' ? 'These results have not been published yet.' : 'These results are already approved.' }, { status: 409 });
            }
            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'APPROVED', approved_by: userId, approved_at: new Date().toISOString() })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated });
        }

        // unpublish
        if (exam.status === 'DRAFT') {
            return NextResponse.json({ error: 'These results are already in draft.' }, { status: 409 });
        }
        if (exam.status === 'PENDING_APPROVAL') {
            // Reverting a pending publish — same people who could publish it.
            if (!(await canActAsOwner())) {
                return NextResponse.json({ error: 'Only the teacher who published these marks (or an admin) can unpublish them.' }, { status: 403 });
            }
            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'DRAFT', published_by: null, published_at: null })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated });
        }
        // status === 'APPROVED' — undoing an approval is an admin-only action
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only an admin can unpublish already-approved results.' }, { status: 403 });
        }
        const { data: updated, error } = await supabase
            .from('exams')
            .update({ status: 'PENDING_APPROVAL', approved_by: null, approved_at: null })
            .eq('id', examId)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, data: updated });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
