import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isStudentVisibleToTeacher } from '@/lib/teacher-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = (await params).studentId;
    const supabase = createSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('school_id, role, is_active').eq('id', userId).maybeSingle();
    if (!userData || userData.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const schoolId = userData?.school_id as string | null;
    const role = userData?.role as string | null;
    if (!schoolId || !role) {
      return NextResponse.json({ error: 'No school associated or invalid role' }, { status: 403 });
    }

    if (role === 'STUDENT' && userId !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Student profile
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select(`
        id, admission_number, status, academic_level_id, current_grade_stream_id,
        guardian_phone, guardian_name, guardian_email, gender, date_of_birth, date_enrolled, created_at, avatar_url,
        pathway, track, subject_combination_id,
        users!inner (first_name, last_name, email, phone, school_id),
        grade_streams (id, full_name, grade_id),
        academic_levels (id, name, code),
        subject_combinations (id, code, name, pathway, track)
      `)
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentUser = Array.isArray(student.users) ? student.users[0] : student.users;
    if (!studentUser || studentUser.school_id !== schoolId) {
      return NextResponse.json({ error: 'Cannot access data from another school' }, { status: 403 });
    }

    if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
      const perms = await getTeacherPermissions(userId);
      if (!isStudentVisibleToTeacher(student, perms)) {
        return NextResponse.json({ error: 'Not authorized to view this student' }, { status: 403 });
      }
    }

    // 2. Academic history — marks grouped by term
    const { data: currentYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let academicHistory: {
      term_id: string;
      term_name: string;
      subjects: { subject_name: string; percentage: number; grade_symbol: string | null }[];
      average: number;
    }[] = [];

    if (currentYear) {
      const { data: terms } = await supabase
        .from('terms')
        .select('id, name')
        .eq('academic_year_id', currentYear.id)
        .order('start_date');

      if (terms) {
        for (const term of terms) {
          const { data: marks } = await supabase
            .from('exam_marks')
            .select(`
              percentage, grade_symbol, raw_score,
              exams!inner ( name, max_score, subjects ( name ) )
            `)
            .eq('student_id', studentId)
            .eq('exams.term_id', term.id);

          const subjects = (marks || []).map((m: any) => ({
            subject_name: m.exams?.subjects?.name || 'Unknown',
            percentage: Number(m.percentage),
            grade_symbol: m.grade_symbol,
          }));

          const avg = subjects.length > 0
            ? Math.round(subjects.reduce((s, sub) => s + sub.percentage, 0) / subjects.length)
            : 0;

          academicHistory.push({
            term_id: term.id,
            term_name: term.name,
            subjects,
            average: avg,
          });
        }
      }
    }

    // 2.5 Subject enrollments (CBC senior pathway feature)
    const { data: enrollments } = await supabase
      .from('student_subjects')
      .select('role, subjects ( id, name, code )')
      .eq('student_id', studentId);
    const enrolledSubjects = (enrollments || [])
      .map((e: any) => ({ role: e.role, ...((Array.isArray(e.subjects) ? e.subjects[0] : e.subjects) || {}) }))
      .filter((s: any) => s.id)
      .sort((a: any, b: any) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'CORE' ? -1 : 1));

    // 3. Report history
    const { data: reportCards } = await supabase
      .from('report_cards')
      .select(`
        id, created_at, overall_average, overall_position,
        term_id, academic_year_id,
        terms ( name ),
        academic_years ( name )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    const reportHistory = (reportCards || []).map((rc: any) => ({
      id: rc.id,
      generated_at: rc.created_at,
      term: rc.terms?.name || '—',
      year: rc.academic_years?.name || '—',
      average: rc.overall_average,
      position: rc.overall_position,
    }));

    // 4. Attendance history — from report_cards attendance fields
    const { data: attendanceRecords } = await supabase
      .from('report_cards')
      .select(`
        id, attendance_present, attendance_total,
        term_id, academic_year_id,
        terms ( name ),
        academic_years ( name )
      `)
      .eq('student_id', studentId)
      .not('attendance_present', 'is', null)
      .order('created_at', { ascending: false });

    const attendanceHistory = (attendanceRecords || []).map((rc: any) => ({
      id: rc.id,
      term: rc.terms?.name || '—',
      year: rc.academic_years?.name || '—',
      present: rc.attendance_present ?? 0,
      total: rc.attendance_total ?? 0,
      percentage: rc.attendance_total > 0
        ? Math.round((rc.attendance_present / rc.attendance_total) * 100)
        : null,
    }));

    return NextResponse.json({
      profile: {
        id: student.id,
        first_name: studentUser?.first_name,
        last_name: studentUser?.last_name,
        email: studentUser?.email,
        phone: studentUser?.phone,
        avatar_url: student.avatar_url,
        admission_number: student.admission_number,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        date_enrolled: student.date_enrolled,
        status: student.status,
        guardian_name: student.guardian_name,
        guardian_phone: student.guardian_phone,
        guardian_email: student.guardian_email,
        grade_stream: student.grade_streams,
        academic_level: student.academic_levels,
        pathway: (student as any).pathway,
        track: (student as any).track,
        subject_combination: (student as any).subject_combinations,
        enrolled_subjects: enrolledSubjects,
      },
      academicHistory,
      reportHistory,
      attendanceHistory,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
