import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';

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

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['ADMIN', 'CLASS_TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { schoolId, userId } = auth;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    const body = await request.json();
    const { date, stream_id } = body;

    if (!date || !stream_id) {
      return NextResponse.json({ error: 'date and stream_id are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify stream belongs to this school
    const { data: stream } = await supabase
      .from('grade_streams')
      .select('id, school_id')
      .eq('id', stream_id)
      .maybeSingle();

    if (!stream || stream.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid stream for your school' }, { status: 403 });
    }

    // Students in this stream, school-scoped
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, guardian_phone, users!inner(first_name, last_name, school_id)')
      .eq('current_grade_stream_id', stream_id)
      .eq('users.school_id', schoolId)
      .eq('status', 'ACTIVE');

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 400 });
    }

    const studentIds = (students || []).map((s: any) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, alreadyNotified: 0 });
    }

    // Absent students for this date
    const { data: absentRecords, error: attError } = await supabase
      .from('daily_attendance')
      .select('student_id')
      .eq('date', date)
      .eq('school_id', schoolId)
      .eq('status', 'absent')
      .in('student_id', studentIds);

    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 400 });
    }

    const absentIds = (absentRecords || []).map((r: any) => r.student_id);
    if (absentIds.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, alreadyNotified: 0 });
    }

    // Don't re-notify guardians who were already sent a message for this date
    const { data: existing } = await supabase
      .from('attendance_notifications')
      .select('student_id')
      .eq('date', date)
      .eq('status', 'sent')
      .in('student_id', absentIds);

    const alreadyNotifiedIds = new Set((existing || []).map((r: any) => r.student_id));
    const toNotify = absentIds.filter((id: string) => !alreadyNotifiedIds.has(id));

    if (toNotify.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, skipped: 0, alreadyNotified: alreadyNotifiedIds.size });
    }

    const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
    const schoolName = school?.name || 'School';

    const studentById = new Map((students || []).map((s: any) => [s.id, s]));
    const logRows: Record<string, unknown>[] = [];
    let skipped = 0;

    const toSend: { studentId: string; phone: string; message: string }[] = [];
    for (const studentId of toNotify) {
      const student = studentById.get(studentId);
      const phone = student?.guardian_phone;

      if (!phone) {
        skipped++;
        logRows.push({ student_id: studentId, school_id: schoolId, date, channel: 'sms', status: 'skipped', error: 'No guardian phone', sent_by: userId });
        continue;
      }

      const studentName = `${student?.users?.first_name || ''} ${student?.users?.last_name || ''}`.trim();
      const message = `${schoolName}: ${studentName} was marked ABSENT today (${date}). Contact the school office if this is a mistake.`;
      toSend.push({ studentId, phone, message });
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
      await supabase.from('attendance_notifications').insert(logRows);
    }

    return NextResponse.json({ sent, failed, skipped, alreadyNotified: alreadyNotifiedIds.size });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
