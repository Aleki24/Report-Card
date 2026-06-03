import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
        .from('users')
        .select('school_id, role')
        .eq('id', userId)
        .maybeSingle();

    const schoolId = userProfile?.school_id;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    
    if (!streamId) return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });

    const { data: marks, error } = await supabase
        .from('exam_marks')
        .select(`
            id, raw_score, percentage, grade_symbol, student_id, exam_id, remarks,
            exams!inner ( id, name, subject_id, term_id, academic_year_id, subjects(name) ),
            students!inner ( current_grade_stream_id, admission_number, users!inner(first_name, last_name, school_id) )
        `)
        .eq('students.current_grade_stream_id', streamId)
        .eq('students.users.school_id', schoolId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: marks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
