import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET — Fetch comments for all students in a class for a given term/year.
 * Query: ?grade_stream_id=...&term_id=...&academic_year_id=...
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const schoolId = session.user.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const gradeStreamId = searchParams.get('grade_stream_id');
        const termId = searchParams.get('term_id');
        const academicYearId = searchParams.get('academic_year_id');

        if (!gradeStreamId || !termId || !academicYearId) {
            return NextResponse.json({ error: 'grade_stream_id, term_id, and academic_year_id are required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // Fetch students in the class (scoped to school)
        const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('id, admission_number, users!inner(first_name, last_name, school_id)')
            .eq('current_grade_stream_id', gradeStreamId)
            .eq('users.school_id', schoolId);

        if (studentsErr) {
            return NextResponse.json({ error: studentsErr.message }, { status: 500 });
        }

        if (!students || students.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const studentIds = students.map(s => s.id);

        // Fetch existing report_card comments
        const { data: reportCards } = await supabase
            .from('report_cards')
            .select('student_id, comments_class_teacher, comments_principal')
            .in('student_id', studentIds)
            .eq('term_id', termId)
            .eq('academic_year_id', academicYearId);

        const commentsMap = new Map<string, { comments_class_teacher: string; comments_principal: string }>();
        if (reportCards) {
            for (const rc of reportCards) {
                commentsMap.set(rc.student_id, {
                    comments_class_teacher: rc.comments_class_teacher || '',
                    comments_principal: rc.comments_principal || '',
                });
            }
        }

        const result = students.map(s => ({
            student_id: s.id,
            admission_number: s.admission_number,
            student_name: `${(s.users as any)?.first_name || ''} ${(s.users as any)?.last_name || ''}`.trim(),
            comments_class_teacher: commentsMap.get(s.id)?.comments_class_teacher || '',
            comments_principal: commentsMap.get(s.id)?.comments_principal || '',
        }));

        // Sort by name
        result.sort((a, b) => a.student_name.localeCompare(b.student_name));

        return NextResponse.json({ data: result });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to fetch comments' }, { status: 500 });
    }
}

/**
 * POST — Save comments for a student's report card (upsert).
 * Body: { student_id, term_id, academic_year_id, grade_stream_id, comments_class_teacher?, comments_principal? }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const schoolId = session.user.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const body = await request.json();
        const { student_id, term_id, academic_year_id, grade_stream_id, comments_class_teacher, comments_principal } = body;

        if (!student_id || !term_id || !academic_year_id || !grade_stream_id) {
            return NextResponse.json({ error: 'student_id, term_id, academic_year_id, and grade_stream_id are required' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // Verify student belongs to the caller's school
        const { data: student } = await supabase
            .from('students')
            .select('id, users!inner(school_id)')
            .eq('id', student_id)
            .single();

        if (!student || (student.users as any)?.school_id !== schoolId) {
            return NextResponse.json({ error: 'Student not found or belongs to another school' }, { status: 403 });
        }

        // Upsert into report_cards
        const { error } = await supabase
            .from('report_cards')
            .upsert({
                student_id,
                term_id,
                academic_year_id,
                grade_stream_id,
                comments_class_teacher: comments_class_teacher || null,
                comments_principal: comments_principal || null,
            }, {
                onConflict: 'student_id,term_id,academic_year_id',
            });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to save comments' }, { status: 500 });
    }
}
