import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** The trips assigned to the signed-in driver from yesterday on (managers: every trip today). */
export const GET = route('transport my trips', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const manages = access.can('transport.manage');
    // A trip still running is listed however old it is: a trip a driver
    // forgot to end otherwise vanished, could not be ended, and blocked its
    // vehicle from every new trip. Managers see trips with no driver too.
    let q = db.from('trips')
        .select(`id, direction, scheduled_at, status, started_at, route:transport_routes(name), vehicle:vehicles(registration), driver:transport_crew${manages ? '' : '!inner'}(full_name, user_id)`)
        .eq('school_id', access.schoolId)
        .or(`status.eq.IN_PROGRESS,and(status.eq.SCHEDULED,scheduled_at.gte."${since}")`)
        .order('scheduled_at');
    if (!manages) q = q.eq('driver.user_id', access.userId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
});
