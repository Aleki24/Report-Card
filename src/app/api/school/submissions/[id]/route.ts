import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        // Verify submission belongs to the grader's school
        const { data: subCheck } = await supabase
            .from('assignment_submissions')
            .select(`
                id,
                students!inner (
                    users!inner ( school_id )
                )
            `)
            .eq('id', id)
            .eq('students.users.school_id', userProfile.school_id)
            .maybeSingle();

        if (!subCheck) {
            return NextResponse.json({ error: 'Submission not found in your school' }, { status: 404 });
        }

        const updateData: Record<string, any> = {
            graded_by: userId,
            graded_at: new Date().toISOString(),
        };

        if (body.grade !== undefined) updateData.grade = body.grade;
        if (body.feedback !== undefined) updateData.feedback = body.feedback;

        const { data, error } = await supabase
            .from('assignment_submissions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
