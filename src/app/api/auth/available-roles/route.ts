import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getClassTeacherStreamIds } from '@/lib/auth-server';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();

        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!userProfile.is_active) {
            return NextResponse.json({ error: 'Account is deactivated' }, { status: 401 });
        }

        const baseRole = userProfile.role;
        const schoolId = userProfile.school_id;

        // Only CLASS_TEACHER and SUBJECT_TEACHER can switch roles
        // ADMIN and STUDENT never see the role switcher
        if (baseRole !== 'CLASS_TEACHER' && baseRole !== 'SUBJECT_TEACHER') {
            return NextResponse.json({
                roles: [baseRole],
                baseRole,
            });
        }

        const availableRoles = new Set<string>();

        // Always include the user's base role so they can switch back
        availableRoles.add(baseRole);

        // A class-teacher assignment this academic year unlocks the class-teacher view
        if (schoolId && (await getClassTeacherStreamIds(supabase, userId, schoolId)).length > 0) {
            availableRoles.add('CLASS_TEACHER');
        }

        // SUBJECT_TEACHER is intentionally never offered as a switch *target*.
        // A class teacher already covers subject-teacher work with broader
        // access, so switching a class teacher down into the narrower
        // subject-teacher view (which strands them) serves no purpose. Users
        // whose base role is SUBJECT_TEACHER still get it via the always-added
        // base role above; the only extra role on offer is the CLASS_TEACHER
        // upgrade for a subject teacher who also holds a class-teacher record.

        return NextResponse.json({
            roles: Array.from(availableRoles),
            baseRole,
        });

    } catch (error: unknown) {
        console.error('Error fetching available roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
