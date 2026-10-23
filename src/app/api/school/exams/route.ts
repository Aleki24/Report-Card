import { NextRequest, NextResponse } from 'next/server';
import { customExamTypeCode, isBuiltInExamType, isValidExamType } from '@/lib/exam-types';
import { isSubjectOfferedAtGrade } from '@/lib/curriculum-bands';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { embedOne, fetchAllRows, isUuid } from '@/lib/postgrest';
import { findActiveTermId } from '@/lib/term-calendar';
import { isTaughtInGrade, seniorSubjectsTaught } from '@/lib/senior-subjects';

/** The fields of an exam row that say which class and subject it is for. */
interface PlacedExam {
  grade_id: string;
  subject_id: string;
  grades: { code: string | null; name_display: string | null } | { code: string | null; name_display: string | null }[] | null;
  subjects: { code: string | null; subject_type: string | null } | { code: string | null; subject_type: string | null }[] | null;
}

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
    let termId = searchParams.get('term_id');
    // ?ready=1: this term's papers with marks entered but not yet released —
    // what the dashboard's "ready to release" card counts, so it can open
    // straight on them instead of on a class picker.
    const ready = searchParams.get('ready') === '1';
    const examType = searchParams.get('exam_type');
    const subjectId = searchParams.get('subject_id');
    const status = searchParams.get('status');

    const supabase = createSupabaseAdmin();

    if (ready && !termId) {
      const { data: terms } = await supabase
        .from('terms')
        .select('id, name, start_date, end_date, is_current')
        .eq('school_id', schoolId);
      termId = findActiveTermId(terms ?? []);
      if (!termId) return NextResponse.json({ data: [] });
    }

    // Filter by stream/grade. Both are interpolated into the or() filter
    // string below, so they must be plain ids, not filter syntax.
    if ((streamId && !isUuid(streamId)) || (gradeId && !isUuid(gradeId))) {
      return NextResponse.json({ error: 'Invalid stream or grade id' }, { status: 400 });
    }

    const buildQuery = () => {
      let query = supabase
        .from('exams')
        .select(`
          id, name, exam_type, max_score, exam_date, grade_stream_id, grade_id, subject_id, term_id, created_by_teacher_id,
          status, published_by, published_at, approved_by,${ready ? '\n          exam_marks ( count ),' : ''}
          subjects:subject_id ( name, code, category, subject_type ),
          grades:grade_id ( name_display, code ),
          grade_streams:grade_stream_id ( full_name ),
          terms:term_id ( name ),
          publisher:published_by ( first_name, last_name )
        `)
        .eq('school_id', schoolId)
        .order('exam_type', { ascending: true })
        // Tiebreaker so paging past 1,000 exams never skips or repeats one.
        .order('id', { ascending: true });

      // New: filter by term
      if (termId) query = query.eq('term_id', termId);
      // New: filter by exam type
      if (examType) query = query.eq('exam_type', examType);
      // New: filter by subject
      if (subjectId) query = query.eq('subject_id', subjectId);
      // New: filter by workflow status — lets the Publish screen pull every exam
      // awaiting approval across the school in one call, with no class picked.
      if (ready) {
        query = query.eq('status', 'DRAFT');
      } else if (status && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(status)) {
        query = query.eq('status', status);
      }

      if (streamId && gradeId) {
        query = query.or(
          `grade_stream_id.eq.${streamId},and(grade_id.eq.${gradeId},grade_stream_id.is.null)`
        );
      } else if (streamId) {
        query = query.eq('grade_stream_id', streamId);
      } else if (gradeId) {
        query = query.eq('grade_id', gradeId);
      }
      return query;
    };

    const { rows: data, error } = await fetchAllRows(buildQuery);
    if (error) return NextResponse.json({ error: (error as { message?: string }).message ?? 'Could not load exams' }, { status: 400 });

    /** Marks entered for an exam; only counted (as an aggregate) with ?ready=1. */
    const markCount = (e: object): number => (e as { exam_marks?: { count: number }[] | null }).exam_marks?.[0]?.count ?? 0;
    const rows = ready ? (data || []).filter(e => markCount(e) > 0) : data || [];

    // The teacher's own exams, and which Senior School electives each class
    // takes, side by side: each is a round trip to the database.
    const seniorGrades = new Map((rows as unknown as PlacedExam[]).map(e => [e.grade_id, { id: e.grade_id, code: embedOne(e.grades)?.code ?? null, name_display: embedOne(e.grades)?.name_display ?? null }]));
    const [visible, taught] = await Promise.all([
      (async () => {
        if (auth.role === 'ADMIN') return rows;
        const { getTeacherPermissions, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
        const perms = await getTeacherPermissions(auth.userId);
        return rows.filter((exam: any) => isExamVisibleToTeacher(exam, perms, auth.userId));
      })(),
      seniorSubjectsTaught(supabase, schoolId, [...seniorGrades.values()]),
    ]);

    // Senior School papers for electives a class doesn't take, seeded before
    // that was checked. Hidden unless someone has entered a mark in one —
    // looked up for those few papers only, not counted for every exam.
    const untaught = (visible as unknown as (PlacedExam & { id: string })[]).filter(e => {
      const subject = embedOne(e.subjects);
      return !isTaughtInGrade(taught, e.grade_id, { id: e.subject_id, code: subject?.code ?? '', subject_type: subject?.subject_type });
    }).map(e => e.id);
    const hidden = new Set(untaught);
    for (let i = 0; i < untaught.length; i += 200) {
      const { data: marked, error: markedError } = await supabase.from('exam_marks').select('exam_id').in('exam_id', untaught.slice(i, i + 200));
      if (markedError) return NextResponse.json({ error: 'Could not load exams' }, { status: 400 });
      for (const m of marked ?? []) hidden.delete(m.exam_id as string);
    }
    const filteredExams = hidden.size > 0 ? visible.filter(e => !hidden.has((e as unknown as { id: string }).id)) : visible;

    const mapped = (filteredExams).map((e: any) => ({
      id: e.id,
      name: e.name,
      exam_type: e.exam_type,
      max_score: e.max_score,
      exam_date: e.exam_date,
      subject_id: e.subject_id,
      subject_name: e.subjects?.name || 'N/A',
      subject_code: e.subjects?.code || '',
      subject_category: e.subjects?.category || '',
      grade_name: e.grades?.name_display || 'N/A',
      grade_stream_id: e.grade_stream_id,
      grade_stream_name: e.grade_streams?.full_name || null,
      grade_id: e.grade_id,
      term_id: e.term_id,
      term_name: e.terms?.name || null,
      status: e.status || 'DRAFT',
      published_by: e.published_by,
      published_by_name: e.publisher ? `${e.publisher.first_name || ''} ${e.publisher.last_name || ''}`.trim() : null,
      published_at: e.published_at,
      approved_by: e.approved_by,
      created_by_teacher_id: e.created_by_teacher_id,
      ...(ready ? { mark_count: markCount(e) } : {}),
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

      const { termId, academicYearId } = body;
      if (!termId || !academicYearId) {
        return NextResponse.json({ error: 'termId and academicYearId are required' }, { status: 400 });
      }
      const examTypes: string[] | undefined = Array.isArray(body.examTypes)
        ? (body.examTypes as unknown[]).filter((t): t is string => typeof t === 'string').map(customExamTypeCode)
        : undefined;
      if (examTypes?.some(t => !isValidExamType(t))) {
        return NextResponse.json({ error: 'Name the exam type with 2–30 letters or numbers, e.g. KNEC SBA.' }, { status: 400 });
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
    const examTypeCode = typeof exam_type === 'string' && exam_type.trim() ? customExamTypeCode(exam_type) : 'CAT';
    if (!isValidExamType(examTypeCode)) {
      return NextResponse.json({ error: 'Name the exam type with 2–30 letters or numbers, e.g. KNEC SBA.' }, { status: 400 });
    }

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

    // ── The subject must belong to this school, and to this class ──
    //
    // Nothing here checked the subject at all, so a CBC learning area could be
    // attached to a Form 4 exam and an 8-4-4 subject to a Grade 10 one. It
    // happened: one school ended up with sixteen such exams, and marks entered
    // against them were graded on the wrong curriculum's table — Form 4
    // learners' Chemistry letters read as CBC performance levels, and Grade 10
    // learners' CBC bands sat under 8-4-4 Mathematics.
    //
    // Two cuts, because one is not enough. The academic level separates CBC
    // from 8-4-4. The curriculum band separates Grade 4 from Grade 12, which
    // share a single CBC level — without it, "Essential Mathematics" is a legal
    // choice for an Upper Primary exam.
    const [{ data: subjectCheck }, { data: gradeCheck }] = await Promise.all([
      supabase
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, name, code, band, school_id, academic_level_id')
        .eq('id', subject_id)
        .eq('school_id', schoolId)
        .maybeSingle(),
      supabase
        .from('grades')
        .select('id, code, name_display, academic_level_id')
        .eq('id', grade_id)
        .maybeSingle(),
    ]);

    if (!subjectCheck) {
      return NextResponse.json({ error: 'That subject is not offered by your school' }, { status: 400 });
    }
    if (!gradeCheck) {
      return NextResponse.json({ error: 'Invalid grade' }, { status: 400 });
    }

    if (
      subjectCheck.academic_level_id &&
      gradeCheck.academic_level_id &&
      subjectCheck.academic_level_id !== gradeCheck.academic_level_id
    ) {
      return NextResponse.json(
        { error: `${subjectCheck.name?.trim() || 'That subject'} is not taught under ${gradeCheck.name_display}'s curriculum.` },
        { status: 400 },
      );
    }

    if (!isSubjectOfferedAtGrade(subjectCheck, gradeCheck)) {
      return NextResponse.json(
        { error: `${subjectCheck.name?.trim() || 'That subject'} is not taught at ${gradeCheck.name_display}.` },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('exams')
      .insert({
        name: name.trim(),
        exam_type: examTypeCode,
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
      // 22P02: the database still stores exam types as a fixed list (migration 20261006100000 not applied).
      if (error.code === '22P02' && !isBuiltInExamType(examTypeCode)) {
        return NextResponse.json({ error: 'Your own exam types are not switched on yet. Choose one from the list, or ask Skulbase support to enable them.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
