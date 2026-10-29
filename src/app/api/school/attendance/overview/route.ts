import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { fetchAllRows } from '@/lib/postgrest';
import { isIsoDate, latestDateAnywhere, schoolToday } from '@/lib/dates';
import {
  addCounts, attendanceRate, countAttendance, isAttendanceStatus,
  type AttendanceClassDay, type AttendanceOverviewResponse, type AttendanceStatus,
} from '@/lib/attendance';

/**
 * GET ?date= (default today) — every class whose register the caller keeps
 * (all of them for an admin, their own for a class teacher): whether the
 * register was taken that day and how it went.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller || !caller.schoolId || (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const schoolId = caller.schoolId;
    const date = new URL(request.url).searchParams.get('date') || schoolToday();
    if (!isIsoDate(date) || date > latestDateAnywhere()) return NextResponse.json({ error: 'Pick a valid day.' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    let streamsQuery = supabase.from('grade_streams').select('id, full_name').eq('school_id', schoolId);
    if (caller.role !== 'ADMIN') streamsQuery = streamsQuery.in('id', caller.classStreamIds.length > 0 ? caller.classStreamIds : ['00000000-0000-0000-0000-000000000000']);
    const [streamsRes, studentsRes, marksRes] = await Promise.all([
      streamsQuery,
      fetchAllRows<{ id: string; current_grade_stream_id: string | null }>(() => supabase
        .from('students')
        .select('id, current_grade_stream_id, users!inner(school_id)')
        .eq('users.school_id', schoolId)
        .eq('status', 'ACTIVE')
        .not('current_grade_stream_id', 'is', null)
        .order('id')),
      fetchAllRows<{ student_id: string; status: string }>(() => supabase
        .from('daily_attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('date', date)
        .order('id')),
    ]);
    if (streamsRes.error) return internalError('attendance overview classes', streamsRes.error);
    if (studentsRes.error) return internalError('attendance overview learners', studentsRes.error);
    if (marksRes.error) return internalError('attendance overview marks', marksRes.error);

    const mark = new Map<string, AttendanceStatus>();
    for (const m of marksRes.rows) if (isAttendanceStatus(m.status)) mark.set(m.student_id, m.status);
    const byStream = new Map<string, (AttendanceStatus | null)[]>();
    for (const s of studentsRes.rows) {
      if (!s.current_grade_stream_id) continue;
      const list = byStream.get(s.current_grade_stream_id) ?? [];
      list.push(mark.get(s.id) ?? null);
      byStream.set(s.current_grade_stream_id, list);
    }

    const classes: AttendanceClassDay[] = (streamsRes.data ?? [])
      .map(s => {
        const counts = countAttendance(byStream.get(s.id as string) ?? []);
        return { streamId: s.id as string, name: s.full_name as string, counts, rate: attendanceRate(counts) };
      })
      .filter(c => c.counts.total > 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const totals = classes.reduce((sum, c) => addCounts(sum, c.counts), countAttendance([]));

    return NextResponse.json({ date, classes, totals } satisfies AttendanceOverviewResponse);
  } catch (err: unknown) {
    return internalError('attendance overview', err);
  }
}
