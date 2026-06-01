import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
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
            .single();

        // Only admins can view other users' assignments
        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('user_id');
        if (!targetUserId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        // 1. Get class teacher assignment
        const { data: classTeacherData } = await supabase
            .from('class_teachers')
            .select('id, current_grade_stream_id, academic_year_id, grade_streams(id, full_name, grade_id)')
            .eq('user_id', targetUserId);

        // 2. Get subject teacher record + assignments
        const { data: subjectTeacherData } = await supabase
            .from('subject_teachers')
            .select('id')
            .eq('user_id', targetUserId)
            .single();

        let subjectAssignments: any[] = [];
        if (subjectTeacherData) {
            const { data: assignments } = await supabase
                .from('subject_teacher_assignments')
                .select('id, subject_id, grade_id, grade_stream_id, academic_year_id, subjects(id, name, code), grades(id, name_display)')
                .eq('subject_teacher_id', subjectTeacherData.id);

            subjectAssignments = (assignments || []).map((a: any) => ({
                id: a.id,
                subject_id: a.subject_id,
                grade_id: a.grade_id,
                grade_stream_id: a.grade_stream_id,
                subject_name: (a.subjects as any)?.name || '',
                subject_code: (a.subjects as any)?.code || '',
                grade_name: (a.grades as any)?.name_display || '',
            }));
        }

        return NextResponse.json({
            class_teacher: classTeacherData && classTeacherData.length > 0
                ? {
                    id: classTeacherData[0].id,
                    grade_stream_id: classTeacherData[0].current_grade_stream_id,
                    grade_stream_name: (classTeacherData[0].grade_streams as any)?.full_name || '',
                }
                : null,
            subject_teacher_id: subjectTeacherData?.id || null,
            subject_assignments: subjectAssignments,
        });
    } catch (error: any) {
        console.error('Error fetching user assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
