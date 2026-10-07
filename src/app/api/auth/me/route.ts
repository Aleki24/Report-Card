import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveActiveRole } from '@/lib/roles';
import { getClassTeacherStreamIds } from '@/lib/auth-server';
import { getAccess } from '@/lib/platform/access';
import { provisionUserFromClerk } from '@/lib/provision-user';
import type { ClientAccess } from '@/lib/platform/client-access';

export async function GET() {
  try {
    const clerkAuth = await auth();
    if (!clerkAuth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const supabase = createSupabaseAdmin();

    const loadProfile = () => supabase
      .from('users')
      .select('id, first_name, last_name, email, role, school_id, is_active, job_title, avatar_url')
      .eq('id', clerkAuth.userId)
      .maybeSingle();

    let { data: dbUser } = await loadProfile();

    // Auto-create the profile if the account exists in Clerk but not in
    // Supabase (the webhook didn't fire, or the row went with a deleted school).
    if (!dbUser && user) {
      const { error: provisionErr } = await provisionUserFromClerk(supabase, {
        id: clerkAuth.userId,
        email: user.emailAddresses?.[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata ?? {},
      });

      if (provisionErr) {
        console.error('[/api/auth/me] Auto-create user error:', provisionErr);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }

      ({ data: dbUser } = await loadProfile());
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Enforce deactivation: an admin who marks a user Inactive should lock them out.
    // The client (AuthProvider) signs the user out when it sees this code.
    if (dbUser.is_active === false) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.', code: 'ACCOUNT_DEACTIVATED' },
        { status: 403 }
      );
    }

    // Fetch school name and onboarding status
    let schoolName: string | null = null;
    let schoolLogoUrl: string | null = null;
    let schoolOnboardingCompleted: boolean = false;
    let schoolApprovalStatus: string | null = null;
    if (dbUser.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, onboarding_completed, approval_status')
        .eq('id', dbUser.school_id)
        .maybeSingle();
      schoolName = school?.name || null;
      schoolLogoUrl = school?.logo_url || null;
      schoolOnboardingCompleted = school?.onboarding_completed || false;
      schoolApprovalStatus = school?.approval_status ?? null;
    }

    // A STUDENT account with no students row (e.g. a staff account switched to
    // Student, or a learner removed from their class) has nothing to show on
    // any student page; the apps say so once instead of erroring on each.
    let studentRecordMissing = false;
    if (dbUser.role === 'STUDENT') {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('id', dbUser.id)
        .maybeSingle();
      studentRecordMissing = !studentRow;
    }

    // active_role (Clerk metadata, set by role switching) only ever upgrades a
    // subject teacher to class teacher; anything else is stale and ignored.
    // The switch also lapses once the class assignment it relied on is removed.
    const requestedRole = resolveActiveRole(dbUser.role, (user?.publicMetadata as { active_role?: unknown } | undefined)?.active_role);
    const activeRole = requestedRole && dbUser.school_id
      && (await getClassTeacherStreamIds(supabase, dbUser.id, dbUser.school_id)).length > 0
      ? requestedRole
      : null;

    // Modules the school runs and what this person's role and duties allow,
    // so menus and pages hide what the server would refuse anyway.
    const resolved = await getAccess();
    const access: ClientAccess = resolved
      ? { modules: [...resolved.modules], grants: [...resolved.grants], duties: resolved.duties.map(d => d.duty) }
      : { modules: [], grants: [], duties: [] };

    return NextResponse.json({
      profile: dbUser,
      access,
      user: dbUser, // backwards compatibility
      schoolName,
      schoolLogoUrl,
      // The photo a person chose in their account wins over one an admin uploaded.
      avatarUrl: (user?.hasImage ? user.imageUrl : null) || dbUser.avatar_url || null,
      schoolOnboardingCompleted,
      // PENDING_APPROVAL lets the app show a waiting requester the demo preview.
      schoolApprovalStatus,
      email: user?.emailAddresses[0]?.emailAddress || dbUser.email,
      activeRole,
      studentRecordMissing,
    });
  } catch (err: any) {
    console.error('[/api/auth/me] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
