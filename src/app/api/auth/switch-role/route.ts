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

    // Get the user's BASE role from the database (never mutated by switching)
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role, school_id')
      .eq('id', userId)
      .maybeSingle();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const baseRole = dbUser.role;

    // Only CLASS_TEACHER and SUBJECT_TEACHER can switch roles
    if (baseRole !== 'CLASS_TEACHER' && baseRole !== 'SUBJECT_TEACHER') {
      return NextResponse.json({ error: 'Only teachers with dual roles can switch roles' }, { status: 403 });
    }

    // Verify permission to switch to the requested role
    let isAllowed = false;

    if (role === baseRole) {
      // Always allowed to go back to base role
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

    // DO NOT modify the users table — the base role stays as-is.
    // Only update Clerk publicMetadata with an active_role field.
    const { createClerkClient } = await import('@clerk/nextjs/server');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    
    // If switching back to base role, clear active_role so it falls back naturally
    const activeRole = role === baseRole ? null : role;
    
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        role: baseRole, // Keep base role synced
        active_role: activeRole,
        school_id: dbUser.school_id,
      },
    });

    return NextResponse.json({ success: true, role, baseRole, activeRole });
  } catch (err: unknown) {
    console.error('[switch-role] Error:', err);
    return NextResponse.json({ error: 'Failed to switch role. Please try again.' }, { status: 500 });
  }
}
