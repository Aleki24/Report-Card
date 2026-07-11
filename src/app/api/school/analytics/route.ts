import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .maybeSingle();

    const schoolId = userProfile?.school_id as string | null;
    const role = userProfile?.role;

    if (!schoolId || !role) {
      return NextResponse.json({ marks: [] });
    }

    // School-wide analytics is admin-only. Teachers see marks scoped to their
    // assignments through the exam-marks / student-results routes instead; this
    // endpoint returns every mark in the school, so restrict it to admins.
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    const examId = searchParams.get('exam_id');
    const subjectId = searchParams.get('subject_id');
    const yearId = searchParams.get('year_id');
    const termId = searchParams.get('term_id');

    let query = supabaseAdmin
      .from('exam_marks')
      .select(`
        id,
        raw_score,
        grade_symbol,
        student_id,
        exam_id,
        subject_id,
        exams!inner(
          id,
          name,
          max_score,
          exam_date,
          academic_year_id,
          term_id,
          grade_id,
          grade_stream_id,
          subject_id,
          grades!inner(id, name, academic_level_id),
          academic_years!inner(id, name, school_id),
          terms(id, name)
        )
      `)
      .eq('exams.academic_years.school_id', schoolId);

    if (streamId) query = query.eq('exams.grade_stream_id', streamId);
    if (examId) query = query.eq('exam_id', examId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (yearId) query = query.eq('exams.academic_year_id', yearId);
    if (termId) query = query.eq('exams.term_id', termId);

    const { data: marks, error } = await query;

    if (error) {
      console.error('Analytics query error:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    return NextResponse.json({ marks: marks || [] });
  } catch (err) {
    console.error('Analytics route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
