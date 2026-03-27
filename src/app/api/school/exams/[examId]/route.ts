import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { examId } = await params;

        if (!examId) {
            return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
        }

        // Verify session user and get school
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', session.user.id)
            .single();

        if (!userProfile || !userProfile.school_id) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
        }

        // Verify the exam belongs to the user's school
        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, created_by_teacher_id')
            .eq('id', examId)
            .single();

        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        // Only admins or the teacher who created it can delete
        if (userProfile.role !== 'ADMIN' && exam.created_by_teacher_id !== session.user.id) {
            return NextResponse.json({ error: 'You can only delete exams you created' }, { status: 403 });
        }

        // Delete related exam_marks first
        await supabase.from('exam_marks').delete().eq('exam_id', examId);

        // Delete the exam
        const { error } = await supabase.from('exams').delete().eq('id', examId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
