import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/postgrest';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';
import { RELEASE_BATCH, type ReleaseResponse } from '@/lib/release-ready';

/**
 * POST { examIds } — release many papers at once.
 *
 * "Release all" used to call /api/school/exams/[id]/status once per paper,
 * one after another, and each call re-checked the caller and rebuilt the
 * paper's readiness report (roster, enrolments, marks, papers) that nobody
 * reads once release is confirmed: about a second a paper, so 154 papers
 * took minutes. Here the caller is checked once, every paper's marks are
 * counted in one query and the release is one update.
 *
 * The rules are the status route's: only the teacher who can see the paper
 * (or an admin) releases it, a paper nobody has marked stays hidden, and an
 * already released one is left alone.
 */
export async function POST(request: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.schoolId || !isRoleIn(caller.role, STAFF_TEACHING_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const schoolId = caller.schoolId;

  const body = (await request.json().catch(() => null)) as { examIds?: unknown } | null;
  const ids = Array.isArray(body?.examIds) ? [...new Set(body.examIds)] : [];
  if (ids.length === 0 || ids.length > RELEASE_BATCH || !ids.every((id): id is string => typeof id === 'string' && isUuid(id))) {
    return NextResponse.json({ error: `Send 1 to ${RELEASE_BATCH} exam ids.` }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const [{ data: exams, error: examsError }, { data: totals, error: totalsError }, perms] = await Promise.all([
    supabase
      .from('exams')
      .select('id, status, created_by_teacher_id, grade_id, grade_stream_id, subject_id')
      .eq('school_id', schoolId)
      .in('id', ids),
    // One grouped count for every paper (marks per exam).
    supabase.rpc('exam_mark_totals', { p_school_id: schoolId, p_exam_ids: ids }),
    caller.role === 'ADMIN' ? Promise.resolve(null) : getTeacherPermissions(caller.userId),
  ]);
  if (examsError || totalsError) return NextResponse.json({ error: 'Could not load these exams.' }, { status: 500 });

  const marked = new Set(((totals ?? []) as { exam_id: string; mark_count: number }[]).filter(t => Number(t.mark_count) > 0).map(t => t.exam_id));
  const found = new Map((exams ?? []).map(e => [e.id as string, e]));
  const failures: ReleaseResponse['failures'] = [];
  const toRelease: string[] = [];
  for (const id of ids) {
    const exam = found.get(id);
    if (!exam) failures.push({ id, reason: 'Exam not found' });
    else if (exam.status === 'APPROVED') continue; // already released: nothing to do
    else if (perms && !isExamVisibleToTeacher(exam, perms, caller.userId)) failures.push({ id, reason: 'Only the teacher who entered these marks (or an admin) can release them.' });
    else if (!marked.has(id)) failures.push({ id, reason: 'No marks entered yet.' });
    else toRelease.push(id);
  }

  if (toRelease.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('exams')
      .update({ status: 'APPROVED', published_by: caller.userId, published_at: now, approved_by: caller.userId, approved_at: now })
      .eq('school_id', schoolId)
      .in('id', toRelease);
    if (error) return NextResponse.json({ error: 'Could not release these results.' }, { status: 500 });
  }

  return NextResponse.json({ released: toRelease, failures } satisfies ReleaseResponse);
}
