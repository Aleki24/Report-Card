import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';
import { fetchActiveMultiPaperScheme } from '@/lib/multi-paper-server';
import { calculateCompositeSubjectScore, normalizeResolvedRawScore } from '@/lib/multi-paper';
import type { ExamSubjectComponentScheme } from '@/types';

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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .maybeSingle();

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

    // If teacher, verify exam visibility
    if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
      const { data: exam } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle();
      if (!exam || exam.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // School-scope through the join rather than pre-fetching every student id
    // in the school (which was unbounded and could be thousands of ids).
    const { data, error } = await supabase
      .from('exam_marks')
      .select(`
        id, student_id, raw_score, percentage, grade_symbol, rubric, remarks,
        students!inner (
          admission_number,
          users!inner ( first_name, last_name, school_id )
        )
      `)
      .eq('exam_id', examId)
      .eq('students.users.school_id', schoolId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
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

    if (userProfile.role === 'CLASS_TEACHER' || userProfile.role === 'SUBJECT_TEACHER') {
      const { data: exam } = await supabase.from('exams').select('*').eq('id', exam_id).maybeSingle();
      if (!exam || exam.school_id !== schoolId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const perms = await getTeacherPermissions(userId);
      if (!isExamVisibleToTeacher(exam, perms, userId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (componentRows.length > 0) {
      const { error: compError } = await supabase
        .from('exam_mark_components')
        .upsert(componentRows, { onConflict: 'component_id,student_id' });
      if (compError) return NextResponse.json({ error: compError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', userId)
      .single();

    if (!userProfile || !['ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER'].includes(userProfile.role)) {
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
    }
    
    const { error } = await supabase.from('exam_marks').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Also remove the student's per-paper scores for this exam (if any)
    await supabase
      .from('exam_mark_components')
      .delete()
      .eq('exam_id', markCheck.exam_id)
      .eq('student_id', (markCheck as any).student_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
