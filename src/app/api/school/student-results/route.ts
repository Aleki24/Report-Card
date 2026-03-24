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

    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');
    const classId = searchParams.get('class_id'); // grade stream id

    if (!examId || !classId) {
      return NextResponse.json({ error: 'exam_id and class_id are required' }, { status: 400 });
    }

    const authRole = session.user.role;
    const userId = session.user.id;
    const supabase = createSupabaseAdmin();

    if (authRole !== 'ADMIN') {
      const { getTeacherPermissions, isStreamVisibleToTeacher, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
      const perms = await getTeacherPermissions(userId);

      // Verify exam access
      const { data: examData } = await supabase.from('exams').select('*').eq('id', examId).single();
      if (!examData || !isExamVisibleToTeacher(examData, perms)) {
        return NextResponse.json({ error: 'Unauthorized to view this exam' }, { status: 403 });
      }

      // Verify stream access
      const { data: streamData } = await supabase.from('grade_streams').select('*').eq('id', classId).single();
      if (!streamData || !isStreamVisibleToTeacher(streamData, perms)) {
        return NextResponse.json({ error: 'Unauthorized to view this stream' }, { status: 403 });
      }
    }

    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('current_grade_stream_id', classId);

    if (studentError) {
      return NextResponse.json({ error: studentError.message }, { status: 400 });
    }

    const studentIds = students?.map(s => s.id) || [];
    if (studentIds.length === 0) return NextResponse.json({ data: [] });

    const { data, error } = await supabase
      .from('exam_marks')
      .select(`
        id, student_id, raw_score, percentage, grade_symbol, remarks,
        students!inner (
          admission_number,
          users!inner ( first_name, last_name, school_id )
        )
      `)
      .eq('exam_id', examId)
      .eq('students.users.school_id', schoolId)
      .in('student_id', studentIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const mapped = (data || []).map((m: any) => ({
      id: m.id,
      student_id: m.student_id,
      student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(),
      admission_number: m.students?.admission_number || '',
      raw_score: m.raw_score,
      percentage: m.percentage,
      grade_symbol: m.grade_symbol,
      remarks: m.remarks,
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
