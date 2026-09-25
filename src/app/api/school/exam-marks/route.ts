import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { canTeacherMarkStudent, getTeacherPermissions, isExamVisibleToTeacher, markableStudentIds, type TeacherPermissions } from '@/lib/teacher-utils';
import { fetchActiveMultiPaperScheme } from '@/lib/multi-paper-server';
import { calculateCompositeSubjectScore, normalizeResolvedRawScore } from '@/lib/multi-paper';
import type { ExamSubjectComponentScheme } from '@/types';
import { internalError } from '@/lib/api-errors';

/**
 * Resolve a { [componentId]: score } payload against the exam's
 * multi-paper scheme. Returns the resolved exam_marks fields plus the
 * validated component rows, or an error string.
 */
function resolveComponentEntry(
    scheme: ExamSubjectComponentScheme,
    examMaxScore: number,
    componentScores: Record<string, unknown>
): { raw_score: number; percentage: number; rows: { component_id: string; raw_score: number }[] } | { error: string } {
    const rows: { component_id: string; raw_score: number }[] = [];
    const inputs: { componentId: string; code: string; maxScore: number; score: number | null; displayOrder: number }[] = [];

    for (const c of scheme.components || []) {
        const value = componentScores[c.id];
        const hasValue = value !== null && value !== undefined && value !== '';
        const score = hasValue ? Number(value) : null;
        if (score !== null) {
            if (isNaN(score) || score < 0 || score > Number(c.max_score)) {
                return { error: `${c.component_code} score must be between 0 and ${c.max_score}` };
            }
            rows.push({ component_id: c.id, raw_score: score });
        }
        inputs.push({
            componentId: c.id,
            code: c.component_code,
            maxScore: Number(c.max_score),
            score,
            displayOrder: c.display_order,
        });
    }

    if (rows.length === 0) return { error: 'Enter at least one paper score' };

    const result = calculateCompositeSubjectScore(inputs, scheme.aggregation_method);
    return {
        raw_score: normalizeResolvedRawScore(result.finalPercentage, examMaxScore),
        percentage: result.finalPercentage,
        rows,
    };
}

/**
 * Validate and normalize a single-paper score against the exam's max. The
 * multi-paper path validates per-paper (resolveComponentEntry); this is the
 * equivalent guard for the plain path, which previously stored client-supplied
 * raw_score/percentage verbatim — a 500 on a /100 exam skewed every class
 * average and ranking, and >= 1000 overflowed NUMERIC(5,2).
 */
function validateSinglePaperScore(
    rawScore: unknown,
    examMaxScore: number
): { raw_score: number; percentage: number } | { error: string } {
    const score = Number(rawScore);
    if (rawScore === null || rawScore === undefined || rawScore === '' || isNaN(score)) {
        return { error: 'Score must be a number' };
    }
    const max = examMaxScore > 0 ? examMaxScore : 100;
    if (score < 0 || score > max) {
        return { error: `Score must be between 0 and ${max}` };
    }
    return { raw_score: score, percentage: Math.round((score / max) * 10000) / 100 };
}

/**
 * A stream's subject teacher records that stream's marks — not the stream
 * next door, even on an exam set for the whole grade. The exam's creator
 * keeps full access to it. Returns the 403 to send, or null when allowed.
 */
