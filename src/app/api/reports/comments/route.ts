import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { authorizeClassReport } from '@/lib/reports/report-access';
import { internalError } from '@/lib/api-errors';

export const runtime = 'nodejs';

const COMMENTS_FORBIDDEN = 'Only administrators and the designated class teacher can manage report comments.';

interface StudentName {
    first_name: string | null;
    last_name: string | null;
}

interface ReportCommentRow {
    student_id: string;
    term_id: string;
    academic_year_id: string;
    grade_stream_id: string;
    comments_class_teacher: string | null;
    comments_principal?: string | null;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gradeStreamId = searchParams.get('grade_stream_id');
        const termId = searchParams.get('term_id');
        const academicYearId = searchParams.get('academic_year_id');

        if (!gradeStreamId || !termId || !academicYearId) {
            return NextResponse.json({ error: 'grade_stream_id, term_id, and academic_year_id are required' }, { status: 400 });
        }

        // Report comments belong to the people who write report cards: the
        // same audience as the class report itself.
        const access = await authorizeClassReport(gradeStreamId, COMMENTS_FORBIDDEN);
        if (!access.ok) return access.response;
        const schoolId = access.session.schoolId;

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

        const result = students.map(s => {
            // PostgREST types a to-one embed as an array; it is one row here.
            const user = (Array.isArray(s.users) ? s.users[0] : s.users) as StudentName | null | undefined;
            return {
                student_id: s.id,
                admission_number: s.admission_number,
                student_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
                comments_class_teacher: commentsMap.get(s.id)?.comments_class_teacher || '',
                comments_principal: commentsMap.get(s.id)?.comments_principal || '',
            };
        });

        // Sort by name
        result.sort((a, b) => a.student_name.localeCompare(b.student_name));

        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        return internalError('report comments', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { student_id, term_id, academic_year_id, grade_stream_id, comments_class_teacher, comments_principal } = body;

        if (!student_id || !term_id || !academic_year_id || !grade_stream_id) {
            return NextResponse.json({ error: 'student_id, term_id, academic_year_id, and grade_stream_id are required' }, { status: 400 });
        }

        // There was no role check here, so any member of the school — a
        // learner included — could write the class teacher's and principal's
        // remarks onto a report card.
        const access = await authorizeClassReport(grade_stream_id, COMMENTS_FORBIDDEN);
        if (!access.ok) return access.response;
        const schoolId = access.session.schoolId;

        const supabase = createSupabaseAdmin();

        // The student must be in the class being commented on, and the term
        // and year must be this school's.
        const [{ data: student }, { data: term }] = await Promise.all([
            supabase
                .from('students')
                .select('id, current_grade_stream_id, users!inner(school_id)')
                .eq('id', student_id)
                .eq('users.school_id', schoolId)
                .maybeSingle(),
            supabase
                .from('terms')
                .select('id')
                .eq('id', term_id)
                .eq('academic_year_id', academic_year_id)
                .eq('school_id', schoolId)
                .maybeSingle(),
        ]);

        if (!student || student.current_grade_stream_id !== grade_stream_id) {
            return NextResponse.json({ error: 'Student not found in this class' }, { status: 404 });
        }
        if (!term) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        // The principal's remark is the admin's to write. A class teacher's
        // save leaves it out of the upsert, which keeps whatever is stored
        // instead of overwriting it with the value their page loaded.
        const row: ReportCommentRow = {
            student_id,
            term_id,
            academic_year_id,
            grade_stream_id,
            comments_class_teacher: comments_class_teacher || null,
        };
        if (access.session.role === 'ADMIN') {
            row.comments_principal = comments_principal || null;
        }

        const { error } = await supabase
            .from('report_cards')
            .upsert(row, {
                onConflict: 'student_id,term_id,academic_year_id',
            });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('report comments', err);
    }
}
