// src/app/api/school/data/route.ts
// ============================================================
// SCHOOL-SCOPED DATA API
//
// Replaces all direct browser Supabase queries for school data.
// Reads the NextAuth session server-side to get the real schoolId,
// then uses the admin client with explicit school_id filters.
//
// Frontend components should call: GET /api/school/data?type=students
// instead of querying Supabase directly from the browser.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

type DataType =
  | 'students'
  | 'grade_streams'
  | 'academic_years'
  | 'terms'
  | 'users'
  | 'pending_invites'
  | 'school_profile'
  | 'grading_scales'
  | 'exams';

async function getSessionSchoolId(): Promise<{ schoolId: string; userId: string; role: string } | null> {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return null;
  return {
    schoolId: session.user.schoolId,
    userId: session.user.id,
    role: session.user.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionSchoolId();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as DataType;
    const schoolId = auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with your account' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (type) {
      case 'students': {
        const { data, error } = await supabase
          .from('students')
          .select(`
            id, admission_number, status, academic_level_id, current_grade_stream_id,
            users!inner (first_name, last_name, email, school_id),
            grade_streams (full_name)
          `)
          .eq('users.school_id', schoolId)
          .order('admission_number');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'grade_streams': {
        const { data, error } = await supabase
          .from('grade_streams')
          .select('id, name, full_name, grade_id, school_id, grades ( academic_level_id )')
          .eq('school_id', schoolId)
          .order('full_name');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'academic_years': {
        const { data, error } = await supabase
          .from('academic_years')
          .select('id, name, start_date, end_date')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'terms': {
        const { data, error } = await supabase
          .from('terms')
          .select('id, name, academic_year_id, start_date, end_date, is_current')
          .eq('school_id', schoolId)
          .order('start_date');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'users': {
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, phone, role, is_active, created_at, school_id')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'pending_invites': {
        if (auth.role !== 'ADMIN') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { data, error } = await supabase
          .from('pending_invites')
          .select('id, first_name, last_name, phone, role, invite_code, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'school_profile': {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, address, phone, email, logo_url')
          .eq('id', schoolId)
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data });
      }

      case 'grading_scales': {
        const { data: school } = await supabase
          .from('schools')
          .select('grading_system_cbc_id, grading_system_844_id')
          .eq('id', schoolId)
          .single();

        const systemIds = [];
        if (school?.grading_system_cbc_id) systemIds.push(school.grading_system_cbc_id);
        if (school?.grading_system_844_id) systemIds.push(school.grading_system_844_id);

        let query = supabase
          .from('grading_systems')
          .select(`
            id, name,
            grading_scales (id, symbol, min_percentage, max_percentage, points, label)
          `);
        
        if (systemIds.length > 0) {
          query = query.in('id', systemIds);
        }

        const { data, error } = await query;

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'exams': {
        const { data, error } = await supabase
          .from('exams')
          .select('id, name, max_score, academic_year_id, term_id, status, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      default:
        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}