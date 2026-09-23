// Server-side auth helpers using Clerk
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from './supabase-admin';
import type { UserRole } from '@/types';

export interface ServerSession {
  userId: string;
  schoolId: string | null;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Get the current user's session on the server side using Clerk.
 * Returns null if not authenticated.
 */
export async function getAuthSession(): Promise<ServerSession | null> {
  const clerkAuth = await auth();
  if (!clerkAuth.userId) return null;

  // Authorization is driven entirely by our own DB row — NEVER by Clerk
  // session claims, which are client-influenceable. A missing row is
  // unauthorized, full stop: this covers a brand-new user before the webhook
  // has synced them, and — critically — a deleted or deactivated account
  // whose Clerk session is still valid. Previously a null row skipped the
  // is_active guard and reconstructed role/school from the stale JWT claims,
  // handing a deleted admin a fully-authorized session until token expiry.
  const dbUser = await getUserDbRecord(clerkAuth.userId);
  if (!dbUser || dbUser.is_active === false || !dbUser.role) {
    return null;
  }

  return {
    userId: clerkAuth.userId,
    schoolId: dbUser.school_id || null,
    role: dbUser.role,
    email: dbUser.email || '',
    firstName: dbUser.first_name || '',
    lastName: dbUser.last_name || '',
  };
}

/**
 * Assert the current user is authenticated.
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

/** The school's current academic year: the one that started most recently. */
export async function getCurrentAcademicYearId(supabase: SupabaseClient, schoolId: string): Promise<string | null> {
  const { data } = await supabase
    .from('academic_years')
    .select('id')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Streams the user is class teacher of this academic year. Falls back to every
 * assignment when the school has no academic year yet, matching
 * getTeacherPermissions.
 */
export async function getClassTeacherStreamIds(
  supabase: SupabaseClient,
  userId: string,
  schoolId: string,
): Promise<string[]> {
  const currentYearId = await getCurrentAcademicYearId(supabase, schoolId);
  let query = supabase
    .from('class_teachers')
    .select('current_grade_stream_id')
    .eq('user_id', userId);
  if (currentYearId) query = query.eq('academic_year_id', currentYearId);
  const { data } = await query;
  return (data ?? [])
    .map(row => row.current_grade_stream_id as string | null)
    .filter((id): id is string => !!id);
}

export interface Caller {
  userId: string;
  schoolId: string | null;
  /** The role stored on the account. */
  baseRole: UserRole;
  /**
   * The role to authorize with. A subject teacher who also holds a class is
   * authorized as that class's teacher — the same upgrade the role switcher
   * offers in the UI, which API routes previously ignored, so a switched
   * teacher saw class-teacher pages whose every request was refused.
   */
  role: UserRole;
  /** Streams the caller is class teacher of this year (empty for everyone else). */
  classStreamIds: string[];
}

/**
 * The signed-in, active user making this request, or null. Every role check in
 * an API route should read `role` from here rather than from `users.role`.
 */
export async function getCaller(): Promise<Caller | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const dbUser = await getUserDbRecord(userId);
  if (!dbUser || dbUser.is_active === false || !dbUser.role) return null;

  const baseRole = dbUser.role as UserRole;
  const schoolId = (dbUser.school_id as string | null) ?? null;
  const isTeacher = baseRole === 'CLASS_TEACHER' || baseRole === 'SUBJECT_TEACHER';
  const classStreamIds = isTeacher && schoolId
    ? await getClassTeacherStreamIds(createSupabaseAdmin(), userId, schoolId)
    : [];
  const role: UserRole = baseRole === 'SUBJECT_TEACHER' && classStreamIds.length > 0 ? 'CLASS_TEACHER' : baseRole;

  return { userId, schoolId, baseRole, role, classStreamIds };
}

/** Admins run every class; a class teacher runs only their own. */
export function canManageStream(caller: Caller, streamId: string | null | undefined): boolean {
  if (caller.role === 'ADMIN') return true;
  return caller.role === 'CLASS_TEACHER' && !!streamId && caller.classStreamIds.includes(streamId);
}

/**
 * Whether the caller may manage this student's records (profile, fees,
 * attendance): any admin, or the teacher of the student's class. Callers must
 * already have checked the student belongs to their school.
 */
export async function canManageStudent(caller: Caller, studentId: string): Promise<boolean> {
  if (caller.role === 'ADMIN') return true;
  if (caller.role !== 'CLASS_TEACHER') return false;
  const { data } = await createSupabaseAdmin()
    .from('students')
    .select('current_grade_stream_id')
    .eq('id', studentId)
    .maybeSingle();
  return canManageStream(caller, data?.current_grade_stream_id as string | null | undefined);
}

/** Like canManageStudent, but a student may also read their own records. */
export async function canViewStudentRecords(caller: Caller, studentId: string): Promise<boolean> {
  if (caller.role === 'STUDENT') return caller.userId === studentId;
  return canManageStudent(caller, studentId);
}

/** JSON error response for a caller who is signed out, inactive or not allowed. */
export function forbidden(message = 'Forbidden', status: 401 | 403 = 403): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Look up a user's role and school_id from the database by their Clerk user ID.
 * Used to sync Clerk session claims with DB data.
 */
export async function getUserDbRecord(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, role, school_id, first_name, last_name, email, is_active')
    .eq('id', clerkUserId)
    .single();

  if (error || !data) return null;
  return data;
}
