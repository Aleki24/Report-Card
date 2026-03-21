// src/lib/supabase-server.ts
// ============================================================
// SERVER-SIDE SUPABASE CLIENT — school-scoped data fetching
//
// WHY THIS EXISTS:
// Your app uses NextAuth JWT (not Supabase Auth). This means
// the Supabase anon client has NO idea who is logged in, so
// RLS policies that call auth.uid() return NULL on browser
// queries — bypassing all school isolation.
//
// SOLUTION: All queries that need school isolation must go
// through server-side API routes using the admin client +
// manual school_id filtering from the NextAuth session.
// ============================================================

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { Session } from 'next-auth';

export interface ServerSession {
  userId: string;
  schoolId: string | null;
  role: string;
  email: string;
}

/**
 * Get the current user's session on the server side.
 * Returns null if not authenticated.
 */
export async function getAuthSession(): Promise<ServerSession | null> {
  const session = await getServerSession(authOptions) as Session & {
    user: {
      id: string;
      schoolId: string | null;
      role: string;
      email: string;
    }
  } | null;

  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    schoolId: session.user.schoolId ?? null,
    role: session.user.role,
    email: session.user.email ?? '',
  };
}

/**
 * Assert the current user is authenticated and return their session.
 * Throws a Response with 401 if not authenticated.
 */
export async function requireAuth(): Promise<ServerSession> {
  const session = await getAuthSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return session;
}

/**
 * Assert the current user is an ADMIN with a school.
 * Throws a Response with 403 if not authorized.
 */
export async function requireAdmin(): Promise<ServerSession & { schoolId: string }> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN') {
    throw new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), { status: 403 });
  }
  if (!session.schoolId) {
    throw new Response(JSON.stringify({ error: 'No school associated with your account' }), { status: 403 });
  }
  return session as ServerSession & { schoolId: string };
}

/**
 * Fetch students scoped to the current user's school.
 * Always use this instead of querying students directly from the browser.
 */
export async function getSchoolStudents(schoolId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('students')
    .select(`
      id, admission_number, status, academic_level_id, current_grade_stream_id,
      users!inner (first_name, last_name, email, school_id),
      grade_streams (full_name)
    `)
    .eq('users.school_id', schoolId)
    .order('admission_number');

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch grade streams scoped to the current school.
 */
export async function getSchoolGradeStreams(schoolId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('grade_streams')
    .select('id, name, full_name, grade_id, school_id')
    .eq('school_id', schoolId)
    .order('full_name');

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch academic years scoped to the current school.
 */
export async function getSchoolAcademicYears(schoolId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch terms scoped to the current school.
 */
export async function getSchoolTerms(schoolId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('terms')
    .select('id, name, academic_year_id, start_date, end_date, is_current, school_id')
    .eq('school_id', schoolId)
    .order('start_date');

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch exam marks scoped to the current school.
 * Ensures marks belong to students in this school.
 */
export async function getSchoolExamMarks(schoolId: string, examId: string) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('exam_marks')
    .select(`
      id, student_id, raw_score, percentage, grade_symbol, remarks,
      students!inner (
        admission_number,
        users!inner (first_name, last_name, school_id)
      )
    `)
    .eq('exam_id', examId)
    .eq('students.users.school_id', schoolId);

  if (error) throw error;
  return data ?? [];
}