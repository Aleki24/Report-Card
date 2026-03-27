// src/app/api/admin/user-assignments/route.ts
// ============================================================
// Fetches a user's class teacher and subject teacher assignments
// for use in the admin edit-user modal.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !(session.user as any).role) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can view other users' assignments
        if ((session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        if (!userId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 1. Get class teacher assignment
        const { data: classTeacherData } = await supabase
            .from('class_teachers')
            .select('id, current_grade_stream_id, academic_year_id, grade_streams(id, full_name, grade_id)')
            .eq('user_id', userId);

        // 2. Get subject teacher record + assignments
        const { data: subjectTeacherData } = await supabase
            .from('subject_teachers')
            .select('id')
            .eq('user_id', userId)
            .single();

        let subjectAssignments: any[] = [];
        if (subjectTeacherData) {
            const { data: assignments } = await supabase
                .from('subject_teacher_assignments')
                .select('id, subject_id, grade_id, grade_stream_id, academic_year_id, subjects(id, name, code), grades(id, name_display)')
                .eq('subject_teacher_id', subjectTeacherData.id);

            subjectAssignments = (assignments || []).map(a => ({
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
