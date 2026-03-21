// src/app/api/school/stats/route.ts
// Powers the dashboard KPI cards — all queries are school-scoped
// using the NextAuth session, never the browser Supabase client.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const schoolId = session.user.schoolId as string | null;
    const role = session.user.role as string;

    const { searchParams } = new URL(request.url);
    const queryRole = searchParams.get('role') || role.toLowerCase();

    const supabase = createSupabaseAdmin();

    // ── ADMIN stats ──────────────────────────────────────────
    if (queryRole === 'admin' || role === 'ADMIN') {
      if (!schoolId) {
        return NextResponse.json({ marks: [], totalReports: 0 });
      }

      // Get all student IDs for this school
      const { data: schoolUsers } = await supabase
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'STUDENT');

      const studentIds = (schoolUsers || []).map(u => u.id);

      let marks: { percentage: number }[] = [];
      let totalReports = 0;

      if (studentIds.length > 0) {
        const [marksRes, reportsRes] = await Promise.all([
          supabase.from('exam_marks').select('percentage').in('student_id', studentIds),
          supabase.from('report_cards').select('id', { count: 'exact', head: true }).in('student_id', studentIds),
        ]);
        marks = (marksRes.data || []) as { percentage: number }[];
        totalReports = reportsRes.count ?? 0;
      }

      return NextResponse.json({ marks, totalReports });
    }

    // ── CLASS TEACHER stats ──────────────────────────────────
    if (queryRole === 'class_teacher') {
      const { data: ctData } = await supabase
        .from('class_teachers')
        .select('current_grade_stream_id, grade_streams(full_name)')
        .eq('user_id', userId)
        .limit(1)
        .single();

      const streamId = ctData?.current_grade_stream_id;
      const streamName = (ctData?.grade_streams as any)?.full_name || '—';

      let studentCount = 0;
      if (streamId) {
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('current_grade_stream_id', streamId);
        studentCount = count ?? 0;
      }

      return NextResponse.json({ streamName, studentCount });
    }

    // ── SUBJECT TEACHER stats ────────────────────────────────
    if (queryRole === 'subject_teacher') {
      const { count: examCount } = await supabase
        .from('exams')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_teacher_id', userId);

      const { data: teacherExams } = await supabase
        .from('exams')
        .select('id')
        .eq('created_by_teacher_id', userId);

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
      // Find this student's record
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, current_grade_stream_id')
        .eq('id', userId)
        .single();

      if (!studentRecord) {
        return NextResponse.json({ avg: 0, markCount: 0, bestSubject: '—', bestScore: 0, position: '—', positionSub: 'N/A' });
      }

      const { data: marks } = await supabase
        .from('exam_marks')
        .select('percentage, raw_score, exams(subject_id, max_score, subjects(name))')
        .eq('student_id', studentRecord.id);

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
      if (gradeStreamId) {
        const { data: classmates } = await supabase
          .from('students')
          .select('id')
          .eq('current_grade_stream_id', gradeStreamId);

        if (classmates && classmates.length > 0) {
          const classmateIds = classmates.map(c => c.id);
          const { data: allMarks } = await supabase
            .from('exam_marks')
            .select('student_id, raw_score, exams!inner(max_score)')
            .in('student_id', classmateIds);

          if (allMarks && allMarks.length > 0) {
            const aggs: Record<string, { score: number; possible: number }> = {};
            for (const m of allMarks as any[]) {
              const sid = m.student_id;
              if (!aggs[sid]) aggs[sid] = { score: 0, possible: 0 };
              aggs[sid].score += Number(m.raw_score);
              aggs[sid].possible += Number(m.exams.max_score);
            }
            const sorted = Object.entries(aggs)
              .filter(([, v]) => v.possible > 0)
              .map(([sid, v]) => ({ sid, pct: (v.score / v.possible) * 100 }))
              .sort((a, b) => b.pct - a.pct);

            let rank = 1;
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i].pct < sorted[i - 1].pct) rank = i + 1;
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
