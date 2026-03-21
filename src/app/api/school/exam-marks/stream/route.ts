import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    
    if (!streamId) return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });

    const supabase = createSupabaseAdmin();

    const { data: marks, error } = await supabase
        .from('exam_marks')
        .select(`
            id, raw_score, percentage, grade_symbol, student_id, exam_id, remarks,
            exams!inner ( id, name, subject_id, term_id, academic_year_id, subjects(name) ),
            students!inner ( current_grade_stream_id, admission_number, users(first_name, last_name) )
        `)
        .eq('students.current_grade_stream_id', streamId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: marks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
