import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canManageStream, getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';
import { internalError } from '@/lib/api-errors';
import { embedOne } from '@/lib/postgrest';
import type { NotifyResult } from '@/lib/attendance';
import { formatIsoDate, isIsoDate, latestDateAnywhere, schoolToday } from '@/lib/dates';

/**
 * Texts the guardians of students marked absent on a day. Registers are kept
 * by admins and by each class's own teacher, so only they may send these.
 */
async function getSession() {
  const caller = await getCaller();
  if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER')) return null;
  return caller;
}

const notifySchema = z.object({
  date: z.string().refine(isIsoDate, 'must be a YYYY-MM-DD date'),
  stream_id: z.string().uuid(),
});

interface StudentRow {
  id: string;
  guardian_phone: string | null;
  users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

interface NotificationLog {
  student_id: string;
  school_id: string;
  date: string;
  channel: 'sms';
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
  sent_by: string;
}

const NOTHING_TO_SEND: NotifyResult = { sent: 0, failed: 0, skipped: 0, alreadyNotified: 0 };

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { schoolId, userId } = auth;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const parsed = notifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
    }
    const { date, stream_id } = parsed.data;
    if (date > latestDateAnywhere()) {
      return NextResponse.json({ error: 'Guardians cannot be notified for a future date.' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: stream } = await supabase
      .from('grade_streams')
      .select('id')
      .eq('id', stream_id)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (!stream) {
      return NextResponse.json({ error: 'That class is not in your school.' }, { status: 404 });
    }
    if (!canManageStream(auth, stream.id)) {
      return NextResponse.json({ error: 'You can only notify guardians in your own class.' }, { status: 403 });
    }

    const { data: studentData, error: studentsError } = await supabase
      .from('students')
      .select('id, guardian_phone, users!inner(first_name, last_name, school_id)')
      .eq('current_grade_stream_id', stream_id)
      .eq('users.school_id', schoolId)
      .eq('status', 'ACTIVE');
    if (studentsError) return internalError('attendance notify students', studentsError);

    const students = (studentData ?? []) as StudentRow[];
    if (students.length === 0) return NextResponse.json(NOTHING_TO_SEND);

    const { data: absentRecords, error: attError } = await supabase
      .from('daily_attendance')
      .select('student_id')
      .eq('date', date)
      .eq('school_id', schoolId)
      .eq('status', 'absent')
      .in('student_id', students.map(s => s.id));
    if (attError) return internalError('attendance notify records', attError);

    const absentIds = (absentRecords ?? []).map(r => r.student_id as string);
    if (absentIds.length === 0) return NextResponse.json(NOTHING_TO_SEND);

    // Don't re-notify guardians who were already sent a message for this date.
    const { data: existing, error: existingError } = await supabase
      .from('attendance_notifications')
      .select('student_id')
      .eq('date', date)
      .eq('status', 'sent')
      .in('student_id', absentIds);
    // Without the log we can't tell who was already texted; sending anyway
    // could text a guardian twice, so stop.
    if (existingError) return internalError('attendance notify log read', existingError);

    const alreadyNotifiedIds = new Set((existing ?? []).map(r => r.student_id as string));
    const toNotify = absentIds.filter(id => !alreadyNotifiedIds.has(id));
    if (toNotify.length === 0) return NextResponse.json({ ...NOTHING_TO_SEND, alreadyNotified: alreadyNotifiedIds.size });

    const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
    const schoolName = (school?.name as string | undefined) || 'School';
    // "today" only when it is: guardians can be notified for an earlier day.
    const dayText = date === schoolToday() ? 'today' : `on ${formatIsoDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;

    const studentById = new Map(students.map(s => [s.id, s]));
    const logRows: NotificationLog[] = [];
    const toSend: { studentId: string; phone: string; message: string }[] = [];
    let skipped = 0;

    for (const studentId of toNotify) {
      const student = studentById.get(studentId);
      const phone = student?.guardian_phone?.trim();
      if (!phone) {
        skipped++;
        logRows.push({ student_id: studentId, school_id: schoolId, date, channel: 'sms', status: 'skipped', error: 'No guardian phone', sent_by: userId });
        continue;
      }
      const user = embedOne(student?.users);
      const studentName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Your child';
      toSend.push({
        studentId,
        phone,
        message: `${schoolName}: ${studentName} was marked ABSENT ${dayText}. Contact the school office if this is a mistake.`,
      });
    }

    let sent = 0;
    let failed = 0;
    if (toSend.length > 0) {
      const { results } = await sendBulkSMS(toSend.map(({ phone, message }) => ({ phone, message })));
      results.forEach((result, i) => {
        const { studentId } = toSend[i];
        if (result.success) {
          sent++;
          logRows.push({ student_id: studentId, school_id: schoolId, date, channel: 'sms', status: 'sent', sent_by: userId });
        } else {
          failed++;
          logRows.push({ student_id: studentId, school_id: schoolId, date, channel: 'sms', status: 'failed', error: result.error || 'Unknown error', sent_by: userId });
        }
      });
    }

    if (logRows.length > 0) {
      const { error: logError } = await supabase.from('attendance_notifications').insert(logRows);
      // The texts already went out; report them, but make the gap visible in
      // the logs since a missing "sent" row lets a later click re-send.
      if (logError) console.error('[attendance notify log write]', logError);
    }

    const result: NotifyResult = { sent, failed, skipped, alreadyNotified: alreadyNotifiedIds.size };
    return NextResponse.json(result);
  } catch (err: unknown) {
    return internalError('attendance notify', err);
  }
}
