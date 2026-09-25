/**
 * What hangs off a class (grade stream), for the Classes page and for
 * refusing deletes that would destroy history.
 *
 * Deleting a class cascades to its exams, and from them to every mark, so a
 * class that has ever been examined must never be deleted. Students and
 * report cards reference it with ON DELETE RESTRICT, which only produced a
 * raw foreign-key error. Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './postgrest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

import type { ClassUsage } from './classes-overview';

export { classDeleteBlocker } from './classes-overview';

const EMPTY: ClassUsage = { students: 0, activeStudents: 0, exams: 0, reportCards: 0 };

/** Usage per class id; every requested id is present. */
export async function classUsage(supabase: Db, streamIds: readonly string[]): Promise<Map<string, ClassUsage>> {
  const usage = new Map(streamIds.map(id => [id, { ...EMPTY }]));
  if (streamIds.length === 0) return usage;
  const ids = [...streamIds];

  const [students, exams, reports] = await Promise.all([
    fetchAllRows<{ id: string; current_grade_stream_id: string; status: string }>(() =>
      supabase.from('students').select('id, current_grade_stream_id, status').in('current_grade_stream_id', ids).order('id')),
    fetchAllRows<{ id: string; grade_stream_id: string }>(() =>
      supabase.from('exams').select('id, grade_stream_id').in('grade_stream_id', ids).order('id')),
    fetchAllRows<{ id: string; grade_stream_id: string }>(() =>
      supabase.from('report_cards').select('id, grade_stream_id').in('grade_stream_id', ids).order('id')),
  ]);
  const failed = students.error ?? exams.error ?? reports.error;
  if (failed) throw failed;

  for (const s of students.rows) {
    const u = usage.get(s.current_grade_stream_id);
    if (!u) continue;
    u.students++;
    if (s.status === 'ACTIVE') u.activeStudents++;
  }
  for (const e of exams.rows) {
    const u = usage.get(e.grade_stream_id);
    if (u) u.exams++;
  }
  for (const r of reports.rows) {
    const u = usage.get(r.grade_stream_id);
    if (u) u.reportCards++;
  }
  return usage;
}
