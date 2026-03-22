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
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');
    if (!examId) {
      return NextResponse.json({ error: 'exam_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Get student IDs for this school only
    const { data: schoolUsers } = await supabase
      .from('users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'STUDENT');

    const studentIds = (schoolUsers || []).map(u => u.id);
    if (studentIds.length === 0) return NextResponse.json({ data: [] });

    const { data, error } = await supabase
      .from('exam_marks')
      .select(`
        id, student_id, raw_score, percentage, grade_symbol, remarks,
        students!inner (
          admission_number,
          users ( first_name, last_name )
        )
      `)
      .eq('exam_id', examId)
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { exam_id, marks } = body;
    
    if (!exam_id || !Array.isArray(marks)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Get student IDs for this school only to validate
    const { data: schoolUsers } = await supabase
      .from('users')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', 'STUDENT');
      
    const validStudentIds = new Set((schoolUsers || []).map(u => u.id));
    for (const m of marks) {
      if (!validStudentIds.has(m.student_id)) {
         return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
      }
    }

    // Upsert marks using admin client
    const { data, error } = await supabase
      .from('exam_marks')
      .upsert(
        marks.map((m: any) => ({
          student_id: m.student_id,
          exam_id,
          raw_score: m.raw_score,
          percentage: m.percentage,
          grade_symbol: m.grade_symbol,
          remarks: m.remarks
        })),
        { onConflict: 'student_id,exam_id' }
      )
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { id, raw_score, percentage, grade_symbol, remarks } = body;

    if (!id) return NextResponse.json({ error: 'Mark ID required' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    
    // Verify mark ownership
    const { data: markCheck } = await supabase
      .from('exam_marks')
      .select('id, students!inner ( users!inner ( school_id ) )')
      .eq('id', id)
      .single();

    if (!markCheck || (markCheck as any).students?.users?.school_id !== schoolId) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data, error } = await supabase
      .from('exam_marks')
      .update({ raw_score, percentage, grade_symbol, remarks })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Mark ID required' }, { status: 400 });

    const supabase = createSupabaseAdmin();

    // Verify mark ownership
    const { data: markCheck } = await supabase
      .from('exam_marks')
      .select('id, students!inner ( users!inner ( school_id ) )')
      .eq('id', id)
      .single();

    if (!markCheck || (markCheck as any).students?.users?.school_id !== schoolId) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { error } = await supabase.from('exam_marks').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
