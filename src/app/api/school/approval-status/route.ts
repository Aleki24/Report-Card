import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

/**
 * Where the signed-in user's school sits in the approval queue.
 *
 * Lets the onboarding screen show "waiting for approval" instead of offering
 * the create-a-school wizard a second time to someone who already asked.
 */
export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: user } = await supabase
        .from('users')
        .select('school_id, role')
        .eq('id', userId)
        .maybeSingle();

    if (!user?.school_id) {
        return NextResponse.json({ status: null, hasSchool: false });
    }

    const { data: school } = await supabase
        .from('schools')
        .select('name, approval_status, approval_requested_at, approval_note')
        .eq('id', user.school_id)
        .maybeSingle();

    return NextResponse.json({
        hasSchool: true,
        status: school?.approval_status ?? null,
        schoolName: school?.name ?? null,
        requestedAt: school?.approval_requested_at ?? null,
        // Only meaningful on a rejection; tells the requester what to fix.
        note: school?.approval_status === 'REJECTED' ? (school?.approval_note ?? null) : null,
        role: user.role,
    });
}
