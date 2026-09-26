import { NextRequest, NextResponse } from 'next/server';
import type { SetupStatus } from '@/lib/setup-status';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { findActiveTermId } from '@/lib/term-calendar';
import { PASS_MARK, passMarkOrDefault } from '@/lib/pass-mark';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { schoolToday } from '@/lib/dates';
import { getExamType } from '@/lib/exam-types';

/** One row of the `school_mark_summary` function; numerics arrive as strings. */
interface MarkSummaryRow {
  mark_count: number | string;
  mean_percentage: number | string | null;
  pass_count: number | string;
}

/** One row of `school_class_performance`. */
interface ClassPerformanceRow {
  grade_stream_id: string;
  full_name: string;
  level_code: string | null;
  student_count: number | string;
  mark_count: number | string;
  mean_percentage: number | string | null;
  pass_count: number | string;
}

/** One row of `school_unmarked_exams`. */
interface UnmarkedExamRow {
  label: string;
  level_code: string | null;
  unmarked_count: number | string;
}

/** Where the school is in its calendar, from its own terms. */
export type TermSummary =
  | { kind: 'in-term'; name: string; year: string | null; week: number; weeks: number; daysLeft: number; endDate: string }
  | { kind: 'break'; lastName: string | null; nextName: string | null; nextStart: string | null }
  | { kind: 'none' };

type TermRow = { id: string; name: string; start_date: string | null; end_date: string | null; academic_year_id: string | null };

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

function describeTerm(terms: readonly TermRow[], current: TermRow | null, yearName: string | null, today: string): TermSummary {
  if (current?.start_date && current.end_date && current.start_date <= today && today <= current.end_date) {
    const weeks = Math.max(1, Math.ceil((days(current.start_date, current.end_date) + 1) / 7));
    const week = Math.min(weeks, Math.floor(days(current.start_date, today) / 7) + 1);
    return { kind: 'in-term', name: current.name, year: yearName, week, weeks, daysLeft: days(today, current.end_date), endDate: current.end_date };
  }
  const dated = terms.filter(t => t.start_date && t.end_date).sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1));
  if (dated.length === 0) return { kind: 'none' };
  const next = dated.find(t => t.start_date! > today) ?? null;
  const last = [...dated].reverse().find(t => t.end_date! < today) ?? null;
  return { kind: 'break', lastName: last?.name ?? null, nextName: next?.name ?? null, nextStart: next?.start_date ?? null };
}

