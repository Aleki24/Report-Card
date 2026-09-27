import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** The trips assigned to the signed-in driver from yesterday on (managers: every trip today). */
export const GET = route('transport my trips', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    let q = db.from('trips')
        .select('id, direction, scheduled_at, status, started_at, route:transport_routes(name), vehicle:vehicles(registration), driver:transport_crew!inner(full_name, user_id)')
        .eq('school_id', access.schoolId)
        .in('status', ['SCHEDULED', 'IN_PROGRESS'])
        .gte('scheduled_at', since)
        .order('scheduled_at');
    if (!access.can('transport.manage')) q = q.eq('driver.user_id', access.userId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
});
