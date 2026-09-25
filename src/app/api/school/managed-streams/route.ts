import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { embedOne } from '@/lib/postgrest';
import type { ManagedStream } from '@/lib/managed-streams';

interface StreamRow {
  id: string;
  full_name: string;
  grade_id: string | null;
  grades: { numeric_order: number | null } | { numeric_order: number | null }[] | null;
}

/**
 * The classes the caller runs: every class for an admin, the teacher's own
 * class(es) for a class teacher. The general class list also holds classes a
 * teacher only teaches a subject in, whose register, report cards and mark
 * sheets the APIs refuse, so the pages that make those read this list.
 */
export async function GET() {
  try {
    const caller = await getCaller();
    if (!caller || !caller.schoolId || (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (caller.role !== 'ADMIN' && caller.classStreamIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    let query = createSupabaseAdmin()
      .from('grade_streams')
      .select('id, full_name, grade_id, grades ( numeric_order )')
      .eq('school_id', caller.schoolId);
    if (caller.role !== 'ADMIN') query = query.in('id', caller.classStreamIds);

    const { data, error } = await query;
    if (error) return internalError('managed streams', error);

    // Grade 9 before Grade 10: order by the grade's position, then by name.
    const rows = (data ?? []) as StreamRow[];
    const order = (row: StreamRow) => embedOne(row.grades)?.numeric_order ?? Number.MAX_SAFE_INTEGER;
    const streams: ManagedStream[] = rows
      .sort((a, b) => order(a) - order(b) || a.full_name.localeCompare(b.full_name, undefined, { numeric: true }))
      .map(({ id, full_name, grade_id }) => ({ id, full_name, grade_id }));

    return NextResponse.json({ data: streams });
  } catch (err: unknown) {
    return internalError('managed streams GET', err);
  }
}
