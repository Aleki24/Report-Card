import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createSupabaseAdmin();
  const { data: userProfile } = await supabase
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .single();

  if (!userProfile) return null;

  return {
    userId,
    schoolId: userProfile.school_id as string | null,
    role: userProfile.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { schoolId } = auth;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const streamId = searchParams.get('stream_id');

    if (!streamId) {
      return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify stream belongs to this school
    const { data: stream } = await supabase
      .from('grade_streams')
      .select('id, school_id')
      .eq('id', streamId)
      .single();

    if (!stream || stream.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid stream for your school' }, { status: 403 });
    }

    // Get all students in this stream (school-scoped)
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id, admission_number, status,
        users!inner (first_name, last_name, school_id)
      `)
      .eq('current_grade_stream_id', streamId)
      .eq('users.school_id', schoolId)
      .eq('status', 'ACTIVE')
      .order('admission_number');

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 400 });
    }

    // Get existing attendance records for this date
    const studentIds = (students || []).map((s: any) => s.id);
    let attendanceMap: Record<string, { status: string; notes: string | null }> = {};

    if (studentIds.length > 0) {
      const { data: records } = await supabase
        .from('daily_attendance')
        .select('student_id, status, notes')
        .eq('date', date)
        .eq('school_id', schoolId)
        .in('student_id', studentIds);

      if (records) {
        for (const r of records) {
          attendanceMap[r.student_id] = { status: r.status, notes: r.notes };
        }
      }
    }

    // Merge students with attendance data
    const data = (students || []).map((s: any) => ({
      id: s.id,
      name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
      admission_number: s.admission_number,
      status: attendanceMap[s.id]?.status || null, // null = not yet marked
      notes: attendanceMap[s.id]?.notes || null,
    }));

    return NextResponse.json({ data, date });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolId, userId } = auth;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { date, stream_id, records } = body;

    if (!date || !stream_id || !Array.isArray(records)) {
      return NextResponse.json({ error: 'date, stream_id, and records[] are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify stream belongs to this school
    const { data: stream } = await supabase
      .from('grade_streams')
      .select('id, school_id')
      .eq('id', stream_id)
      .single();

    if (!stream || stream.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid stream for your school' }, { status: 403 });
    }

    // Validate all student IDs belong to this school
    const studentIds = records.map((r: any) => r.student_id);
    const { data: validStudents } = await supabase
      .from('students')
      .select('id, users!inner(school_id)')
      .in('id', studentIds)
      .eq('users.school_id', schoolId);

    const validIds = new Set((validStudents || []).map((s: any) => s.id));
    for (const r of records) {
      if (!validIds.has(r.student_id)) {
        return NextResponse.json({ error: `Invalid student ID: ${r.student_id}` }, { status: 400 });
      }
    }

    // Upsert attendance records
    const upsertData = records.map((r: any) => ({
      student_id: r.student_id,
      date,
      status: r.status,
      notes: r.notes || null,
      marked_by: userId,
      school_id: schoolId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('daily_attendance')
      .upsert(upsertData, { onConflict: 'student_id,date' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: records.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
