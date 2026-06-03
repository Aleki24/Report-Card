import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', userId)
      .maybeSingle();

    const schoolId = userProfile?.school_id;
    if (!schoolId) return NextResponse.json({ data: null });

    // Step 1: Look up the student record, verified against school
    const { data: studentRecord } = await supabase
      .from('students')
      .select('id, current_grade_stream_id, users!inner(school_id)')
      .eq('id', userId)
      .eq('users.school_id', schoolId)
      .maybeSingle();

    if (!studentRecord) {
      return NextResponse.json({ data: null });
    }

    const gradeStreamId = studentRecord.current_grade_stream_id;

    // Step 2: Fetch all marks for this student (school-scoped via exam ownership)
    const { data: marksData, error: marksError } = await supabase
      .from('exam_marks')
      .select(`
        id,
        percentage,
        grade_symbol,
        raw_score,
        remarks,
        student_id,
        exams!inner (
          id,
          name,
          max_score,
          term_id,
          academic_year_id,
          school_id,
          terms ( id, name ),
          academic_years ( id, name ),
          subjects ( name )
        )
      `)
      .eq('student_id', studentRecord.id)
      .eq('exams.school_id', schoolId);

    if (marksError) {
      return NextResponse.json({ error: marksError.message }, { status: 400 });
    }

    if (!marksData || marksData.length === 0) {
      return NextResponse.json({ data: { termResults: [], stats: null, trendData: [] } });
    }

    // Step 3: Group marks by term
    const groups: Record<string, {
      term: string;
      termId: string | null;
      yearId: string | null;
      yearName: string;
      subjects: { name: string; score: number; maxScore: number; grade: string; comment: string }[];
      average: number;
      position: number;
      totalStudents: number;
      examIds: string[];
    }> = {};

    let totalPct = 0;
    let count = 0;
    let bestSub = '';
    let bestScore = -1;
    let worstSub = '';
    let worstScore = 101;

    marksData.forEach((mark: any) => {
      const ex = mark.exams;
      if (!ex) return;

      const termName = ex.terms?.name || 'Unknown Term';
      const yearName = ex.academic_years?.name || '';
      const termKey = `${termName} ${yearName}`.trim();
      const termId = ex.term_id || ex.terms?.id || null;
      const yearId = ex.academic_year_id || ex.academic_years?.id || null;

      if (!groups[termKey]) {
        groups[termKey] = {
          term: termKey,
          termId,
          yearId,
          yearName,
          subjects: [],
          average: 0,
          position: 0,
          totalStudents: 0,
          examIds: [],
        };
      }

      if (ex.id && !groups[termKey].examIds.includes(ex.id)) {
        groups[termKey].examIds.push(ex.id);
      }

      const subjName = ex.subjects?.name || 'Unknown Subject';
      groups[termKey].subjects.push({
        name: subjName,
        score: mark.raw_score,
        maxScore: ex.max_score,
        grade: mark.grade_symbol,
        comment: mark.remarks || 'No remarks',
      });

      totalPct += mark.percentage;
      count++;

      if (mark.percentage > bestScore) {
        bestScore = mark.percentage;
        bestSub = subjName;
      }
      if (mark.percentage < worstScore) {
        worstScore = mark.percentage;
        worstSub = subjName;
      }
    });

    // Step 4: Calculate averages per term
    const resultsArray = Object.values(groups).map((g) => {
      const sum = g.subjects.reduce(
        (s, subj) => s + (subj.maxScore > 0 ? (subj.score / subj.maxScore) * 100 : 0),
        0
      );
      g.average = g.subjects.length > 0 ? Math.round(sum / g.subjects.length) : 0;
      return {
        term: g.term,
        termId: g.termId,
        yearId: g.yearId,
        yearName: g.yearName,
        subjects: g.subjects,
        average: g.average,
        position: 0,
        totalStudents: 0,
      };
    });

    // Step 5: Calculate stream position for each term (school-scoped)
    if (gradeStreamId) {
      // Get all classmates in same school
      const { data: classmates } = await supabase
        .from('students')
        .select('id, users!inner(school_id)')
        .eq('current_grade_stream_id', gradeStreamId)
        .eq('users.school_id', schoolId);

      if (classmates && classmates.length > 0) {
        const classmateIds = classmates.map((c: any) => c.id);

        for (const term of resultsArray) {
          if (!term.termId) continue;

          // Get all marks for classmates for this term (school-scoped via exam.school_id)
          const { data: allMarks } = await supabase
            .from('exam_marks')
            .select('student_id, raw_score, percentage, exams!inner(max_score, term_id, academic_year_id, school_id)')
            .in('student_id', classmateIds)
            .eq('exams.term_id', term.termId)
            .eq('exams.school_id', schoolId);

          if (allMarks && allMarks.length > 0) {
            // Aggregate per student
            const studentAggs: Record<string, { totalScore: number; totalPossible: number }> = {};
            for (const m of allMarks as any[]) {
              const sid = m.student_id;
              if (!studentAggs[sid]) studentAggs[sid] = { totalScore: 0, totalPossible: 0 };
              studentAggs[sid].totalScore += Number(m.raw_score);
              studentAggs[sid].totalPossible += Number(m.exams.max_score);
            }

            // Sort by percentage descending
            const sorted = Object.entries(studentAggs)
              .filter(([, v]) => v.totalPossible > 0)
              .map(([sid, v]) => ({
                sid,
                pct: (v.totalScore / v.totalPossible) * 100,
              }))
              .sort((a, b) => b.pct - a.pct);

            term.totalStudents = sorted.length;

            // Find this student's rank (handle ties)
            let rank = 1;
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i].pct < sorted[i - 1].pct) {
                rank = i + 1;
              }
              if (sorted[i].sid === studentRecord.id) {
                term.position = rank;
                break;
              }
            }
          }
        }
      }
    }

    // Step 6: Build trend data
    const trendData = resultsArray.map(t => ({
      examName: t.term,
      percentage: t.average,
    }));

    // Step 7: Summary stats
    const latestTerm = resultsArray.length > 0 ? resultsArray[resultsArray.length - 1] : null;
    const stats = count > 0 ? {
      termAverage: Math.round(totalPct / count),
      bestSubject: bestSub,
      bestScore: Math.round(bestScore),
      weakestSubject: worstSub,
      weakestScore: Math.round(worstScore),
      streamPosition: latestTerm?.position || 0,
      totalInStream: latestTerm?.totalStudents || 0,
    } : null;

    return NextResponse.json({
      data: {
        studentId: studentRecord.id,
        termResults: resultsArray,
        stats,
        trendData,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