async function streamDenial(
  perms: TeacherPermissions,
  exam: { subject_id: string; created_by_teacher_id: string | null },
  userId: string,
  studentIds: string[],
): Promise<NextResponse | null> {
  if (exam.created_by_teacher_id === userId) return null;
  const allowed = await markableStudentIds(perms, exam.subject_id, studentIds);
  return studentIds.every(id => allowed.has(id))
    ? null
    : NextResponse.json({ error: 'You can only enter marks for learners in the streams you teach this subject in.' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = userProfile?.school_id as string | null;
    const role = userProfile?.role as string | null;
    if (!schoolId || !role) return NextResponse.json({ data: [] });

    // Students shouldn't access the class marks list
    if (role === 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');
    if (!examId) {
      return NextResponse.json({ error: 'exam_id is required' }, { status: 400 });
    }

    // If teacher, verify exam visibility, and remember whose marks they keep
    // so a grade-wide exam shows them their own streams only.
    let teacherScope: { perms: TeacherPermissions; subjectId: string } | null = null;
    if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
      const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle();
      if (!exam || exam.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (exam.created_by_teacher_id !== userId) teacherScope = { perms, subjectId: exam.subject_id };
    }

    // School-scope through the join rather than pre-fetching every student id
    // in the school (which was unbounded and could be thousands of ids).
    const { data: schoolMarks, error } = await supabase
      .from('exam_marks')
      .select(`
        id, student_id, raw_score, percentage, grade_symbol, rubric, remarks,
        students!inner (
          admission_number, current_grade_stream_id,
          users!inner ( first_name, last_name, school_id ),
          grade_streams ( grade_id )
        )
      `)
      .eq('exam_id', examId)
      .eq('students.users.school_id', schoolId);

    if (error) return internalError('exam-marks list', error);

    type MarkPlacement = { students: { current_grade_stream_id: string | null; grade_streams: { grade_id: string } | { grade_id: string }[] | null } | null };
    const placementOf = (m: MarkPlacement) => {
      const stream = m.students?.grade_streams;
      return {
        current_grade_stream_id: m.students?.current_grade_stream_id ?? null,
        grade_id: (Array.isArray(stream) ? stream[0] : stream)?.grade_id ?? null,
      };
    };
    const data = teacherScope
      ? (schoolMarks || []).filter(m => canTeacherMarkStudent(teacherScope.perms, teacherScope.subjectId, placementOf(m as unknown as MarkPlacement)))
      : schoolMarks;

    // Attach per-paper scores when this exam uses a multi-paper scheme. The
    // exam is already school-scoped, so filtering components by exam_id (and the
    // students actually returned) is sufficient.
    const returnedStudentIds = (data || []).map((m: any) => m.student_id);
    const scheme = await fetchActiveMultiPaperScheme(supabase, examId);
    const componentsByStudent = new Map<string, Record<string, number>>();
    if (scheme && returnedStudentIds.length > 0) {
      const { data: markComponents } = await supabase
        .from('exam_mark_components')
        .select('student_id, component_id, raw_score')
        .eq('exam_id', examId)
        .in('student_id', returnedStudentIds);

      for (const mc of markComponents || []) {
        const entry = componentsByStudent.get(mc.student_id) || {};
        entry[mc.component_id] = Number(mc.raw_score);
        componentsByStudent.set(mc.student_id, entry);
      }
    }

    const mapped = (data || []).map((m: any) => ({
      id: m.id,
      student_id: m.student_id,
      student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(),
      admission_number: m.students?.admission_number || '',
      raw_score: m.raw_score,
      percentage: m.percentage,
      grade_symbol: m.grade_symbol,
      rubric: m.rubric,
      remarks: m.remarks,
      components: componentsByStudent.get(m.student_id) || undefined,
    }));

    return NextResponse.json({ data: mapped, scheme });
  } catch (err: unknown) {
    return internalError('exam-marks GET', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, school_id, is_active')
      .eq('id', userId)
      .single();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = userProfile.school_id;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { exam_id, marks } = body;
    
    if (!exam_id || !Array.isArray(marks)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // The exam must be this school's — for admins too, who were never checked.
    const { data: exam } = await supabase.from('exams').select('*').eq('id', exam_id).maybeSingle();
    if (!exam || exam.school_id !== schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (marks.length === 0) return NextResponse.json({ error: 'No marks to save' }, { status: 400 });
    if (marks.length > 2000) return NextResponse.json({ error: 'Too many marks in one request' }, { status: 400 });
    const submittedIds = [...new Set(marks.map((m: { student_id?: unknown }) => String(m.student_id ?? '')))];
    // One upsert cannot touch the same (student, exam) row twice.
    if (submittedIds.length !== marks.length) {
      return NextResponse.json({ error: 'Each learner can appear only once per save.' }, { status: 400 });
    }

    if (userProfile.role === 'CLASS_TEACHER' || userProfile.role === 'SUBJECT_TEACHER') {
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const denial = await streamDenial(perms, exam, userId, submittedIds);
      if (denial) return denial;
    }

    // Validate just the submitted students. Listing every student in the
    // school first hit PostgREST's 1,000-row cap, after which a large
    // school's valid learners were rejected as "Invalid student ID".
    const { data: schoolStudents } = submittedIds.length
      ? await supabase
          .from('users')
          .select('id')
          .eq('school_id', schoolId)
          .eq('role', 'STUDENT')
          .in('id', submittedIds)
      : { data: [] as { id: string }[] };

    const validStudentIds = new Set((schoolStudents || []).map(u => u.id));
    for (const m of marks) {
      if (!validStudentIds.has(m.student_id)) {
         return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
      }
    }

    // Multi-paper exams: resolve per-paper scores into the final subject
    // score server-side (the stored exam_marks row stays the single
    // resolved score every downstream consumer already uses).
    const { data: examRow } = await supabase
      .from('exams')
      .select('id, max_score')
      .eq('id', exam_id)
      .maybeSingle();
    const scheme = await fetchActiveMultiPaperScheme(supabase, exam_id);
    const componentRows: { exam_id: string; subject_id?: string; student_id: string; component_id: string; raw_score: number }[] = [];

    const processedMarks: any[] = [];
    for (const m of marks) {
      if (scheme && m.components && typeof m.components === 'object') {
        const resolved = resolveComponentEntry(scheme, Number(examRow?.max_score) || 100, m.components);
        if ('error' in resolved) {
          return NextResponse.json({ error: `Student ${m.student_id}: ${resolved.error}` }, { status: 400 });
        }
        processedMarks.push({
          student_id: m.student_id,
          exam_id,
          raw_score: resolved.raw_score,
          percentage: resolved.percentage,
          grade_symbol: m.grade_symbol,
          rubric: m.rubric || null,
          remarks: m.remarks,
        });
        for (const row of resolved.rows) {
          componentRows.push({
            exam_id,
            subject_id: scheme.subject_id,
            student_id: m.student_id,
            component_id: row.component_id,
            raw_score: row.raw_score,
          });
        }
      } else {
        const validated = validateSinglePaperScore(m.raw_score, Number(examRow?.max_score) || 100);
        if ('error' in validated) {
          return NextResponse.json({ error: `Student ${m.student_id}: ${validated.error}` }, { status: 400 });
        }
        processedMarks.push({
          student_id: m.student_id,
          exam_id,
          raw_score: validated.raw_score,
          // Recompute percentage server-side rather than trusting the client's.
          percentage: validated.percentage,
          grade_symbol: m.grade_symbol,
          rubric: m.rubric || null,
          remarks: m.remarks,
        });
      }
    }

    // Upsert marks using admin client
    const { data, error } = await supabase
      .from('exam_marks')
      .upsert(processedMarks, { onConflict: 'student_id,exam_id' })
      .select();

    if (error) return internalError('exam-marks save', error);

    if (componentRows.length > 0) {
      const { error: compError } = await supabase
        .from('exam_mark_components')
        .upsert(componentRows, { onConflict: 'component_id,student_id' });
      if (compError) return internalError('exam-marks paper scores save', compError);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return internalError('exam-marks', err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, school_id, is_active')
      .eq('id', userId)
      .single();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = userProfile.school_id;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { id, raw_score, percentage, grade_symbol, rubric, remarks, components } = body;

    if (!id) return NextResponse.json({ error: 'Mark ID required' }, { status: 400 });

    // Verify mark ownership
    const { data: markCheck } = await supabase
      .from('exam_marks')
      .select('id, exam_id, student_id, students!inner ( users!inner ( school_id ) )')
      .eq('id', id)
      .single();

    if (!markCheck || (markCheck as any).students?.users?.school_id !== schoolId) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (userProfile.role === 'CLASS_TEACHER' || userProfile.role === 'SUBJECT_TEACHER') {
      const { data: exam } = await supabase.from('exams').select('*').eq('id', markCheck.exam_id).maybeSingle();
      if (!exam || exam.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const denial = await streamDenial(perms, exam, userId, [markCheck.student_id as string]);
      if (denial) return denial;
    }
    
    const updateData: Record<string, any> = { grade_symbol, remarks };
    if (rubric !== undefined) {
        updateData.rubric = rubric;
    }

    const { data: patchExamRow } = await supabase
      .from('exams')
      .select('max_score')
      .eq('id', markCheck.exam_id)
      .maybeSingle();
    const patchExamMax = Number(patchExamRow?.max_score) || 100;

    // Multi-paper: recompute the resolved score from the edited papers
    if (components && typeof components === 'object') {
      const scheme = await fetchActiveMultiPaperScheme(supabase, markCheck.exam_id);
      if (scheme) {
        const resolved = resolveComponentEntry(scheme, patchExamMax, components);
        if ('error' in resolved) {
          return NextResponse.json({ error: resolved.error }, { status: 400 });
        }
        updateData.raw_score = resolved.raw_score;
        updateData.percentage = resolved.percentage;

        const { error: compError } = await supabase
          .from('exam_mark_components')
          .upsert(
            resolved.rows.map(r => ({
              exam_id: markCheck.exam_id,
              subject_id: scheme.subject_id,
              student_id: (markCheck as any).student_id,
              component_id: r.component_id,
              raw_score: r.raw_score,
            })),
            { onConflict: 'component_id,student_id' }
          );
        if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });

        // Delete component rows the teacher cleared this edit (papers omitted
        // from the payload count as 0 in the resolved score, so their stale
        // rows must not linger and print on the report card).
        const keptIds = resolved.rows.map(r => r.component_id);
        const { error: delError } = await supabase
          .from('exam_mark_components')
          .delete()
          .eq('exam_id', markCheck.exam_id)
          .eq('student_id', (markCheck as any).student_id)
          .not('component_id', 'in', `(${keptIds.join(',')})`);
        if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });
      }
    } else {
      // Single-paper edit: validate/normalize like the POST path.
      const validated = validateSinglePaperScore(raw_score, patchExamMax);
      if ('error' in validated) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      updateData.raw_score = validated.raw_score;
      updateData.percentage = validated.percentage;
    }

    const { data, error } = await supabase
      .from('exam_marks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return internalError('exam-marks update', error);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return internalError('exam-marks', err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, school_id, is_active')
      .eq('id', userId)
      .single();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schoolId = userProfile.school_id;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Mark ID required' }, { status: 400 });

    // Verify mark ownership
    const { data: markCheck } = await supabase
      .from('exam_marks')
      .select('id, exam_id, student_id, students!inner ( users!inner ( school_id ) )')
      .eq('id', id)
      .single();

    if (!markCheck || (markCheck as any).students?.users?.school_id !== schoolId) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (userProfile.role === 'CLASS_TEACHER' || userProfile.role === 'SUBJECT_TEACHER') {
      const { data: exam } = await supabase.from('exams').select('*').eq('id', markCheck.exam_id).maybeSingle();
      if (!exam || exam.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Same stream rule as saving: seeing a grade-wide exam does not let a
      // teacher remove marks in a stream they don't teach.
      const denial = await streamDenial(perms, exam, userId, [markCheck.student_id as string]);
      if (denial) return denial;
    }

    const { error } = await supabase.from('exam_marks').delete().eq('id', id);

    if (error) return internalError('exam-marks delete', error);

    // Also remove the student's per-paper scores for this exam (if any)
    await supabase
      .from('exam_mark_components')
      .delete()
      .eq('exam_id', markCheck.exam_id)
      .eq('student_id', (markCheck as any).student_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return internalError('exam-marks', err);
  }
}
