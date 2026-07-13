import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { aggregateStudentPerformance, type ExamMarkWithDetails } from '@/lib/analytics';

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

    // Determine grading system from the grade code: Form 3-4 / Grade 7-8 & 11-12
    // use KCSE (8-4-4) points; everything else is CBC percentage-based.
    let isKCSE = false;
    if (gradeStreamId) {
      const { data: streamData } = await supabase
        .from('grade_streams')
        .select('grades ( code )')
        .eq('id', gradeStreamId)
        .maybeSingle();
      const gradeCode = (streamData?.grades as any)?.code || '';
      isKCSE = /^(G[78]|G1[12]|F[34])/i.test(gradeCode);
    }

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
            .select('student_id, raw_score, percentage, grade_symbol, exams!inner(id, max_score, term_id, academic_year_id, school_id, subjects(id, name, category))')
            .in('student_id', classmateIds)
            .eq('exams.term_id', term.termId)
            .eq('exams.school_id', schoolId);

          if (allMarks && allMarks.length > 0) {
            // Group marks per classmate; build name/category maps for 8-4-4 selection
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

            // KCSE (8-4-4) ranks by total points (best-7 selection); CBC by percentage.
            const gradingSystemType = isKCSE ? 'KCSE' : 'CBC';
            const sorted = Object.entries(marksByClassmate)
              .map(([sid, marks]) => {
                const perf = aggregateStudentPerformance(marks, [], gradingSystemType, rankSubjectNames, rankSubjectCategories);
                return { sid, metric: isKCSE ? perf.totalPoints : perf.percentage };
              })
              .sort((a, b) => b.metric - a.metric);

            term.totalStudents = sorted.length;

            // Find this student's rank (handle ties)
            let rank = 1;
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i].metric < sorted[i - 1].metric) {
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
