import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveUserProfile } from '@/lib/auth-server';
import type { ReportSummary, StudentProfileResponse } from '@/types/user-profile';
import type { UserRole } from '@/types';
import { getStudentReportCards, type StudentRef } from '@/lib/student/queries';
import { termAttendance, termPerformance } from '@/lib/student/profile-history';
import { canStaffReportOnStream } from '@/lib/reports/report-access';
import { embedOne } from '@/lib/postgrest';
import { getTeacherPermissions, isStudentVisibleToTeacher } from '@/lib/teacher-utils';
import { getAccess, seesAllStudents } from '@/lib/platform/access';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';

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
    const userData = await getActiveUserProfile(userId);
    if (!userData) {
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

    // Admins, the learner, their teachers and staff whose duty spans the
    // school (nurse, bursar, boarding) may see the profile. Parents use the
    // parent portal, which shows only their own children.
    if (role !== 'ADMIN' && role !== 'STUDENT') {
      const teaches = (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER')
        && isStudentVisibleToTeacher(student, await getTeacherPermissions(userId));
      if (!teaches && !seesAllStudents(await getAccess())) {
        return NextResponse.json({ error: 'Not authorized to view this student' }, { status: 403 });
      }
    }

    // Report cards, term performance and attendance, side by side.
    const stream = embedOne(student.grade_streams);
    const ref: StudentRef = {
      studentId,
      schoolId,
      academicLevelId: student.academic_level_id ?? '',
      gradeStreamId: stream?.id ?? student.current_grade_stream_id ?? '',
    };
    const [academicHistory, reportCards, attendanceHistory, enrollments, canOpenReports] = await Promise.all([
      termPerformance(supabase, schoolId, studentId, isRoleIn(role, STAFF_TEACHING_ROLES)),
      // The cards the learner and their parents see: every term with released results.
      getStudentReportCards(ref),
      termAttendance(supabase, schoolId, studentId),
      supabase.from('student_subjects').select('role, subjects ( id, name, code )').eq('student_id', studentId),
      // The same rule the report card itself applies.
      role === 'STUDENT' || (!!ref.gradeStreamId && canStaffReportOnStream({ role: role as UserRole, userId }, ref.gradeStreamId)),
    ]);

    // Subject enrolments (CBC senior pathways)
    const enrolledSubjects = (enrollments.data || [])
      .map((e: any) => ({ role: e.role, ...((Array.isArray(e.subjects) ? e.subjects[0] : e.subjects) || {}) }))
      .filter((s: any) => s.id)
      .sort((a: any, b: any) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'CORE' ? -1 : 1));

    const reportHistory: ReportSummary[] = reportCards.map(rc => ({
      id: rc.id,
      term_id: rc.terms.id,
      year_id: rc.academic_years.id,
      generated_at: rc.generated_at,
      term: rc.terms.name,
      year: rc.academic_years.name,
      average: rc.overall_average,
      position: rc.overall_position,
      subjects: rc.report_card_subjects.length,
      href: `/api/reports/student/${studentId}?${new URLSearchParams({ term: rc.terms.id, year: rc.academic_years.id }).toString()}`,
    }));

    return NextResponse.json<StudentProfileResponse>({
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
        grade_stream: embedOne(student.grade_streams),
        academic_level: embedOne(student.academic_levels),
        pathway: (student as any).pathway,
        track: (student as any).track,
        subject_combination: (student as any).subject_combinations,
        enrolled_subjects: enrolledSubjects,
      },
      academicHistory,
      reportHistory,
      attendanceHistory,
      canOpenReports,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
