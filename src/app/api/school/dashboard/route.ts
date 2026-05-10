import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = session.user.schoolId as string | null;
    const userId = session.user.id as string;
    const role = session.user.role as string;

    if (!schoolId) {
      return NextResponse.json({
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        totalReports: 0,
        attendanceToday: null,
        upcomingExams: [],
        recentActivities: [],
      });
    }

    const supabase = createSupabaseAdmin();

    const [studentsRes, usersRes, streamsRes, reportsRes, currentYearRes] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('users.school_id', schoolId),
      supabase.from('users').select('id, role').eq('school_id', schoolId).in('role', ['CLASS_TEACHER', 'SUBJECT_TEACHER']),
      supabase.from('grade_streams').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('report_cards').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('academic_years').select('id').eq('school_id', schoolId).order('start_date', { ascending: false }).limit(1).single(),
    ]);

    const currentYear = currentYearRes?.data;
    const totalStudents = studentsRes.count ?? 0;
    const totalTeachers = usersRes.data?.length ?? 0;
    const totalClasses = streamsRes.count ?? 0;
    const totalReports = reportsRes.count ?? 0;

    let upcomingExams: any[] = [];
    if (currentYear) {
      const { data: exams } = await supabase
        .from('exams')
        .select(`
          id, name, exam_type, exam_date, max_score,
          subjects:subject_id ( name ),
          grades:grade_id ( name_display )
        `)
        .eq('school_id', schoolId)
        .eq('academic_year_id', currentYear.id)
        .gte('exam_date', new Date().toISOString().split('T')[0])
        .order('exam_date', { ascending: true })
        .limit(5);

      if (exams) {
        upcomingExams = exams.map((e: any) => ({
          id: e.id,
          name: e.name,
          exam_type: e.exam_type,
          exam_date: e.exam_date,
          subject_name: e.subjects?.name || 'N/A',
          grade_name: e.grades?.name_display || 'N/A',
        }));
      }
    }

    const activities: {
      type: string;
      message: string;
      timestamp: string;
      href?: string;
    }[] = [];

    const [recentReports, recentStudents, recentMarks] = await Promise.all([
      currentYear
        ? supabase
            .from('report_cards')
            .select('id, created_at, grade_stream_id')
            .eq('school_id', schoolId)
            .eq('academic_year_id', currentYear.id)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      supabase
        .from('students')
        .select('id, created_at, users!inner(first_name, last_name)')
        .eq('users.school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(5),
      currentYear
        ? supabase
            .from('exam_marks')
            .select('id, created_at, percentage, exam_id, exams!inner(name, subject_id, subjects(name))')
            .eq('exams.academic_year_id', currentYear.id)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    for (const r of (recentReports.data || []) as any[]) {
      activities.push({
        type: 'report',
        message: 'Report cards generated',
        timestamp: r.created_at,
        href: '/dashboard/reports',
      });
    }

    for (const s of (recentStudents.data || []) as any[]) {
      const name = s.users ? `${s.users.first_name} ${s.users.last_name}` : 'A student';
      activities.push({
        type: 'student',
        message: `${name} was enrolled`,
        timestamp: s.created_at,
        href: '/dashboard/students',
      });
    }

    for (const m of (recentMarks.data || []) as any[]) {
      const examName = (m.exams as any)?.name || 'Unknown exam';
      const subjectName = (m.exams as any)?.subjects?.name || '';
      activities.push({
        type: 'mark',
        message: `Marks entered for ${examName}${subjectName ? ` (${subjectName})` : ''}`,
        timestamp: m.created_at,
        href: '/dashboard/marks',
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivities = activities.slice(0, 10);

    return NextResponse.json({
      totalStudents,
      totalTeachers,
      totalClasses,
      totalReports,
      attendanceToday: null,
      upcomingExams,
      recentActivities,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
