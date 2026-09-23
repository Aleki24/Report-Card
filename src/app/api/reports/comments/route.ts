import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { forbidden, getCaller, type Caller } from '@/lib/auth-server';

export const runtime = 'nodejs';

/**
 * Report comments belong to the admin (principal's comment) and the class's
 * own teacher (class teacher's comment). This route used to check nothing but
 * the school, so any signed-in account — a student included — could read the
 * whole class's comments and rewrite their own report card.
 */
type StudentNameRow = { users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null };

/** PostgREST types a to-one embed as an array; read it either way. */
function studentUser(row: StudentNameRow) {
    return Array.isArray(row.users) ? row.users[0] : row.users;
}

function canCommentOnStream(caller: Caller, gradeStreamId: string): boolean {
    return caller.role === 'ADMIN' || (caller.role === 'CLASS_TEACHER' && caller.classStreamIds.includes(gradeStreamId));
}

export async function GET(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return forbidden('Unauthorized', 401);

        const supabase = createSupabaseAdmin();
        const schoolId = caller.schoolId;
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
        if (!canCommentOnStream(caller, gradeStreamId)) {
            return forbidden('Only administrators and the class teacher can view report comments.');
        }

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
            student_name: `${studentUser(s)?.first_name || ''} ${studentUser(s)?.last_name || ''}`.trim(),
            comments_class_teacher: commentsMap.get(s.id)?.comments_class_teacher || '',
            comments_principal: commentsMap.get(s.id)?.comments_principal || '',
        }));

        // Sort by name
        result.sort((a, b) => a.student_name.localeCompare(b.student_name));

        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch comments' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return forbidden('Unauthorized', 401);

        const supabase = createSupabaseAdmin();
        const schoolId = caller.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const body = await request.json();
        const { student_id, term_id, academic_year_id, grade_stream_id, comments_class_teacher, comments_principal } = body;

        if (!student_id || !term_id || !academic_year_id || !grade_stream_id) {
            return NextResponse.json({ error: 'student_id, term_id, academic_year_id, and grade_stream_id are required' }, { status: 400 });
        }

        if (!canCommentOnStream(caller, grade_stream_id)) {
            return forbidden('Only administrators and the class teacher can edit report comments.');
        }

        // Verify the student belongs to the caller's school and to this class
        const { data: student } = await supabase
            .from('students')
            .select('id, current_grade_stream_id, users!inner(school_id)')
            .eq('id', student_id)
            .eq('users.school_id', schoolId)
            .maybeSingle();

        if (!student || student.current_grade_stream_id !== grade_stream_id) {
            return NextResponse.json({ error: 'Student not found in this class' }, { status: 403 });
        }

        // The principal's comment is the admin's to write; a class teacher's
        // save leaves whatever the admin wrote untouched.
        const comments: { comments_class_teacher: string | null; comments_principal?: string | null } = {
            comments_class_teacher: comments_class_teacher || null,
        };
        if (caller.role === 'ADMIN') comments.comments_principal = comments_principal || null;

        // Upsert into report_cards
        const { error } = await supabase
            .from('report_cards')
            .upsert({
                student_id,
                term_id,
                academic_year_id,
                grade_stream_id,
                ...comments,
            }, {
                onConflict: 'student_id,term_id,academic_year_id',
            });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save comments' }, { status: 500 });
    }
}
