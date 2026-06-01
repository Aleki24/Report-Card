// Server-side auth helpers using Clerk
import { auth, currentUser } from '@clerk/nextjs/server';
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

  const user = await currentUser();
  if (!user) return null;

  // Always look up role and schoolId from the database — never trust session claims alone
  const dbUser = await getUserDbRecord(clerkAuth.userId);
  const role = dbUser?.role || (clerkAuth.sessionClaims as any)?.role || null;
  const schoolId = dbUser?.school_id || (clerkAuth.sessionClaims as any)?.schoolId || null;

  if (!role) {
    // User exists in Clerk but not in our database yet (webhook may not have fired)
    return null;
  }

  return {
    userId: clerkAuth.userId,
    schoolId,
    role,
    email: user.emailAddresses[0]?.emailAddress || '',
    firstName: dbUser?.first_name || user.firstName || '',
    lastName: dbUser?.last_name || user.lastName || '',
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
