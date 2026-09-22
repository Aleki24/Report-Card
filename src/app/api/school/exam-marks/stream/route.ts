import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveUserProfile } from '@/lib/auth-server';
import { getTeacherPermissions, isStreamVisibleToTeacher } from '@/lib/teacher-utils';
import { TEACHING_ROLES } from '@/lib/staff-roles';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createSupabaseAdmin();
    const userProfile = await getActiveUserProfile(userId);

    if (!userProfile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const schoolId = userProfile.school_id;
    if (!schoolId) return NextResponse.json({ data: [] });

    // Every learner's marks in a class is staff material. There was no role
    // check here at all, so any signed-in student could read their whole
    // class's results, released or not.
    const role = userProfile.role;
    if (!TEACHING_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    const examId = searchParams.get('exam_id');

    if (!streamId) return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });

    if (role !== 'ADMIN') {
      const { data: stream } = await supabase
        .from('grade_streams')
        .select('id, grade_id, school_id')
        .eq('id', streamId)
        .maybeSingle();
      if (!stream || stream.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isStreamVisibleToTeacher(stream, perms)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Scope to a single term/year. "Total points" and overall grade are a
    // per-term KCSE concept (points across a term's subjects); without this the
    // caller summed a student's marks across every term and year, so totals blew
    // past the points-band table and the overall grade showed '—' (or an
    // inflated grade early in a term). Derive the term from the current exam.
    let termId: string | null = null;
    let yearId: string | null = null;
    if (examId) {
        const { data: examRow } = await supabase
            .from('exams')
            .select('term_id, academic_year_id, school_id')
            .eq('id', examId)
            .maybeSingle();
        if (examRow && examRow.school_id === schoolId) {
            termId = examRow.term_id;
            yearId = examRow.academic_year_id;
        }
    }

    let query = supabase
        .from('exam_marks')
        .select(`
            id, raw_score, percentage, grade_symbol, student_id, exam_id, remarks,
            exams!inner ( id, name, subject_id, term_id, academic_year_id, subjects(name) ),
            students!inner ( current_grade_stream_id, admission_number, users!inner(first_name, last_name, school_id) )
        `)
        .eq('students.current_grade_stream_id', streamId)
        .eq('students.users.school_id', schoolId);

    if (termId) query = query.eq('exams.term_id', termId);
    if (yearId) query = query.eq('exams.academic_year_id', yearId);

    const { data: marks, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: marks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
