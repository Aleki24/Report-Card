import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { auth } from '@clerk/nextjs/server';
import type { GradeBand } from '@/types';

/**
 * A subject as the dashboard needs to reason about it: which curriculum it
 * belongs to, and which grading system the school assigned it.
 *
 * Marks carry only `subject_id`, and two subjects in the same school can share
 * a name across curricula — this school has an "Agriculture" under CBC and
 * another under 8-4-4, on different scales. Anything that groups marks by name
 * silently merges the two, which is how a CBC learner's EE2 ended up counting
 * towards an 8-4-4 subject's letter grade.
 */
export interface SubjectMeta {
    id: string;
    name: string;
    academic_level_id: string | null;
    level_code: string | null;
    level_name: string | null;
    grading_system_id: string | null;
}

/** Bands keyed by grading system id, for turning a percentage into a symbol. */
export type GradeBandsBySystem = Record<string, GradeBand[]>;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .maybeSingle();

    const schoolId = userProfile?.school_id as string | null;
    const role = userProfile?.role;

    if (!schoolId || !role) {
      return NextResponse.json({ marks: [], subjects: [], gradingScales: {} });
    }

    // School-wide analytics is admin-only. Teachers see marks scoped to their
    // assignments through the exam-marks / student-results routes instead; this
    // endpoint returns every mark in the school, so restrict it to admins.
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('stream_id');
    const examId = searchParams.get('exam_id');
    const subjectId = searchParams.get('subject_id');
    const yearId = searchParams.get('year_id');
    const termId = searchParams.get('term_id');

    // Scope by exams.school_id directly. Filtering through academic_years with
    // inner joins on grades/academic_years silently drops every mark whose exam
    // has a null grade/year link, which is why the page showed "no marks" while
    // marks existed. exams carries its own school_id, so use it.
    // exam_marks has no subject_id column of its own — the subject is only
    // reachable via exams.subject_id, confirmed against production
    // ("column exam_marks.subject_id does not exist").
    let query = supabaseAdmin
      .from('exam_marks')
      .select(`
        id,
        raw_score,
        percentage,
        grade_symbol,
        student_id,
        exam_id,
        students ( admission_number, users ( first_name, last_name ) ),
        exams!inner (
          id,
          name,
          exam_date,
          school_id,
          academic_year_id,
          term_id,
          grade_stream_id,
          subject_id,
          subjects ( name )
        )
      `)
      .eq('exams.school_id', schoolId);

    // Class filter: a stream's exams include both stream-level exams AND
    // whole-grade exams (grade_stream_id null but grade_id matching the
    // stream's grade). Marks are entered at the grade level in many schools,
    // so a plain grade_stream_id match would miss them. Resolve the matching
    // exam ids first, mirroring /api/school/data's exam-list logic.
    if (streamId) {
      const { data: stream } = await supabaseAdmin
        .from('grade_streams')
        .select('grade_id')
        .eq('id', streamId)
        .maybeSingle();

      let examQuery = supabaseAdmin.from('exams').select('id').eq('school_id', schoolId);
      if (stream?.grade_id) {
        examQuery = examQuery.or(`grade_stream_id.eq.${streamId},and(grade_id.eq.${stream.grade_id},grade_stream_id.is.null)`);
      } else {
        examQuery = examQuery.eq('grade_stream_id', streamId);
      }
      const { data: streamExams } = await examQuery;
      const examIds = (streamExams || []).map((e: { id: string }) => e.id);
      if (examIds.length === 0) {
        return NextResponse.json({ marks: [], subjects: [], gradingScales: {} });
      }
      query = query.in('exam_id', examIds);
    }

    if (examId) query = query.eq('exam_id', examId);
    if (subjectId) query = query.eq('exams.subject_id', subjectId);
    if (yearId) query = query.eq('exams.academic_year_id', yearId);
    if (termId) query = query.eq('exams.term_id', termId);

    // The school's subjects and its grading scales, fetched alongside the marks
    // rather than joined onto each one: both lists are small and shared by every
    // mark, so sending them once keeps the payload flat.
    const [marksRes, subjectsRes, systemsRes] = await Promise.all([
      query,
      supabaseAdmin
        .from(SCHOOL_SUBJECT_VIEW)
        .select('id, name, academic_level_id, band, grading_system_id, academic_levels ( code, name )')
        .eq('school_id', schoolId),
      supabaseAdmin
        // Seeded defaults ("CBC Standard Grading") carry a null school_id and a
        // subject may point at one, so they belong here alongside the school's
        // own. Other schools' systems do not.
        .from('grading_systems')
        .select('id, grading_scales ( symbol, min_percentage, max_percentage )')
        .or(`school_id.eq.${schoolId},school_id.is.null`)
        .neq('system_kind', 'OVERALL'),
    ]);

    const { data: marks, error } = marksRes;

    if (error) {
      console.error('Analytics query error:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    // Supabase returns to-one relations as either an object or a single-element
    // array depending on inference; normalise both. Flatten into the shape the
    // Analytics page consumes (subject_name / student_name / exam_name / etc.).
    const one = (rel: unknown): Record<string, unknown> => {
      const v = Array.isArray(rel) ? rel[0] : rel;
      return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    };

    const flat = (marks || []).map((m: Record<string, unknown>) => {
      const exam = one(m.exams);
      const subject = one(exam.subjects);
      const student = one(m.students);
      const user = one(student.users);
      const first = (user.first_name as string) || '';
      const last = (user.last_name as string) || '';
      const fullName = `${first} ${last}`.trim();
      return {
        id: m.id,
        raw_score: m.raw_score,
        percentage: m.percentage,
        grade_symbol: m.grade_symbol,
        subject_id: exam.subject_id,
        exam_id: m.exam_id,
        student_id: m.student_id,
        subject_name: (subject.name as string) || 'Unknown',
        exam_name: (exam.name as string) || 'Unknown Exam',
        exam_date: (exam.exam_date as string) || null,
        student_name: fullName || 'Unknown',
        admission_number: (student.admission_number as string) || '',
      };
    });

    const subjects: SubjectMeta[] = ((subjectsRes.data || []) as Record<string, unknown>[]).map(s => {
      const level = one(s.academic_levels);
      return {
        id: s.id as string,
        name: ((s.name as string) || '').trim() || 'Unknown',
        academic_level_id: (s.academic_level_id as string) ?? null,
        level_code: (level.code as string) ?? null,
        level_name: (level.name as string) ?? null,
        grading_system_id: (s.grading_system_id as string) ?? null,
      };
    });

    const gradingScales: GradeBandsBySystem = {};
    for (const system of (systemsRes.data || []) as Record<string, unknown>[]) {
      const bands = (system.grading_scales as GradeBand[] | null) || [];
      if (bands.length === 0) continue;
      gradingScales[system.id as string] = bands
        .map(b => ({
          symbol: b.symbol,
          min_percentage: Number(b.min_percentage),
          max_percentage: Number(b.max_percentage),
        }))
        .sort((a, b) => b.min_percentage - a.min_percentage);
    }

    return NextResponse.json({ marks: flat, subjects, gradingScales });
  } catch (err) {
    console.error('Analytics route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
