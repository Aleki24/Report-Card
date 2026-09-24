import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import type { UserRole } from '@/types';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { aggregateStudentPerformance, isKCSEGradeLevel, rankingBasisFor, type ExamMarkWithDetails } from '@/lib/analytics';
import { PASS_MARK } from '@/lib/pass-mark';

/** One row of the `school_mark_summary` function; numerics arrive as strings. */
interface MarkSummaryRow {
  mark_count: number | string;
  mean_percentage: number | string | null;
  pass_count: number | string;
}

/** Stats views each role may request; the first is its default. */
const STATS_VIEWS_BY_ROLE: Partial<Record<UserRole, readonly string[]>> = {
  ADMIN: ['admin'],
  CLASS_TEACHER: ['class_teacher', 'subject_teacher'],
  SUBJECT_TEACHER: ['subject_teacher'],
  STUDENT: ['student'],
};

export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { userId, schoolId, role } = caller;

    // ?role= picks a view, but only among the views this caller is entitled
    // to. It used to be honoured as given, so any account — a student
    // included — could ask for ?role=admin and read the school's admin stats.
    const { searchParams } = new URL(request.url);
    const requestedView = searchParams.get('role');
    const entitledViews = STATS_VIEWS_BY_ROLE[role] ?? [];
    const queryRole = requestedView && entitledViews.includes(requestedView) ? requestedView : entitledViews[0];
    if (!queryRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── ADMIN stats ──────────────────────────────────────────
    if (queryRole === 'admin') {
      if (!schoolId) {
        return NextResponse.json({ marks: [], totalReports: 0, totalStudents: 0, activeStudents: 0, totalTeachers: 0, classTeachers: 0, subjectTeachers: 0, totalClasses: 0, upcomingExams: [], recentActivities: [] });
      }

      // Get current academic year
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── Students ──
      // Counted in the database. Loading the ids and taking .length capped
      // at PostgREST's 1,000-row limit, and passing them all back in an
      // .in() filter overflowed the request URL well before that.
      const { count: totalStudentCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'STUDENT');
      const totalStudents = totalStudentCount ?? 0;

      const { count: activeStudents } = await supabase
        .from('students')
        .select('id, users!inner(school_id)', { count: 'exact', head: true })
        .eq('users.school_id', schoolId)
        .eq('status', 'ACTIVE');

      // ── Teachers ──
      const { count: classTeachers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'CLASS_TEACHER');

      const { count: subjectTeachers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'SUBJECT_TEACHER');

      const totalTeachers = (classTeachers ?? 0) + (subjectTeachers ?? 0);

      // ── Classes ──
      const { count: totalClasses } = await supabase
        .from('grade_streams')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId);

      // ── Exam marks + Reports ──
      // Kept in the response for compatibility with older clients that read it;
      // no caller uses it, and the figures below no longer come from it.
      const marks: { percentage: number }[] = [];
      let totalReports = 0;
      let schoolAverage: number | null = null;
      let passRate: number | null = null;

      if (totalStudents > 0) {
        // The mean and pass rate are computed in the database rather than over
        // rows fetched here. The previous version filtered on
        // `exams.academic_year_id` without embedding `exams` in the select,
        // which PostgREST rejects outright:
        //
        //   PGRST108: 'exams' is not an embedded resource in this request
        //
        // The error was swallowed by `marksRes.data || []`, so `marks` was
        // always empty and both figures were always null — the mobile staff
        // dashboard has been showing "—" for School average and Pass rate on
        // every load. Scoping through exams.school_id also matches how the
        // rest of the app reaches marks; exam_marks has no school column.
        const [summaryRes, reportsRes] = await Promise.all([
          supabase.rpc('school_mark_summary', {
            p_school_id: schoolId,
            p_academic_year_id: currentYear?.id ?? null,
            p_pass_mark: PASS_MARK,
          }),
          currentYear
            ? supabase
                .from('report_cards')
                .select('id, students!inner(school_id)', { count: 'exact', head: true })
                .eq('students.school_id', schoolId)
                .eq('academic_year_id', currentYear.id)
            : supabase
                .from('report_cards')
                .select('id, students!inner(school_id)', { count: 'exact', head: true })
                .eq('students.school_id', schoolId),
        ]);

        totalReports = reportsRes.count ?? 0;

        const summary = (summaryRes.data ?? [])[0] as MarkSummaryRow | undefined;
        const markCount = Number(summary?.mark_count ?? 0);
        if (markCount > 0) {
          schoolAverage = Number(summary?.mean_percentage ?? 0);
          passRate = Math.round((Number(summary?.pass_count ?? 0) / markCount) * 100);
        }
      }

      // ── Upcoming exams (next 30 days) ──
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: upcomingExams } = await supabase
        .from('exams')
        .select(`
          id, name, exam_date, max_score,
          subjects!inner (name),
          grades!inner (name_display)
        `)
        .eq('school_id', schoolId)
        .gte('exam_date', today)
        .lte('exam_date', thirtyDaysLater)
        .order('exam_date', { ascending: true })
        .limit(5);

      // ── Recent activities ──
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [recentUsersRes, recentExamsRes, recentMarksRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, first_name, last_name, role, created_at')
          .eq('school_id', schoolId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('exams')
          .select('id, name, created_at')
          .eq('school_id', schoolId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('exam_marks')
          .select('created_at, exams!inner(id, school_id)')
          .eq('exams.school_id', schoolId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // If exam_marks has no created_at, use updated_at or skip
      let recentActivities: { type: string; description: string; timestamp: string }[] = [];

      if (recentUsersRes.data) {
        for (const u of recentUsersRes.data) {
          recentActivities.push({
            type: 'user',
            description: `${u.first_name} ${u.last_name} joined as ${u.role.replace('_', ' ')}`,
            timestamp: u.created_at,
          });
        }
      }

      if (recentExamsRes.data) {
        for (const e of recentExamsRes.data) {
          recentActivities.push({
            type: 'exam',
            description: `Exam created: ${e.name}`,
            timestamp: e.created_at,
          });
        }
      }

      if (recentMarksRes.data) {
        for (const m of recentMarksRes.data as any[]) {
          if (m.created_at) {
            recentActivities.push({
              type: 'marks',
              description: 'Marks recorded',
              timestamp: m.created_at,
            });
          }
        }
      }

      recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      recentActivities = recentActivities.slice(0, 10);

      return NextResponse.json({
        marks,
        totalReports,
        totalStudents,
        activeStudents: activeStudents ?? 0,
        totalTeachers,
        classTeachers: classTeachers ?? 0,
        subjectTeachers: subjectTeachers ?? 0,
        totalClasses: totalClasses ?? 0,
        schoolAverage,
        passRate,
        upcomingExams: upcomingExams ?? [],
        recentActivities,
      });
    }

    // ── CLASS TEACHER stats ──────────────────────────────────
    if (queryRole === 'class_teacher') {
      // Get current academic year
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      // Get class teacher assignment for current academic year
      let ctQuery = supabase
        .from('class_teachers')
        .select('current_grade_stream_id, grade_streams(full_name)')
        .eq('user_id', userId);

      if (currentYear) {
        ctQuery = ctQuery.eq('academic_year_id', currentYear.id);
      }

      const { data: ctData } = await ctQuery.limit(1).maybeSingle();

      const streamId = ctData?.current_grade_stream_id;
      const streamName = (ctData?.grade_streams as any)?.full_name || '—';

      let studentCount = 0;
      let streamAvg = '—';
      let reportsPending = 0;

      if (streamId) {
        // Get student count
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('current_grade_stream_id', streamId);
        studentCount = count ?? 0;

        // Get stream students
        const { data: streamStudents } = await supabase
          .from('students')
          .select('id')
          .eq('current_grade_stream_id', streamId);

        const studentIds = (streamStudents || []).map(s => s.id);

        if (studentIds.length > 0 && currentYear) {
          // Calculate stream average from exam marks
          const { data: marks } = await supabase
            .from('exam_marks')
            .select('percentage')
            .in('student_id', studentIds);

          if (marks && marks.length > 0) {
            const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
            streamAvg = (sum / marks.length).toFixed(1);
          }

          // Get terms for current year to count how many report cards needed
          const { data: terms } = await supabase
            .from('terms')
            .select('id')
            .eq('academic_year_id', currentYear.id);

          const termCount = terms?.length || 1;
          const requiredReports = studentIds.length * termCount;

          // Count existing report cards for this stream in current year
          const { count: existingReports } = await supabase
            .from('report_cards')
            .select('id', { count: 'exact', head: true })
            .eq('grade_stream_id', streamId)
            .eq('academic_year_id', currentYear.id);

          reportsPending = Math.max(0, requiredReports - (existingReports ?? 0));
        }
      }

      return NextResponse.json({ streamName, studentCount, streamAvg, reportsPending });
    }

    // ── SUBJECT TEACHER stats ────────────────────────────────
    if (queryRole === 'subject_teacher') {
      // Get current academic year
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let examQuery = supabase
        .from('exams')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_teacher_id', userId);

      if (currentYear) {
        examQuery = examQuery.eq('academic_year_id', currentYear.id);
      }
      const { count: examCount } = await examQuery;

      let examsQuery = supabase
        .from('exams')
        .select('id')
        .eq('created_by_teacher_id', userId);

      if (currentYear) {
        examsQuery = examsQuery.eq('academic_year_id', currentYear.id);
      }

      const { data: teacherExams } = await examsQuery;

      let avg = '—';
      let markCount = 0;

      if (teacherExams && teacherExams.length > 0) {
        const examIds = teacherExams.map(e => e.id);
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('percentage')
          .in('exam_id', examIds);

        if (marks && marks.length > 0) {
          markCount = marks.length;
          const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
          avg = `${(sum / marks.length).toFixed(1)}`;
        }
      }

      return NextResponse.json({ examCount: examCount ?? 0, avg, markCount });
    }

    // ── STUDENT stats ────────────────────────────────────────
    if (queryRole === 'student') {
      // Get current academic year
      const { data: currentYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Find this student's record
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, current_grade_stream_id')
        .eq('id', userId)
        .maybeSingle();

      if (!studentRecord) {
        return NextResponse.json({ avg: 0, markCount: 0, bestSubject: '—', bestScore: 0, position: '—', positionSub: 'N/A' });
      }

      // Get marks filtered by academic year via exam relationship
      let query = supabase
        .from('exam_marks')
        .select('percentage, raw_score, exams(subject_id, max_score, subjects(name), academic_year_id)')
        .eq('student_id', studentRecord.id);

      if (currentYear) {
        query = query.eq('exams.academic_year_id', currentYear.id);
      }

      const { data: marks } = await query;

      if (!marks || marks.length === 0) {
        return NextResponse.json({ avg: 0, markCount: 0, bestSubject: '—', bestScore: 0, position: '—', positionSub: 'N/A' });
      }

      const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
      const avg = Number((sum / marks.length).toFixed(1));

      // Best subject
      const subjectAvgs: Record<string, { total: number; count: number; name: string }> = {};
      for (const m of marks) {
        const exam = m.exams as any;
        const subName = exam?.subjects?.name || 'Unknown';
        const subId = exam?.subject_id || 'unknown';
        if (!subjectAvgs[subId]) subjectAvgs[subId] = { total: 0, count: 0, name: subName };
        subjectAvgs[subId].total += Number(m.percentage);
        subjectAvgs[subId].count++;
      }
      let bestSubject = '—';
      let bestScore = 0;
      for (const val of Object.values(subjectAvgs)) {
        const subjAvg = val.total / val.count;
        if (subjAvg > bestScore) { bestScore = subjAvg; bestSubject = val.name; }
      }

      // Stream position
      let position = '—';
      let positionSub = 'N/A';
      const gradeStreamId = studentRecord.current_grade_stream_id;
      if (gradeStreamId && currentYear) {
        // Grade code decides the grading style; the academic level decides
        // the ranking — CBC learners by marks, 8-4-4 by total points.
        const { data: streamData } = await supabase
          .from('grade_streams')
          .select('full_name, grades ( code, academic_levels ( code ) )')
          .eq('id', gradeStreamId)
          .maybeSingle();
        const gradeCode = (streamData?.grades as any)?.code || '';
        const isKCSE = isKCSEGradeLevel(gradeCode, (streamData as any)?.full_name);

        const { data: classmates } = await supabase
          .from('students')
          .select('id')
          .eq('current_grade_stream_id', gradeStreamId);

        if (classmates && classmates.length > 0) {
          const classmateIds = classmates.map(c => c.id);
          let marksQuery = supabase
            .from('exam_marks')
            .select('student_id, raw_score, grade_symbol, exams!inner(id, max_score, subjects(id, name, category))')
            .in('student_id', classmateIds)
            .eq('exams.academic_year_id', currentYear.id);

          const { data: allMarks } = await marksQuery;

          if (allMarks && allMarks.length > 0) {
            const marksByClassmate: Record<string, ExamMarkWithDetails[]> = {};
            const rankSubjectNames: Record<string, string> = {};
            const rankSubjectCategories: Record<string, string> = {};
            for (const m of allMarks as any[]) {
              const sid = m.student_id;
              const subj = m.exams.subjects;
              const subjectId = subj?.id || '';
              if (!marksByClassmate[sid]) marksByClassmate[sid] = [];
              marksByClassmate[sid].push({
                id: '', student_id: sid, exam_id: m.exams.id || '',
                subject_id: subjectId, raw_score: Number(m.raw_score), percentage: 0,
                max_score: Number(m.exams.max_score), grade_symbol: m.grade_symbol,
              });
              if (subjectId && subj?.name) rankSubjectNames[subjectId] = subj.name;
              if (subjectId && subj?.category) rankSubjectCategories[subjectId] = subj.category;
            }

            // 8-4-4 ranks by total points (best-7 selection); CBC by marks.
            const gradingSystemType = isKCSE ? 'KCSE' : 'CBC';
            // PostgREST returns a to-one embed as an object, or an array on older relations.
            const level = (streamData?.grades as { academic_levels?: { code?: string } | { code?: string }[] } | null)?.academic_levels;
            const levelCode = (Array.isArray(level) ? level[0] : level)?.code;
            const byMarks = rankingBasisFor(gradingSystemType, levelCode) === 'percentage';
            const sorted = Object.entries(marksByClassmate)
              .map(([sid, marks]) => {
                const perf = aggregateStudentPerformance(marks, [], gradingSystemType, rankSubjectNames, rankSubjectCategories);
                return { sid, metric: byMarks ? perf.percentage : perf.totalPoints };
              })
              .sort((a, b) => b.metric - a.metric);

            let rank = 1;
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i].metric < sorted[i - 1].metric) rank = i + 1;
              if (sorted[i].sid === studentRecord.id) {
                position = `${rank} / ${sorted.length}`;
                positionSub = rank <= 3 ? '🏆 Top performer!' : `Out of ${sorted.length} students`;
                break;
              }
            }
          }
        }
      }

      return NextResponse.json({ avg, markCount: marks.length, bestSubject, bestScore: Number(bestScore.toFixed(1)), position, positionSub });
    }

    return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
