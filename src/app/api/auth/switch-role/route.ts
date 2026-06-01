import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = await request.json();
    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    const validRoles = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify the user exists and the role matches what's in the database
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, role, school_id')
      .eq('id', userId)
      .single();

    if (error || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only allow switching to the user's actual database role
    // (In the future, you could support multiple roles per user)
    if (dbUser.role !== role) {
      return NextResponse.json(
        { error: 'You do not have permission to switch to this role' },
        { status: 403 }
      );
    }

    // Sync role to Clerk publicMetadata so session claims are updated
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey) {
      await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_metadata: {
            role: dbUser.role,
            schoolId: dbUser.school_id,
          },
        }),
      });
    }

    return NextResponse.json({ success: true, role: dbUser.role });
  } catch (err: unknown) {
    console.error('[switch-role] Error:', err);
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
