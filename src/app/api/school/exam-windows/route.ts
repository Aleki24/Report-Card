import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/postgrest';
import { isAnytimeExamType, isValidExamType } from '@/lib/exam-types';
import { EXAM_WINDOWS_TABLE, readExamWindows } from '@/lib/exam-windows';

/**
 * GET ?term_id=  — the exam each class is marking now (any signed-in staff).
 * PUT { termId, entries: [{ gradeId, examType | null }] } — admin sets or
 * clears it; null clears.
 */

interface PutBody {
  termId?: unknown;
  entries?: unknown;
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

/** The term, if it belongs to the caller's school. */
async function termOfSchool(termId: string, schoolId: string): Promise<boolean> {
  const { data } = await createSupabaseAdmin().from('terms').select('id').eq('id', termId).eq('school_id', schoolId).maybeSingle();
  return !!data;
}

export async function GET(request: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.schoolId) return NextResponse.json({ data: [] });
  if (caller.role === 'STUDENT' || caller.role === 'PARENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const termId = new URL(request.url).searchParams.get('term_id') ?? '';
  if (!isUuid(termId)) return NextResponse.json({ error: 'Invalid term id' }, { status: 400 });

  try {
    return NextResponse.json({ data: await readExamWindows(createSupabaseAdmin(), caller.schoolId, termId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load open exams' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'ADMIN' || !caller.schoolId) return NextResponse.json({ error: 'Only admins choose the exam being marked' }, { status: 403 });
  const schoolId = caller.schoolId;

  const body = (await request.json().catch(() => null)) as PutBody | null;
  const termId = typeof body?.termId === 'string' ? body.termId : '';
  const entries = parseEntries(body?.entries);
  if (!isUuid(termId) || !entries) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  if (!(await termOfSchool(termId, schoolId))) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

  const supabase = createSupabaseAdmin();
  const set = entries.filter((e): e is Entry & { examType: string } => e.examType !== null);
  const cleared = entries.filter(e => e.examType === null).map(e => e.gradeId);

  if (set.length > 0) {
    const { error } = await supabase.from(EXAM_WINDOWS_TABLE).upsert(
      set.map(e => ({ school_id: schoolId, term_id: termId, grade_id: e.gradeId, exam_type: e.examType, set_by: caller.userId, updated_at: new Date().toISOString() })),
      { onConflict: 'school_id,term_id,grade_id' },
    );
    if (error) return NextResponse.json({ error: 'Could not save the open exam' }, { status: 500 });
  }
  if (cleared.length > 0) {
    const { error } = await supabase.from(EXAM_WINDOWS_TABLE).delete().eq('school_id', schoolId).eq('term_id', termId).in('grade_id', cleared);
    if (error) return NextResponse.json({ error: 'Could not save the open exam' }, { status: 500 });
  }

  return NextResponse.json({ data: await readExamWindows(supabase, schoolId, termId) });
}
