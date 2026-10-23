import { NextRequest, NextResponse } from 'next/server';
import { getAccess, type Access } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows, isUuid } from '@/lib/postgrest';
import { findActiveTermId } from '@/lib/term-calendar';
import { ALL_EXAM_TYPES, isAnytimeExamType, isValidExamType } from '@/lib/exam-types';
import { EXAM_REQUESTS_TABLE, EXAM_WINDOWS_TABLE, readExamRequests, readExamWindows } from '@/lib/exam-windows-server';
import type { ExamClass, ExamRequest, ExamWindowsResponse } from '@/lib/exam-windows';

/**
 * Which exam each class is marking now.
 *
 * GET  ?term_id= (default: the active term) — the open exams; for those who
 *      can open exams also every class and who is waiting.
 * PUT  { termId, entries: [{ gradeId, examType | null }] } — open (or clear)
 *      an exam for classes. Needs marking.open: admins, the principal,
 *      deputy, DOS and exams officer.
 * POST { termId, gradeIds } — a teacher asks for an exam to be opened for
 *      classes they have exams in.
 */

type Db = ReturnType<typeof createSupabaseAdmin>;

const TEACHING_ROLES = new Set(['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF']);

async function staffAccess(): Promise<Access | NextResponse> {
  const access = await getAccess();
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!TEACHING_ROLES.has(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return access;
}

async function schoolTerm(supabase: Db, schoolId: string, termId: string | null): Promise<{ id: string; name: string } | null> {
  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date, is_current')
    .eq('school_id', schoolId);
  const list = terms ?? [];
  const id = termId ?? findActiveTermId(list);
  const term = list.find(t => t.id === id);
  return term ? { id: term.id as string, name: term.name as string } : null;
}

interface ExamRow { grade_id: string; exam_type: string; grades: { name_display: string; code: string | null } | { name_display: string; code: string | null }[] | null }

const typeOrder = (code: string) => ALL_EXAM_TYPES.find(t => t.code === code)?.order ?? 999;

/** Every class with scheduled exams this term, and which. */
async function termClasses(supabase: Db, schoolId: string, termId: string): Promise<ExamClass[]> {
  const { rows, error } = await fetchAllRows<ExamRow>(() => supabase
    .from('exams')
    .select('grade_id, exam_type, grades:grade_id ( name_display, code )')
    .eq('school_id', schoolId)
    .eq('term_id', termId)
    .order('id'));
  if (error) throw new Error('Could not load this term’s exams');
  const classes = new Map<string, ExamClass>();
  for (const r of rows) {
    if (isAnytimeExamType(r.exam_type)) continue;
    const grade = embedOne(r.grades);
    const c = classes.get(r.grade_id) ?? { grade_id: r.grade_id, name: grade?.name_display ?? 'Class', code: grade?.code ?? null, types: [] };
    if (!c.types.includes(r.exam_type)) c.types.push(r.exam_type);
    classes.set(r.grade_id, c);
  }
  return [...classes.values()]
    .map(c => ({ ...c, types: c.types.sort((a, b) => typeOrder(a) - typeOrder(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function requestSummaries(supabase: Db, rows: { grade_id: string; requested_by: string; created_at: string }[]): Promise<ExamRequest[]> {
  if (rows.length === 0) return [];
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', [...new Set(rows.map(r => r.requested_by))]);
  const nameOf = new Map((users ?? []).map(u => [u.id as string, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'A teacher']));
  const byGrade = new Map<string, ExamRequest>();
  for (const r of rows) {
    const req = byGrade.get(r.grade_id) ?? { grade_id: r.grade_id, names: [], latest: r.created_at };
    req.names.push(nameOf.get(r.requested_by) ?? 'A teacher');
    if (r.created_at > req.latest) req.latest = r.created_at;
    byGrade.set(r.grade_id, req);
  }
  return [...byGrade.values()];
}

export async function GET(request: NextRequest) {
  const access = await staffAccess();
  if (access instanceof NextResponse) return access;

  const requested = new URL(request.url).searchParams.get('term_id');
  if (requested && !isUuid(requested)) return NextResponse.json({ error: 'Invalid term id' }, { status: 400 });

  try {
    const supabase = createSupabaseAdmin();
    const term = await schoolTerm(supabase, access.schoolId, requested);
    const canOpen = access.can('marking.open');
    if (!term) {
      return NextResponse.json({ termId: null, termName: null, data: [], canOpen, classes: [], requests: [], myRequests: [] } satisfies ExamWindowsResponse);
    }
    const [windows, requestRows] = await Promise.all([
      readExamWindows(supabase, access.schoolId, term.id),
      readExamRequests(supabase, access.schoolId, term.id),
    ]);
    const opened = new Set(windows.map(w => w.grade_id));
    // A request is answered once its class has an exam open.
    const waiting = requestRows.filter(r => !opened.has(r.grade_id));
    const body: ExamWindowsResponse = {
      termId: term.id,
      termName: term.name,
      data: windows,
      canOpen,
      classes: canOpen ? await termClasses(supabase, access.schoolId, term.id) : [],
      requests: canOpen ? await requestSummaries(supabase, waiting) : [],
      myRequests: [...new Set(waiting.filter(r => r.requested_by === access.userId).map(r => r.grade_id))],
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load open exams' }, { status: 500 });
  }
}

interface Entry { gradeId: string; examType: string | null }

function parseEntries(raw: unknown): Entry[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const entries: Entry[] = [];
  for (const item of raw) {
    const { gradeId, examType } = (item ?? {}) as { gradeId?: unknown; examType?: unknown };
    if (typeof gradeId !== 'string' || !isUuid(gradeId)) return null;
    if (examType !== null && (typeof examType !== 'string' || !isValidExamType(examType) || isAnytimeExamType(examType))) return null;
    entries.push({ gradeId, examType });
  }
  return entries;
}

function parseGradeIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  return raw.every(id => typeof id === 'string' && isUuid(id)) ? [...new Set(raw as string[])] : null;
}

export async function PUT(request: NextRequest) {
  const access = await staffAccess();
  if (access instanceof NextResponse) return access;
  if (!access.can('marking.open')) return NextResponse.json({ error: 'Only the admin, principal, DOS or exams officer can open an exam for marking' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { termId?: unknown; entries?: unknown } | null;
  const termId = typeof body?.termId === 'string' && isUuid(body.termId) ? body.termId : null;
  const entries = parseEntries(body?.entries);
  if (!termId || !entries) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  if (!(await schoolTerm(supabase, access.schoolId, termId))) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

  const set = entries.filter((e): e is Entry & { examType: string } => e.examType !== null);
  const cleared = entries.filter(e => e.examType === null).map(e => e.gradeId);
  const failed = NextResponse.json({ error: 'Could not save the open exam' }, { status: 500 });

  if (set.length > 0) {
    const { error } = await supabase.from(EXAM_WINDOWS_TABLE).upsert(
      set.map(e => ({ school_id: access.schoolId, term_id: termId, grade_id: e.gradeId, exam_type: e.examType, set_by: access.userId, updated_at: new Date().toISOString() })),
      { onConflict: 'school_id,term_id,grade_id' },
    );
    if (error) return failed;
    // Those classes' requests are answered.
    await supabase.from(EXAM_REQUESTS_TABLE).delete().eq('school_id', access.schoolId).eq('term_id', termId).in('grade_id', set.map(e => e.gradeId));
  }
  if (cleared.length > 0) {
    const { error } = await supabase.from(EXAM_WINDOWS_TABLE).delete().eq('school_id', access.schoolId).eq('term_id', termId).in('grade_id', cleared);
    if (error) return failed;
  }

  return NextResponse.json({ data: await readExamWindows(supabase, access.schoolId, termId) });
}

export async function POST(request: NextRequest) {
  const access = await staffAccess();
  if (access instanceof NextResponse) return access;

  const body = (await request.json().catch(() => null)) as { termId?: unknown; gradeIds?: unknown } | null;
  const termId = typeof body?.termId === 'string' && isUuid(body.termId) ? body.termId : null;
  const gradeIds = parseGradeIds(body?.gradeIds);
  if (!termId || !gradeIds) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  if (!(await schoolTerm(supabase, access.schoolId, termId))) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

  // Only classes the teacher has exams in this term.
  const { data: exams, error: examsError } = await supabase
    .from('exams')
    .select('id, grade_id, grade_stream_id, subject_id, created_by_teacher_id')
    .eq('school_id', access.schoolId)
    .eq('term_id', termId)
    .in('grade_id', gradeIds);
  if (examsError) return NextResponse.json({ error: 'Could not check your classes' }, { status: 500 });
  let allowed = new Set((exams ?? []).map(e => e.grade_id as string));
  if (access.role !== 'ADMIN') {
    const { getTeacherPermissions, isExamVisibleToTeacher } = await import('@/lib/teacher-utils');
    const perms = await getTeacherPermissions(access.userId);
    allowed = new Set((exams ?? []).filter(e => isExamVisibleToTeacher(e, perms, access.userId)).map(e => e.grade_id as string));
  }
  const rows = gradeIds.filter(id => allowed.has(id)).map(gradeId => ({ school_id: access.schoolId, term_id: termId, grade_id: gradeId, requested_by: access.userId }));
  if (rows.length === 0) return NextResponse.json({ error: 'You have no exams in those classes this term' }, { status: 403 });

  const { error } = await supabase.from(EXAM_REQUESTS_TABLE).upsert(rows, { onConflict: 'school_id,term_id,grade_id,requested_by', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Could not send your request' }, { status: 500 });
  return NextResponse.json({ requested: rows.map(r => r.grade_id) });
}
