import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const clerkAuth = await auth();
    if (!clerkAuth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const supabase = createSupabaseAdmin();

    let { data: dbUser } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, school_id, is_active')
      .eq('id', clerkAuth.userId)
      .maybeSingle();

    // Auto-create user if they exist in Clerk but not in Supabase
    // (e.g. webhook didn't fire or wasn't configured)
    if (!dbUser && user) {
      const email = user.emailAddresses?.[0]?.emailAddress || '';
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const metadata = (user.publicMetadata || {}) as Record<string, any>;
      const role = metadata.role || 'PENDING';
      let schoolId = metadata.school_id || metadata.schoolId || null;

      // Only auto-create a school if the user explicitly has ADMIN role in Clerk metadata
      if (metadata.role === 'ADMIN' && !schoolId) {
        const schoolIdNew = crypto.randomUUID();
        const { error: schoolErr } = await supabase.from('schools').insert({
          id: schoolIdNew,
          name: `${firstName || 'My'}'s School`,
        });
        if (!schoolErr) schoolId = schoolIdNew;
      }

      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({
          id: clerkAuth.userId,
          first_name: firstName,
          last_name: lastName,
          email,
          username: email.split('@')[0] || clerkAuth.userId,
          role,
          is_active: true,
          school_id: schoolId,
        })
        .select('id, first_name, last_name, email, role, school_id, is_active')
        .single();

      if (insertErr) {
        console.error('[/api/auth/me] Auto-create user error:', insertErr);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }

      // Sync role and school_id back to Clerk publicMetadata
      try {
        const { createClerkClient } = await import('@clerk/nextjs/server');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerk.users.updateUser(clerkAuth.userId, {
          publicMetadata: { role, school_id: schoolId },
        });
      } catch (metaErr) {
        console.error('[/api/auth/me] Failed to sync metadata:', metaErr);
      }

      dbUser = newUser;
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch school name and onboarding status
    let schoolName: string | null = null;
    let schoolOnboardingCompleted: boolean = false;
    if (dbUser.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('name, onboarding_completed')
        .eq('id', dbUser.school_id)
        .maybeSingle();
      schoolName = school?.name || null;
      schoolOnboardingCompleted = school?.onboarding_completed || false;
    }

    return NextResponse.json({
      profile: dbUser,
      user: dbUser, // backwards compatibility
      schoolName,
      schoolOnboardingCompleted,
      email: user?.emailAddresses[0]?.emailAddress || dbUser.email,
    });
  } catch (err: any) {
    console.error('[/api/auth/me] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