/** An exam sitting coming up: one class's round, rather than one row per paper. */
export interface UpcomingRound { key: string; label: string; className: string; firstDate: string; papers: number }

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

    // School-wide figures are for the people running the school.
    if (!isRoleIn(role, STAFF_TEACHING_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!schoolId) {
      return NextResponse.json({
        totalStudents: 0,
        totalTeachers: 0,
        totalUsers: 0,
        totalClasses: 0,
        totalReports: 0,
        attendanceToday: null,
        academicSummary: { recentAvg: null, passRate: null, passMark: PASS_MARK, markCount: 0 },
        examsAwaitingMarks: 0,
        unmarkedByClass: [],
        classPerformance: [],
        subjectsWithoutGradingSystem: 0,
        hasFeeData: false,
        hasAttendanceData: false,
        upcomingExams: [],
        recentActivities: [],
        hasLogo: false,
        setup: null,
      });
    }

    // The school's calendar day: UTC is still yesterday in Kenya until 3am, which
    // showed an empty "today" register and missed fees that fell due overnight.
    const today = schoolToday();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [studentsRes, usersRes, teachersRes, streamsRes, reportsRes, currentYearRes, overdueFeesRes, announcementsRes, recentEnrollmentsRes, termsRes, schoolRes] = await Promise.all([
      // Learners on the roll: transferred and graduated ones are records, not a headcount.
      supabase.from('students').select('id, users!inner(school_id)', { count: 'exact', head: true }).eq('users.school_id', schoolId).eq('status', 'ACTIVE'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('users').select('id, role').eq('school_id', schoolId).in('role', ['CLASS_TEACHER', 'SUBJECT_TEACHER']),
      supabase.from('grade_streams').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('report_cards').select('id, grade_streams!inner(school_id)', { count: 'exact', head: true }).eq('grade_streams.school_id', schoolId),
      supabase.from('academic_years').select('id, name').eq('school_id', schoolId).order('start_date', { ascending: false }),
      supabase.from('student_fees').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).not('status', 'eq', 'PAID').lt('due_date', today),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).gte('created_at', sevenDaysAgo),
      supabase.from('students').select('id, date_enrolled, users!inner(school_id)', { count: 'exact', head: true }).eq('users.school_id', schoolId).gte('date_enrolled', sevenDaysAgo),
      supabase.from('terms').select('id, name, start_date, end_date, is_current, academic_year_id').eq('school_id', schoolId),
      supabase.from('schools').select('logo_url, pass_mark').eq('id', schoolId).maybeSingle(),
      // Exams published by teachers and awaiting admin approval before report cards can be downloaded.
    ]);

    const activeTermId = findActiveTermId(termsRes?.data || []);
    const currentTerm = (termsRes?.data || []).find(t => t.id === activeTermId) || null;
    // The current term's year: the newest year row can be next year's, set
    // up early, which emptied every figure below until it began.
    const years = (currentYearRes?.data ?? []) as { id: string; name: string }[];
    const currentYear = years.find(y => y.id === currentTerm?.academic_year_id) ?? years[0] ?? null;
    const term = describeTerm(termsRes?.data ?? [], currentTerm, currentYear?.name ?? null, today);
    const totalStudents = studentsRes.count ?? 0;
    const totalUsers = usersRes.count ?? 0;
    const totalTeachers = teachersRes.data?.length ?? 0;
    const totalClasses = streamsRes.count ?? 0;
    const totalReports = reportsRes.count ?? 0;
    const overdueFeesCount = overdueFeesRes.count ?? 0;
    const announcementsLast7Days = announcementsRes.count ?? 0;
    const recentEnrollmentsLast7 = recentEnrollmentsRes.count ?? 0;
    const hasLogo = Boolean(schoolRes.data?.logo_url);
    const passMark = passMarkOrDefault(schoolRes.data?.pass_mark);

    // What a school must have in place before marks and report cards work —
    // the dashboard's setup checklist walks an admin through it in order.
    const [offeredRes, classTeachersRes, assignmentsRes, unplacedRes] = await Promise.all([
      supabase.from('school_subjects').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      currentYear
        ? supabase.from('class_teachers').select('current_grade_stream_id, grade_streams!inner(school_id)').eq('grade_streams.school_id', schoolId).eq('academic_year_id', currentYear.id)
        : Promise.resolve({ data: [] as { current_grade_stream_id: string }[] }),
      currentYear
        ? supabase.from('subject_teacher_assignments').select('id', { count: 'exact', head: true }).eq('academic_year_id', currentYear.id)
        : Promise.resolve({ count: 0 }),
      supabase.from('students').select('id, users!inner(school_id)', { count: 'exact', head: true })
        .eq('users.school_id', schoolId).eq('status', 'ACTIVE').is('current_grade_stream_id', null),
    ]);
    const classesWithTeacher = new Set((classTeachersRes.data ?? []).map(r => r.current_grade_stream_id as string)).size;
    const setup: SetupStatus = {
      hasCurrentTerm: Boolean(currentTerm),
      classes: totalClasses,
      subjectsOffered: offeredRes.count ?? 0,
      classesWithoutClassTeacher: Math.max(0, totalClasses - classesWithTeacher),
      subjectTeacherAssignments: assignmentsRes.count ?? 0,
      learnersWithoutClass: unplacedRes.count ?? 0,
    };

    // ── Rollups the dashboard leads with ──
    //
    // Three things the old cards could not show, all grouped in the database:
    // how each class is actually doing, which classes have exams sat but never
    // marked, and whether the school has ever recorded a fee or an attendance
    // register. The last two decide whether those cards render at all — every
    // school on this instance has zero fee rows and almost no attendance, so
    // the finance and attendance panels were permanently zero.
    const [classPerfRes, unmarkedRes, feeRowRes, attendanceRowRes, ungradedSubjectsRes] = await Promise.all([
      supabase.rpc('school_class_performance', {
        p_school_id: schoolId,
        p_academic_year_id: currentYear?.id ?? null,
        p_pass_mark: passMark,
      }),
      supabase.rpc('school_unmarked_exams', {
        p_school_id: schoolId,
        p_academic_year_id: currentYear?.id ?? null,
      }),
      supabase.from('student_fees').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('daily_attendance').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      // How a school grades a subject is a property of its offering now, so
      // the count comes from there rather than from the shared catalogue row.
      supabase
        .from('school_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .is('grading_system_id', null),
    ]);

    const classPerformance = ((classPerfRes.data ?? []) as ClassPerformanceRow[])
      .map(row => {
        const markCount = Number(row.mark_count ?? 0);
        return {
          id: row.grade_stream_id,
          name: row.full_name,
          levelCode: row.level_code,
          students: Number(row.student_count ?? 0),
          markCount,
          mean: markCount > 0 ? Number(row.mean_percentage ?? 0) : null,
          passRate: markCount > 0 ? Math.round((Number(row.pass_count ?? 0) / markCount) * 100) : null,
        };
      })
      // Weakest first: a class that is struggling is the reason to look.
      .sort((a, b) => (a.passRate ?? 101) - (b.passRate ?? 101));

    const unmarkedByClass = ((unmarkedRes.data ?? []) as UnmarkedExamRow[])
      .map(row => ({
        label: row.label,
        levelCode: row.level_code,
        count: Number(row.unmarked_count ?? 0),
      }))
      .sort((a, b) => b.count - a.count);

    const examsAwaitingMarks = unmarkedByClass.reduce((sum, row) => sum + row.count, 0);
    const hasFeeData = (feeRowRes.count ?? 0) > 0;
    const hasAttendanceData = (attendanceRowRes.count ?? 0) > 0;
    const subjectsWithoutGradingSystem = ungradedSubjectsRes.count ?? 0;

    let upcomingExams: any[] = [];
    let upcomingRounds: UpcomingRound[] = [];
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
        .gte('exam_date', today)
        .lte('exam_date', new Date(Date.parse(today) + 21 * DAY).toISOString().slice(0, 10))
        .order('exam_date', { ascending: true })
        .limit(500);

      if (exams) {
        upcomingExams = exams.map((e: any) => ({
          id: e.id,
          name: e.name,
          exam_type: e.exam_type,
          exam_date: e.exam_date,
          subject_name: e.subjects?.name || 'N/A',
          grade_name: e.grades?.name_display || 'N/A',
        }));
        // One line per class sitting, not one per paper: a round of nine
        // subjects read as nine separate "upcoming exams".
        const rounds = new Map<string, UpcomingRound>();
        for (const e of upcomingExams) {
          const key = `${e.exam_type}|${e.grade_name}`;
          const round = rounds.get(key);
          if (round) round.papers += 1;
          else rounds.set(key, { key, label: getExamType(e.exam_type)?.shortName ?? e.exam_type, className: e.grade_name, firstDate: e.exam_date, papers: 1 });
        }
        upcomingRounds = [...rounds.values()].slice(0, 6);
        upcomingExams = upcomingExams.slice(0, 5);
      }
    }

    // Results entered this term but not yet released to parents and the
    // report cards: the one step only the school can take.
    let unreleasedResults = 0;
    if (currentTerm && role === 'ADMIN') {
      const { data: drafts } = await supabase
        .from('exams')
        .select('id, exam_marks(count)')
        .eq('school_id', schoolId)
        .eq('term_id', currentTerm.id)
        .neq('status', 'APPROVED')
        .limit(1000);
      unreleasedResults = ((drafts ?? []) as { exam_marks: { count: number }[] | null }[])
        .filter(d => (d.exam_marks?.[0]?.count ?? 0) > 0).length;
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
      // Counted in the database: aggregate selects are disabled over PostgREST,
      // so this used to fetch raw percentages capped at 500. A school with
      // 1,574 marks had its pass rate computed from under a third of them, and
      // the same figure on the mobile app disagreed.
      supabase.rpc('school_mark_summary', {
        p_school_id: schoolId,
        p_academic_year_id: currentYear?.id ?? null,
        p_pass_mark: passMark,
      }),
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
        href: '/dashboard/exams-marks',
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
    //
    // The mean of every mark in the year blends subjects, exam types and paper
    // difficulty into one number, so on its own it says more about how hard the
    // papers were than about the school. Pass rate — the share of marks at or
    // above the pass mark — is what an admin can actually act on, and it is what
    // the mobile staff dashboard already leads with. Both are returned; the UI
    // leads with the rate and keeps the mean as context.
    const summary = ((academicMarksRes.data ?? []) as MarkSummaryRow[])[0];
    const markCount = Number(summary?.mark_count ?? 0);
    const recentAvg = markCount > 0 ? Number(summary?.mean_percentage ?? 0) : null;
    const passRate = markCount > 0
      ? Math.round((Number(summary?.pass_count ?? 0) / markCount) * 100)
      : null;

    // Fee figures are the admin's; teachers get the rest of the summary.
    const seesFees = role === 'ADMIN';
    return NextResponse.json({
      totalStudents,
      totalTeachers,
      totalUsers,
      totalClasses,
      totalReports,
      attendanceToday: { present: presentCount, absent: absentCount, late: lateCount, excused: excusedCount },
      upcomingExams,
      recentActivities,
      overdueFeesCount: seesFees ? overdueFeesCount : 0,
      announcementsLast7Days,
      recentEnrollmentsLast7,
      financeSummary: seesFees
        ? { totalCollected: Math.round(totalCollected * 100) / 100, unpaidBalance: Math.round(unpaidBalance * 100) / 100, overdueCount: overdueFeesCount }
        : { totalCollected: 0, unpaidBalance: 0, overdueCount: 0 },
      academicSummary: { recentAvg, passRate, passMark, markCount },
      examsAwaitingMarks,
      unmarkedByClass,
      classPerformance,
      subjectsWithoutGradingSystem,
      hasFeeData: seesFees && hasFeeData,
      term,
      upcomingRounds,
      unreleasedResults,
      hasAttendanceData,
      hasLogo,
      setup,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
