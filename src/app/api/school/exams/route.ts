// src/app/api/school/exams/route.ts
// GET: Returns exams scoped to the current user's school
// POST: Creates a new exam, enforcing school isolation server-side

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

async function getSession() {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id as string,
    schoolId: session.user.schoolId as string | null,
    role: session.user.role as string,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { schoolId } = auth;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    const gradeId = searchParams.get('grade_id');

    const supabase = createSupabaseAdmin();

    // Get all teacher/admin IDs in this school
    const { data: schoolTeachers } = await supabase
      .from('users')
      .select('id')
      .eq('school_id', schoolId)
      .in('role', ['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER']);

    const teacherIds = (schoolTeachers || []).map(u => u.id);

    let query = supabase
      .from('exams')
      .select(`
        id, name, exam_type, max_score, grade_stream_id, grade_id,
        subjects:subject_id ( name ),
        grades:grade_id ( name_display )
      `)
      .order('exam_date', { ascending: false });

    // Filter by stream/grade
    if (streamId && gradeId) {
      query = query.or(
        `grade_stream_id.eq.${streamId},and(grade_id.eq.${gradeId},grade_stream_id.is.null)`
      );
    } else if (streamId) {
      query = query.eq('grade_stream_id', streamId);
    }

    // Only return exams created by teachers in this school
    if (teacherIds.length > 0) {
      query = query.or(
        `created_by_teacher_id.in.(${teacherIds.join(',')}),created_by_teacher_id.is.null`
      );
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const mapped = (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      exam_type: e.exam_type,
      max_score: e.max_score,
      subject_name: e.subjects?.name || 'N/A',
      grade_name: e.grades?.name_display || 'N/A',
      grade_stream_id: e.grade_stream_id,
      grade_id: e.grade_id,
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId, schoolId, role } = auth;

    // Only admins and teachers can create exams
    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with your account' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, exam_type, subject_id, academic_year_id,
      term_id, grade_id, grade_stream_id, max_score, exam_date,
    } = body;

    // Validate required fields
    if (!name?.trim()) return NextResponse.json({ error: 'Exam name is required' }, { status: 400 });
    if (!subject_id) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (!academic_year_id) return NextResponse.json({ error: 'Academic year is required' }, { status: 400 });
    if (!term_id) return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    if (!grade_id) return NextResponse.json({ error: 'Grade is required' }, { status: 400 });
    if (!exam_date) return NextResponse.json({ error: 'Exam date is required' }, { status: 400 });
    if (!max_score || max_score <= 0) return NextResponse.json({ error: 'Max score must be greater than 0' }, { status: 400 });

    // Verify the term and academic_year belong to this school
    const supabase = createSupabaseAdmin();

    const { data: termCheck } = await supabase
      .from('terms')
      .select('id, school_id')
      .eq('id', term_id)
      .single();

    if (!termCheck || termCheck.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid term for your school' }, { status: 400 });
    }

    // If a stream is provided, verify it belongs to this school
    if (grade_stream_id) {
      const { data: streamCheck } = await supabase
        .from('grade_streams')
        .select('id, school_id')
        .eq('id', grade_stream_id)
        .single();

      if (!streamCheck || streamCheck.school_id !== schoolId) {
        return NextResponse.json({ error: 'Invalid grade stream for your school' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('exams')
      .insert({
        name: name.trim(),
        exam_type: exam_type || 'MIDTERM',
        subject_id,
        academic_year_id,
        term_id,
        grade_id,
        grade_stream_id: grade_stream_id || null,
        max_score: Number(max_score),
        exam_date,
        created_by_teacher_id: userId,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
