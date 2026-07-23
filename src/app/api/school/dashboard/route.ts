import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { findActiveTermId } from '@/lib/term-calendar';

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = userProfile?.school_id as string | null;
    const role = userProfile?.role as string;

    if (!schoolId) {
      return NextResponse.json({
        totalStudents: 0,
        totalTeachers: 0,
        totalUsers: 0,
        totalClasses: 0,
        totalReports: 0,
        attendanceToday: null,
        upcomingExams: [],
        recentActivities: [],
        hasLogo: false,
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [studentsRes, usersRes, teachersRes, streamsRes, reportsRes, currentYearRes, overdueFeesRes, announcementsRes, recentEnrollmentsRes, termsRes, schoolRes] = await Promise.all([
      supabase.from('students').select('id, users!inner(school_id)', { count: 'exact', head: true }).eq('users.school_id', schoolId),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('users').select('id, role').eq('school_id', schoolId).in('role', ['CLASS_TEACHER', 'SUBJECT_TEACHER']),
      supabase.from('grade_streams').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('report_cards').select('id, grade_streams!inner(school_id)', { count: 'exact', head: true }).eq('grade_streams.school_id', schoolId),
      supabase.from('academic_years').select('id').eq('school_id', schoolId).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('student_fees').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).not('status', 'eq', 'PAID').lt('due_date', today),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).gte('created_at', sevenDaysAgo),
      supabase.from('students').select('id, date_enrolled, users!inner(school_id)', { count: 'exact', head: true }).eq('users.school_id', schoolId).gte('date_enrolled', sevenDaysAgo),
      supabase.from('terms').select('id, name, start_date, end_date, is_current').eq('school_id', schoolId),
      supabase.from('schools').select('logo_url').eq('id', schoolId).maybeSingle(),
    ]);

    const currentYear = currentYearRes?.data;
    const activeTermId = findActiveTermId(termsRes?.data || []);
    const currentTerm = (termsRes?.data || []).find(t => t.id === activeTermId) || null;
    const totalStudents = studentsRes.count ?? 0;
    const totalUsers = usersRes.count ?? 0;
    const totalTeachers = teachersRes.data?.length ?? 0;
    const totalClasses = streamsRes.count ?? 0;
    const totalReports = reportsRes.count ?? 0;
    const overdueFeesCount = overdueFeesRes.count ?? 0;
    const announcementsLast7Days = announcementsRes.count ?? 0;
    const recentEnrollmentsLast7 = recentEnrollmentsRes.count ?? 0;
    const hasLogo = Boolean(schoolRes.data?.logo_url);

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

    const [recentReports, recentStudents, recentMarks, attendanceRes, financeRes, academicMarksRes] = await Promise.all([
      currentYear
        ? supabase
            .from('report_cards')
            .select('id, generated_at, grade_stream_id, grade_streams!inner(school_id)')
            .eq('grade_streams.school_id', schoolId)
            .eq('academic_year_id', currentYear.id)
            .order('generated_at', { ascending: false })
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
      supabase
        .from('daily_attendance')
        .select('status')
        .eq('school_id', schoolId)
        .eq('date', today),
      currentTerm
        ? supabase
            .from('student_fees')
            .select('total_fee, paid_amount, status')
            .eq('school_id', schoolId)
            .eq('term_id', currentTerm.id)
        : Promise.resolve({ data: [] }),
      currentYear
        ? supabase
            .from('exam_marks')
            .select('percentage, exams!inner(school_id, academic_year_id)')
            .eq('exams.school_id', schoolId)
            .eq('exams.academic_year_id', currentYear.id)
            .limit(500)
        : Promise.resolve({ data: [] }),
    ]);

    for (const r of (recentReports.data || []) as any[]) {
      activities.push({
        type: 'report',
        message: 'Report cards generated',
        timestamp: r.generated_at,
        href: '/dashboard/reports',
      });
    }

    for (const s of (recentStudents.data || []) as any[]) {
      const name = s.users ? `${s.users.first_name} ${s.users.last_name}` : 'A student';
      activities.push({
        type: 'student',
        message: `${name} was enrolled`,
        timestamp: s.created_at,
        href: '/dashboard/people',
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

    // ── Attendance Today ──
    const attendanceRows = (attendanceRes.data || []) as { status: string }[];
    const presentCount = attendanceRows.filter(r => r.status === 'present').length;
    const absentCount = attendanceRows.filter(r => r.status === 'absent').length;
    const lateCount = attendanceRows.filter(r => r.status === 'late').length;
    const excusedCount = attendanceRows.filter(r => r.status === 'excused').length;

    // ── Finance Summary ──
    const feeRows = (financeRes.data || []) as { total_fee: number; paid_amount: number; status: string }[];
    const totalCollected = feeRows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const totalFeeAmount = feeRows.reduce((s, r) => s + Number(r.total_fee || 0), 0);
    const unpaidBalance = totalFeeAmount - totalCollected;

    // ── Academic Performance ──
    const markRows = (academicMarksRes.data || []) as { percentage: number }[];
    const recentAvg = markRows.length > 0
      ? Math.round(markRows.reduce((s, r) => s + Number(r.percentage || 0), 0) / markRows.length)
      : null;

    return NextResponse.json({
      totalStudents,
      totalTeachers,
      totalUsers,
      totalClasses,
      totalReports,
      attendanceToday: { present: presentCount, absent: absentCount, late: lateCount, excused: excusedCount },
      upcomingExams,
      recentActivities,
      overdueFeesCount,
      announcementsLast7Days,
      recentEnrollmentsLast7,
      financeSummary: { totalCollected: Math.round(totalCollected * 100) / 100, unpaidBalance: Math.round(unpaidBalance * 100) / 100, overdueCount: overdueFeesCount },
      academicSummary: { recentAvg },
      hasLogo,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
