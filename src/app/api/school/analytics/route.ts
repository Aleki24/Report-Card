// src/app/api/school/analytics/route.ts
// Powers the analytics page — all queries school-scoped via NextAuth session.

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

    const schoolId = session.user.schoolId as string | null;
    if (!schoolId) {
      return NextResponse.json({ marks: [] });
    }

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');

    const supabase = createSupabaseAdmin();

    // Get all student IDs belonging to this school
    const { data: schoolUsers } = await supabase
      .from('users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'STUDENT');

    let studentIds = (schoolUsers || []).map(u => u.id);

    if (studentIds.length === 0) {
      return NextResponse.json({ marks: [] });
    }

    // If a stream filter is applied, narrow down to students in that stream
    if (streamId) {
      const { data: streamStudents } = await supabase
        .from('students')
        .select('id')
        .eq('current_grade_stream_id', streamId)
        .in('id', studentIds);

      studentIds = (streamStudents || []).map(s => s.id);

      if (studentIds.length === 0) {
        return NextResponse.json({ marks: [] });
      }
    }

    // Fetch exam marks with all needed details for analytics
    const { data: marks, error } = await supabase
      .from('exam_marks')
      .select(`
        id,
        student_id,
        percentage,
        grade_symbol,
        exams (
          id,
          name,
          exam_date,
          subjects ( name )
        ),
        students (
          admission_number,
          users ( first_name, last_name )
        )
      `)
      .in('student_id', studentIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Flatten for easy consumption by the frontend
    const flattened = (marks || []).map((m: any) => ({
      id: m.id,
      student_id: m.student_id,
      percentage: m.percentage,
      grade_symbol: m.grade_symbol,
      exam_name: m.exams?.name || 'Unknown Exam',
      exam_date: m.exams?.exam_date || null,
      subject_name: m.exams?.subjects?.name || 'Unknown Subject',
      student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim() || 'Unknown',
      admission_number: m.students?.admission_number || '',
    }));

    return NextResponse.json({ marks: flattened });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
