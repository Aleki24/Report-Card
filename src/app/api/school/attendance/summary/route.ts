import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { canManageStream, getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { embedOne, fetchAllRows, isUuid } from '@/lib/postgrest';
import { isIsoDate, schoolToday } from '@/lib/dates';
import {
  ATTENDANCE_LABELS, ATTENDANCE_SUMMARY_MAX_DAYS, attendanceRate, countAttendance, isAttendanceStatus,
  type AttendanceLearnerSummary, type AttendanceStatus, type AttendanceSummaryResponse,
} from '@/lib/attendance';

export const runtime = 'nodejs';

interface StudentRow {
  id: string;
  admission_number: string | null;
  users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

/**
 * GET ?stream_id=&from=&to=&format=xlsx — one class over a period (default:
 * this month so far): each learner's mark on every day the register was
 * taken, and how often they came. For the class's teacher and admins.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller || !caller.schoolId || (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const schoolId = caller.schoolId;
    const params = new URL(request.url).searchParams;
    const streamId = params.get('stream_id');
    const today = schoolToday();
    const from = params.get('from') || `${today.slice(0, 8)}01`;
    const to = params.get('to') || today;
    if (!streamId || !isUuid(streamId)) return NextResponse.json({ error: 'Choose a class.' }, { status: 400 });
    if (!isIsoDate(from) || !isIsoDate(to) || from > to) return NextResponse.json({ error: 'Pick a start date on or before the end date.' }, { status: 400 });
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > ATTENDANCE_SUMMARY_MAX_DAYS) {
      return NextResponse.json({ error: `Pick at most ${ATTENDANCE_SUMMARY_MAX_DAYS} days.` }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: stream } = await supabase.from('grade_streams').select('id, full_name').eq('id', streamId).eq('school_id', schoolId).maybeSingle();
    if (!stream) return NextResponse.json({ error: 'That class is not in your school.' }, { status: 404 });
    if (!canManageStream(caller, streamId)) return NextResponse.json({ error: 'You can only see attendance for your own class.' }, { status: 403 });

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, admission_number, users!inner(first_name, last_name, school_id)')
      .eq('current_grade_stream_id', streamId)
      .eq('users.school_id', schoolId)
      .eq('status', 'ACTIVE')
      .returns<StudentRow[]>();
    if (studentsError) return internalError('attendance summary learners', studentsError);
    const rows = students ?? [];

    const ids = rows.map(s => s.id);
    const marks: { student_id: string; date: string; status: string }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      const { rows: page, error } = await fetchAllRows<{ student_id: string; date: string; status: string }>(() => supabase
        .from('daily_attendance')
        .select('student_id, date, status')
        .eq('school_id', schoolId)
        .in('student_id', chunk)
        .gte('date', from)
        .lte('date', to)
        .order('id'));
      if (error) return internalError('attendance summary marks', error);
      marks.push(...page);
    }

    const byLearner = new Map<string, Record<string, AttendanceStatus>>();
    const days = new Set<string>();
    for (const m of marks) {
      if (!isAttendanceStatus(m.status)) continue;
      days.add(m.date);
      const record = byLearner.get(m.student_id) ?? {};
      record[m.date] = m.status;
      byLearner.set(m.student_id, record);
    }
    const dayList = [...days].sort();

    const learners: AttendanceLearnerSummary[] = rows.map(s => {
      const user = embedOne(s.users);
      const record = byLearner.get(s.id) ?? {};
      // Over the days the register was taken: a day the class was marked but this learner wasn't counts as unmarked.
      const counts = countAttendance(dayList.map(d => record[d] ?? null));
      return {
        id: s.id,
        name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Unnamed student',
        admission_number: s.admission_number ?? '',
        days: record,
        counts,
        rate: attendanceRate(counts),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const classCounts = countAttendance(learners.flatMap(l => dayList.map(d => l.days[d] ?? null)));

    if (params.get('format') === 'xlsx') {
      const letter: Record<AttendanceStatus, string> = { present: 'P', absent: 'A', late: 'L', excused: 'E' };
      const sheet = XLSX.utils.json_to_sheet(learners.map(l => ({
        'Learner': l.name,
        'Adm. no.': l.admission_number,
        ...Object.fromEntries(dayList.map(d => [d.slice(5), l.days[d] ? letter[l.days[d]] : ''])),
        [ATTENDANCE_LABELS.present]: l.counts.present,
        [ATTENDANCE_LABELS.late]: l.counts.late,
        [ATTENDANCE_LABELS.excused]: l.counts.excused,
        [ATTENDANCE_LABELS.absent]: l.counts.absent,
        'Attendance %': l.rate ?? '',
      })));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Attendance');
      const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const name = String(stream.full_name).replace(/[^\w-]+/g, '_');
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Attendance_${name}_${from}_to_${to}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ from, to, days: dayList, learners, rate: attendanceRate(classCounts) } satisfies AttendanceSummaryResponse);
  } catch (err: unknown) {
    return internalError('attendance summary', err);
  }
}
