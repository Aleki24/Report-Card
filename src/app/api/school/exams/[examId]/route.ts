import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { examId } = await params;

        if (!examId) {
            return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
        }

        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || !userProfile.school_id) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
        }

        // Verify the exam belongs to the user's school
        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, created_by_teacher_id')
            .eq('id', examId)
            .maybeSingle();

        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        // Only admins or the teacher who created it can update
        if (userProfile.role !== 'ADMIN' && exam.created_by_teacher_id !== userId) {
            return NextResponse.json({ error: 'You can only update exams you created' }, { status: 403 });
        }

        const body = await request.json();
        const updateData: Record<string, any> = {};

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.max_score !== undefined) updateData.max_score = Number(body.max_score);
        if (body.exam_type !== undefined) updateData.exam_type = body.exam_type;
        if (body.exam_date !== undefined) updateData.exam_date = body.exam_date || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('exams')
            .update(updateData)
            .eq('id', examId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { examId } = await params;

        if (!examId) {
            return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
        }

        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || !userProfile.school_id) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
        }

        // Verify the exam belongs to the user's school
        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, created_by_teacher_id')
            .eq('id', examId)
            .maybeSingle();

        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        // Only admins or the teacher who created it can delete
        if (userProfile.role !== 'ADMIN' && exam.created_by_teacher_id !== userId) {
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
