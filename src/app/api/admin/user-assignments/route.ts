import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { embedOne } from '@/lib/postgrest';

interface SubjectAssignment {
    id: string;
    subject_id: string;
    grade_id: string;
    grade_stream_id: string | null;
    subject_name: string;
    subject_code: string;
    grade_name: string;
}

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

        // Only admins can view other users' assignments
        if (userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('user_id');
        if (!targetUserId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }

        // Cross-tenant guard: the target user must belong to the caller's school
        const { data: targetProfile } = await supabase
            .from('users')
            .select('school_id')
            .eq('id', targetUserId)
            .maybeSingle();

        if (!targetProfile || targetProfile.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // This year's class and subjects: the edit form saves them back as
        // this year's, so earlier years' rows must not be offered as current.
        const currentYearId = await getCurrentAcademicYearId(supabase, userProfile.school_id);
        if (!currentYearId) {
            return NextResponse.json({ class_teacher: null, subject_teacher_id: null, subject_assignments: [] });
        }

        // 1. Get class teacher assignment
        const { data: classTeacherData } = await supabase
            .from('class_teachers')
            .select('id, current_grade_stream_id, grade_streams(full_name)')
            .eq('user_id', targetUserId)
            .eq('academic_year_id', currentYearId)
            .maybeSingle();

        // 2. Get subject teacher record + assignments
        const { data: subjectTeacherData } = await supabase
            .from('subject_teachers')
            .select('id')
            .eq('user_id', targetUserId)
            .maybeSingle();

        let subjectAssignments: SubjectAssignment[] = [];
        if (subjectTeacherData) {
            const { data: assignments } = await supabase
                .from('subject_teacher_assignments')
                .select('id, subject_id, grade_id, grade_stream_id, subjects(name, code), grades(name_display)')
                .eq('subject_teacher_id', subjectTeacherData.id)
                .eq('academic_year_id', currentYearId);

            subjectAssignments = (assignments ?? []).map(a => ({
                id: a.id,
                subject_id: a.subject_id,
                grade_id: a.grade_id,
                grade_stream_id: a.grade_stream_id,
                subject_name: embedOne<{ name: string }>(a.subjects)?.name ?? '',
                subject_code: embedOne<{ code: string }>(a.subjects)?.code ?? '',
                grade_name: embedOne<{ name_display: string }>(a.grades)?.name_display ?? '',
            }));
        }

        return NextResponse.json({
            class_teacher: classTeacherData
                ? {
                    id: classTeacherData.id,
                    grade_stream_id: classTeacherData.current_grade_stream_id,
                    grade_stream_name: embedOne<{ full_name: string }>(classTeacherData.grade_streams)?.full_name ?? '',
                }
                : null,
            subject_teacher_id: subjectTeacherData?.id || null,
            subject_assignments: subjectAssignments,
        });
    } catch (error: unknown) {
        console.error('Error fetching user assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
