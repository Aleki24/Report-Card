import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveUserProfile } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { isPlatformOwnerEmail } from '@/lib/school-approval';
import type { PendingSchool } from '@/lib/pending-schools';

export const runtime = 'nodejs';

/**
 * Schools waiting for approval, for the platform owner only (their account
 * email is one of the owner addresses). Each carries the same single-use
 * approve / reject links the request email has, so the owner can decide from
 * the app when a message never arrived.
 */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await getActiveUserProfile(userId);
        if (!user || !isPlatformOwnerEmail(user.email)) {
            return NextResponse.json({ error: 'Only the platform owner can see pending schools.' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data, error } = await supabase
            .from('schools')
            .select('id, name, email, phone, address, approval_requested_at, approval_token, requested_by')
            .eq('approval_status', 'PENDING_APPROVAL')
            .not('approval_token', 'is', null)
            .order('approval_requested_at', { ascending: true });
        if (error) return internalError('platform/schools', error);

        const requesterIds = (data ?? []).map(s => s.requested_by).filter((id): id is string => !!id);
        const { data: requesters, error: usersError } = requesterIds.length
            ? await supabase.from('users').select('id, first_name, last_name, email, phone').in('id', requesterIds)
            : { data: [], error: null };
        if (usersError) return internalError('platform/schools users', usersError);
        const byId = new Map((requesters ?? []).map(u => [u.id, u]));

        const decide = (id: string, token: string, action: 'approve' | 'reject') =>
            `/api/platform/schools/${encodeURIComponent(id)}/decision?action=${action}&token=${encodeURIComponent(token)}`;

        const schools: PendingSchool[] = (data ?? []).map(s => {
            const u = s.requested_by ? byId.get(s.requested_by) : undefined;
            return {
                id: s.id,
                name: s.name,
                email: s.email,
                phone: s.phone,
                address: s.address,
                requestedAt: s.approval_requested_at,
                requester: u ? { name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed', email: u.email, phone: u.phone } : null,
                approveUrl: decide(s.id, s.approval_token as string, 'approve'),
                rejectUrl: decide(s.id, s.approval_token as string, 'reject'),
            };
        });
        return NextResponse.json({ data: schools }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return internalError('platform/schools', err);
    }
}
