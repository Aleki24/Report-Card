import { NextResponse } from 'next/server';
import { getCaller, getCurrentAcademicYearId } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { classUsage } from '@/lib/class-usage';
import { embedOne } from '@/lib/postgrest';
import { isOfferedGrade, type ClassesOverview, type GradeOption } from '@/lib/classes-overview';

/**
 * Every class in the school with what it holds (students, exams, report
 * cards) and who its class teacher is, plus the grades and curricula the
 * admin can add classes to. Admin-only.
 */
export async function GET() {
  try {
    const caller = await getCaller();
    if (!caller || caller.role !== 'ADMIN' || !caller.schoolId) {
      return NextResponse.json({ error: 'Only admins can manage classes.' }, { status: 403 });
    }
    const supabase = createSupabaseAdmin();

    const [levelsRes, gradesRes, streamsRes] = await Promise.all([
      supabase.from('academic_levels').select('id, code, name').order('code'),
      supabase.from('grades').select('id, name_display, numeric_order, academic_level_id').order('numeric_order'),
      supabase.from('grade_streams').select('id, grade_id, name, full_name').eq('school_id', caller.schoolId).order('name'),
    ]);
    const failed = levelsRes.error ?? gradesRes.error ?? streamsRes.error;
    if (failed) return internalError('classes GET', failed);

    const streams = streamsRes.data ?? [];
    const ids = streams.map(s => s.id);
    // This year's class teachers, as everywhere else that reads them.
    const currentYearId = await getCurrentAcademicYearId(supabase, caller.schoolId);
    const teachersQuery = () => {
      let q = supabase.from('class_teachers').select('current_grade_stream_id, users ( first_name, last_name )').in('current_grade_stream_id', ids);
      if (currentYearId) q = q.eq('academic_year_id', currentYearId);
      return q;
    };
    const [usage, teachersRes] = await Promise.all([
      classUsage(supabase, ids),
      ids.length ? teachersQuery() : Promise.resolve({ data: [], error: null }),
    ]);
    if (teachersRes.error) return internalError('classes GET teachers', teachersRes.error);

    const teachersByClass = new Map<string, string[]>();
    for (const row of teachersRes.data ?? []) {
      const u = embedOne(row.users as { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null);
      const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
      if (!name) continue;
      const list = teachersByClass.get(row.current_grade_stream_id) ?? [];
      list.push(name);
      teachersByClass.set(row.current_grade_stream_id, list);
    }

    const body: ClassesOverview = {
      curricula: levelsRes.data ?? [],
      grades: ((gradesRes.data ?? []) as GradeOption[]).filter(g => isOfferedGrade(g.name_display)),
      classes: streams.map(s => ({
        id: s.id,
        grade_id: s.grade_id,
        name: s.name,
        full_name: s.full_name,
        class_teachers: teachersByClass.get(s.id) ?? [],
        usage: usage.get(s.id)!,
      })),
    };
    return NextResponse.json(body);
  } catch (err) {
    return internalError('classes GET', err);
  }
}
