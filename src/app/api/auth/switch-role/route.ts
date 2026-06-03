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
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role, school_id')
      .eq('id', userId)
      .maybeSingle();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify permission to switch to the requested role
    let isAllowed = false;
    if (dbUser.role === role) {
      isAllowed = true;
    } else if (dbUser.role === 'ADMIN') {
      // Admins are allowed to switch to any role for testing/viewing
      isAllowed = true;
    } else if (role === 'CLASS_TEACHER') {
      // Check if user has a class_teachers record
      const { data: ctRecord } = await supabase
        .from('class_teachers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (ctRecord) isAllowed = true;
    } else if (role === 'SUBJECT_TEACHER') {
      // Check if user has a subject_teachers record
      const { data: stRecord } = await supabase
        .from('subject_teachers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (stRecord) isAllowed = true;
    }

    if (!isAllowed) {
      return NextResponse.json({ error: 'You do not have permission to switch to this role' }, { status: 403 });
    }

    // Update the database role
    if (dbUser.role !== role) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);
      if (updateError) {
        throw new Error('Failed to update role in database: ' + updateError.message);
      }
    }

    // Sync role to Clerk publicMetadata so session claims are updated
    const { createClerkClient } = await import('@clerk/nextjs/server');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        role: role,
        school_id: dbUser.school_id,
      },
    });

    return NextResponse.json({ success: true, role });
  } catch (err: unknown) {
    console.error('[switch-role] Error:', err);
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
