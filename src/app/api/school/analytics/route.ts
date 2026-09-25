import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { auth } from '@clerk/nextjs/server';
import type { GradeBand } from '@/types';
import { getActiveUserProfile } from '@/lib/auth-server';
import { fetchAllRows, MAX_PAGED_ROWS } from '@/lib/postgrest';

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

/**
 * What the returned marks actually cover.
 *
 * Shipped so the page can label its own figures honestly instead of guessing.
 * `truncated` exists to make a silent cap impossible: if it is ever true the
 * caller knows the numbers are partial rather than presenting them as fact.
 */
export interface AnalyticsScope {
    term_id: string | null;
    term_name: string | null;
    academic_year_id: string | null;
    academic_year_name: string | null;
    mark_count: number;
    truncated: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const userProfile = await getActiveUserProfile(userId);

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
    const allTerms = searchParams.get('all_terms') === 'true';

    /**
     * Default to the term the school says it is in.
     *
     * With no default this route returned every mark ever recorded, so the
     * page averaged Term 2 and Term 3 — and, once a second year exists, every
     * year — into a single figure presented as "the" class average. A school
     * asking "how are we doing" means now, not since the beginning.
     *
     * `all_terms=true` opts out, for a caller that genuinely wants the history.
     */
    let effectiveTermId = termId;
    let effectiveYearId = yearId;
    let termName: string | null = null;
    let yearName: string | null = null;

    if (!effectiveTermId && !effectiveYearId && !allTerms) {
      const { data: current } = await supabaseAdmin
        .from('terms')
        .select('id, name, academic_year_id, academic_years ( name )')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
      if (current) {
        effectiveTermId = current.id as string;
        effectiveYearId = (current.academic_year_id as string) ?? null;
        termName = (current.name as string) ?? null;
        const ay = current.academic_years as { name?: string } | { name?: string }[] | null;
        yearName = (Array.isArray(ay) ? ay[0]?.name : ay?.name) ?? null;
      }
    }

    let scopedExamIds: string[] | null = null;
    const emptyScope: AnalyticsScope = {
      term_id: effectiveTermId,
      term_name: termName,
      academic_year_id: effectiveYearId,
      academic_year_name: yearName,
      mark_count: 0,
      truncated: false,
    };

    // Scope by exams.school_id directly. Filtering through academic_years with
    // inner joins on grades/academic_years silently drops every mark whose exam
    // has a null grade/year link, which is why the page showed "no marks" while
    // marks existed. exams carries its own school_id, so use it.
    // exam_marks has no subject_id column of its own — the subject is only
    // reachable via exams.subject_id, confirmed against production
    // ("column exam_marks.subject_id does not exist").
    // Built as a factory rather than a single builder: paging re-issues the
    // query once per page, and a PostgREST builder cannot be reused after it
    // has been awaited.
    const buildQuery = () => {
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

      if (scopedExamIds) query = query.in('exam_id', scopedExamIds);
      if (examId) query = query.eq('exam_id', examId);
      if (subjectId) query = query.eq('exams.subject_id', subjectId);
      if (effectiveYearId) query = query.eq('exams.academic_year_id', effectiveYearId);
      if (effectiveTermId) query = query.eq('exams.term_id', effectiveTermId);
      return query;
    };

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
        return NextResponse.json({ marks: [], subjects: [], gradingScales: {}, scope: emptyScope });
      }
      scopedExamIds = examIds;
    }

    // The school's subjects and its grading scales, fetched alongside the marks
    // rather than joined onto each one: both lists are small and shared by every
    // mark, so sending them once keeps the payload flat.
    const [marksRes, subjectsRes, systemsRes] = await Promise.all([
      // Paged, so the answer is every matching mark rather than the first 1000.
      fetchAllRows<Record<string, unknown>>(buildQuery),
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

    const { rows: marks, error, truncated } = marksRes;

    if (error) {
      console.error('Analytics query error:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }
    if (truncated) {
      // Never silently. The caller is told so it can say so.
      console.warn(`Analytics: hit the ${MAX_PAGED_ROWS}-row ceiling for school ${schoolId}`);
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

    const scope: AnalyticsScope = {
      term_id: effectiveTermId,
      term_name: termName,
      academic_year_id: effectiveYearId,
      academic_year_name: yearName,
      mark_count: flat.length,
      truncated,
    };

    return NextResponse.json({ marks: flat, subjects, gradingScales, scope });
  } catch (err) {
    console.error('Analytics route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
