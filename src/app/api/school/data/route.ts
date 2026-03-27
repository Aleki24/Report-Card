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
import { getTeacherPermissions, isStudentVisibleToTeacher, isStreamVisibleToTeacher, isExamVisibleToTeacher } from '@/lib/teacher-utils';

type DataType =
  | 'students'
  | 'grade_streams'
  | 'academic_years'
  | 'terms'
  | 'users'
  | 'pending_invites'
  | 'school_profile'
  | 'grading_scales'
  | 'exams'
  | 'my_subjects'
  | 'class_teacher_assignments';

async function getSessionSchoolId(): Promise<{ schoolId: string; userId: string; role: string } | null> {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return null;
  
  const supabaseAdmin = createSupabaseAdmin();
  const { data } = await supabaseAdmin.from('users').select('school_id').eq('id', session.user.id).single();

  return {
    schoolId: (data?.school_id || session.user.schoolId) as string,
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
            guardian_phone, guardian_name,
            users!inner (first_name, last_name, email, school_id),
            grade_streams (full_name, grade_id)
          `)
          .eq('users.school_id', schoolId)
          .order('admission_number');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        let filteredStudents = data ?? [];
        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          filteredStudents = filteredStudents.filter(student => isStudentVisibleToTeacher(student, perms));
        }
        
        return NextResponse.json({ data: filteredStudents });
      }

      case 'grade_streams': {
        const { data, error } = await supabase
          .from('grade_streams')
          .select('id, name, full_name, grade_id, school_id, grades ( academic_level_id, name_display )')
          .eq('school_id', schoolId)
          .order('full_name');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        let filteredStreams = data || [];

        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          filteredStreams = filteredStreams.filter(stream => isStreamVisibleToTeacher(stream, perms));
        }

        return NextResponse.json({ data: filteredStreams });
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
          .select('id, first_name, last_name, email, username, phone, role, is_active, created_at, school_id, plain_password')
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
          .select('id, name, max_score, academic_year_id, term_id, status, created_at, grade_stream_id, grade_id, subject_id')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        let filteredExams = data ?? [];
        if (auth.role !== 'ADMIN') {
           const perms = await getTeacherPermissions(auth.userId);
           filteredExams = filteredExams.filter(exam => isExamVisibleToTeacher(exam, perms));
        }
        
        return NextResponse.json({ data: filteredExams });
      }

      case 'my_subjects': {
        // Returns subjects assigned to the current user (for subject teachers)
        const perms = await getTeacherPermissions(auth.userId);
        
        if (!perms.isSubjectTeacher) {
          return NextResponse.json({ data: [] });
        }

        // Get subject IDs from assignments
        const subjectIds = [...new Set(perms.subjectTeacherAssignments.map(a => a.subject_id))];
        if (subjectIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        const { data, error } = await supabase
          .from('subjects')
          .select('id, code, name, academic_level_id, category, is_compulsory, display_order')
          .in('id', subjectIds)
          .order('display_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'class_teacher_assignments': {
        // Get all class teacher assignments for the school (for filtering users)
        const { data: classTeachers, error } = await supabase
          .from('class_teachers')
          .select('user_id, current_grade_stream_id, academic_year_id, grade_streams(full_name)')
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        // Get current academic year to filter
        const { data: currentYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false })
          .limit(1)
          .single();
        
        // Filter to only current year assignments
        const filtered = currentYear 
          ? (classTeachers ?? []).filter(ct => ct.academic_year_id === currentYear.id)
          : classTeachers ?? [];
        
        return NextResponse.json({ data: filtered });
      }

      default:
        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}