import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageStream, getCaller, type Caller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { embedOne } from '@/lib/postgrest';
import { isIsoDate, latestDateAnywhere, schoolToday } from '@/lib/dates';
import { ATTENDANCE_NOTE_MAX, ATTENDANCE_STATUSES, isAttendanceStatus, type AttendanceRosterEntry, type AttendanceStatus } from '@/lib/attendance';

/**
 * Registers are kept by admins and by each class's own teacher. Reading one
 * used to need nothing but a school — a student could pull any class's list —
 * and any teacher could mark any class.
 */
async function getSession(): Promise<(Caller & { schoolId: string }) | null> {
  const caller = await getCaller();
  if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') || !caller.schoolId) return null;
  return { ...caller, schoolId: caller.schoolId };
}

type Supabase = ReturnType<typeof createSupabaseAdmin>;

/** Null when the caller may keep this stream's register, else the refusal to send. */
async function streamAccessError(supabase: Supabase, caller: Caller & { schoolId: string }, streamId: string): Promise<NextResponse | null> {
  const { data: stream, error } = await supabase
    .from('grade_streams')
    .select('id')
    .eq('id', streamId)
    .eq('school_id', caller.schoolId)
    .maybeSingle();
  if (error) return internalError('attendance stream lookup', error);
  if (!stream) return NextResponse.json({ error: 'That class is not in your school.' }, { status: 404 });
  if (!canManageStream(caller, stream.id)) {
    return NextResponse.json({ error: 'You can only take attendance for your own class.' }, { status: 403 });
  }
  return null;
}

/** A date the register can hold: a real calendar day that has already started somewhere. */
function dateError(date: string): string | null {
  if (!isIsoDate(date)) return 'Pick a valid date.';
  if (date > latestDateAnywhere()) return 'Attendance cannot be recorded for a future date.';
  return null;
}

interface StudentRow {
  id: string;
  admission_number: string | null;
  users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || schoolToday();
    const streamId = searchParams.get('stream_id');
    if (!streamId) return NextResponse.json({ error: 'stream_id is required' }, { status: 400 });
    const badDate = dateError(date);
    if (badDate) return NextResponse.json({ error: badDate }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const denied = await streamAccessError(supabase, auth, streamId);
    if (denied) return denied;

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, admission_number, users!inner (first_name, last_name, school_id)')
      .eq('current_grade_stream_id', streamId)
      .eq('users.school_id', auth.schoolId)
      .eq('status', 'ACTIVE')
      .order('admission_number', { nullsFirst: false });
    if (studentsError) return internalError('attendance roster', studentsError);

    const rows = (students ?? []) as StudentRow[];
    const marks = new Map<string, { status: AttendanceStatus; notes: string | null }>();
    if (rows.length > 0) {
      const { data: records, error: recordsError } = await supabase
        .from('daily_attendance')
        .select('student_id, status, notes')
        .eq('date', date)
        .eq('school_id', auth.schoolId)
        .in('student_id', rows.map(s => s.id));
      if (recordsError) return internalError('attendance records', recordsError);
      for (const r of records ?? []) {
        if (isAttendanceStatus(r.status)) marks.set(r.student_id as string, { status: r.status, notes: (r.notes as string | null) ?? null });
      }
    }

    const data: AttendanceRosterEntry[] = rows.map(s => {
      const user = embedOne(s.users);
      return {
        id: s.id,
        name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Unnamed student',
        admission_number: s.admission_number ?? '',
        status: marks.get(s.id)?.status ?? null, // null = not yet marked
        notes: marks.get(s.id)?.notes ?? null,
      };
    });

    return NextResponse.json({ data, date });
  } catch (err: unknown) {
    return internalError('attendance GET', err);
  }
}

const saveSchema = z.object({
  date: z.string(),
  stream_id: z.string().uuid(),
  records: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(ATTENDANCE_STATUSES),
    notes: z.string().trim().max(ATTENDANCE_NOTE_MAX).nullish(),
  })).min(1, 'Mark at least one student.').max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    }
    const { date, stream_id, records } = parsed.data;
    const badDate = dateError(date);
    if (badDate) return NextResponse.json({ error: badDate }, { status: 400 });

    // One upsert cannot touch the same (student, date) row twice.
    const studentIds = records.map(r => r.student_id);
    if (new Set(studentIds).size !== studentIds.length) {
      return NextResponse.json({ error: 'Each student can appear only once.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const denied = await streamAccessError(supabase, auth, stream_id);
    if (denied) return denied;

    const { data: validStudents, error: validError } = await supabase
      .from('students')
      .select('id, users!inner(school_id)')
      .in('id', studentIds)
      .eq('current_grade_stream_id', stream_id)
      .eq('users.school_id', auth.schoolId);
    if (validError) return internalError('attendance student check', validError);

    const validIds = new Set((validStudents ?? []).map(s => s.id as string));
    if (studentIds.some(id => !validIds.has(id))) {
      return NextResponse.json({ error: 'Some students are no longer in this class. Reload the register and try again.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('daily_attendance')
      .upsert(records.map(r => ({
        student_id: r.student_id,
        date,
        status: r.status,
        notes: r.notes || null,
        marked_by: auth.userId,
        school_id: auth.schoolId,
        updated_at: now,
      })), { onConflict: 'student_id,date' });
    if (error) return internalError('attendance save', error);

    return NextResponse.json({ success: true, count: records.length });
  } catch (err: unknown) {
    return internalError('attendance POST', err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const date = searchParams.get('date');
    if (!studentId || !date) {
      return NextResponse.json({ error: 'student_id and date are required' }, { status: 400 });
    }
    if (!isIsoDate(date)) return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: student } = await supabase
      .from('students')
      .select('id, current_grade_stream_id, users!inner(school_id)')
      .eq('id', studentId)
      .eq('users.school_id', auth.schoolId)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: 'Student not found in your school' }, { status: 404 });
    }
    if (!canManageStream(auth, student.current_grade_stream_id as string | null)) {
      return NextResponse.json({ error: 'You can only change attendance for your own class.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('daily_attendance')
      .delete()
      .eq('student_id', studentId)
      .eq('date', date)
      .eq('school_id', auth.schoolId);
    if (error) return internalError('attendance delete', error);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return internalError('attendance DELETE', err);
  }
}
