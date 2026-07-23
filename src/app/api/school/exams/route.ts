import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createSupabaseAdmin();
  const { data: userProfile } = await supabase
    .from('users')
    .select('school_id, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (!userProfile || userProfile.is_active === false) return null;

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
    const streamId = searchParams.get('stream_id');
    const gradeId = searchParams.get('grade_id');
    const termId = searchParams.get('term_id');
    const examType = searchParams.get('exam_type');
    const subjectId = searchParams.get('subject_id');

    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('exams')
      .select(`
        id, name, exam_type, max_score, grade_stream_id, grade_id, subject_id, term_id, created_by_teacher_id,
        status, published_by, approved_by,
        subjects:subject_id ( name, code, category ),
        grades:grade_id ( name_display )
      `)
      .eq('school_id', schoolId)
      .order('exam_type', { ascending: true });

    // New: filter by term
    if (termId) query = query.eq('term_id', termId);
    // New: filter by exam type
    if (examType) query = query.eq('exam_type', examType);
    // New: filter by subject
    if (subjectId) query = query.eq('subject_id', subjectId);

    // Filter by stream/grade
    if (streamId && gradeId) {
      query = query.or(
        `grade_stream_id.eq.${streamId},and(grade_id.eq.${gradeId},grade_stream_id.is.null)`
      );
    } else if (streamId) {
      query = query.eq('grade_stream_id', streamId);
    } else if (gradeId) {
      query = query.eq('grade_id', gradeId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let filteredExams = data || [];
    if (auth.role !== 'ADMIN') {
      const { getTeacherPermissions, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
      const perms = await getTeacherPermissions(auth.userId);
      filteredExams = filteredExams.filter((exam: any) => isExamVisibleToTeacher(exam, perms, auth.userId));
    }

    const mapped = (filteredExams).map((e: any) => ({
      id: e.id,
      name: e.name,
      exam_type: e.exam_type,
      max_score: e.max_score,
      subject_id: e.subject_id,
      subject_name: e.subjects?.name || 'N/A',
      subject_code: e.subjects?.code || '',
      subject_category: e.subjects?.category || '',
      grade_name: e.grades?.name_display || 'N/A',
      grade_stream_id: e.grade_stream_id,
      grade_id: e.grade_id,
      term_id: e.term_id,
      status: e.status || 'DRAFT',
      published_by: e.published_by,
      approved_by: e.approved_by,
      created_by_teacher_id: e.created_by_teacher_id,
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

    // Only admins can create exams (teachers just enter marks)
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only administrators can create new exams.' }, { status: 403 });
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with your account' }, { status: 403 });
    }

    const body = await request.json();

    // ── Seed action: bulk-create exam slots for a term ──
    if (body.action === 'seed') {
      if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can seed exam slots' }, { status: 403 });
      }

      const { termId, academicYearId, examTypes } = body;
      if (!termId || !academicYearId) {
        return NextResponse.json({ error: 'termId and academicYearId are required' }, { status: 400 });
      }

      const { seedExamSlots } = await import('@/lib/seed-exam-slots');
      const result = await seedExamSlots({
        termId,
        schoolId,
        academicYearId,
        examTypes,
      });

      if (result.error) {
        return NextResponse.json({ error: result.error, created: result.created, skipped: result.skipped }, { status: 400 });
      }

      return NextResponse.json({ success: true, created: result.created, skipped: result.skipped });
    }

    // ── Standard exam creation (for CATs etc.) ──
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

    // Guard max_score coercion against NaN/Infinity when provided
    let resolvedMaxScore = 100;
    if (max_score !== undefined && max_score !== null && max_score !== '') {
      resolvedMaxScore = Number(max_score);
      if (!Number.isFinite(resolvedMaxScore) || resolvedMaxScore <= 0) {
        return NextResponse.json({ error: 'max_score must be a positive number' }, { status: 400 });
      }
    }

    // Verify the term belongs to this school
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
        exam_type: exam_type || 'CAT',
        subject_id,
        academic_year_id,
        term_id,
        grade_id,
        grade_stream_id: grade_stream_id || null,
        max_score: resolvedMaxScore,
        exam_date: exam_date || null,
        created_by_teacher_id: userId,
        school_id: schoolId,
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
