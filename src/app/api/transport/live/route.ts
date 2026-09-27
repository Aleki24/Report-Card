import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SPEED_LIMIT_KMH, STALE_AFTER_MS } from '@/lib/transport/compliance';
import type { LiveTrip } from '@/lib/transport/types';


/** Every running trip with its latest position, recent path, stops and alerts. */
export const GET = route('transport live', { module: 'transport_tracking', permission: 'transport.view' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const { data: trips, error } = await db.from('trips')
        .select('id, direction, started_at, route_id, last_lat, last_lng, last_speed_kmh, last_seen_at, max_speed_kmh, vehicle:vehicles(registration), route:transport_routes(name), driver:transport_crew(full_name, phone)')
        .eq('school_id', access.schoolId)
        .eq('status', 'IN_PROGRESS');
    if (error) throw error;
    const now = Date.now();
    const result = await Promise.all((trips ?? []).map(async t => {
        const [{ data: path }, { data: stops }] = await Promise.all([
            db.from('vehicle_positions').select('lat, lng').eq('trip_id', t.id).order('recorded_at', { ascending: false }).limit(120),
            t.route_id ? db.from('route_stops').select('name, lat, lng, sequence').eq('route_id', t.route_id).order('sequence') : Promise.resolve({ data: [] }),
        ]);
        const alerts: string[] = [];
        if (Number(t.last_speed_kmh ?? 0) > SPEED_LIMIT_KMH) alerts.push(`Speeding: ${Math.round(Number(t.last_speed_kmh))} km/h`);
        if (!t.last_seen_at) alerts.push('No location yet');
        else if (now - Date.parse(t.last_seen_at as string) > STALE_AFTER_MS) alerts.push('Location not updating');
        if (Number(t.max_speed_kmh ?? 0) > SPEED_LIMIT_KMH && !alerts[0]?.startsWith('Speeding')) alerts.push(`Exceeded ${SPEED_LIMIT_KMH} km/h earlier (max ${Math.round(Number(t.max_speed_kmh))})`);
        return {
            ...t,
            path: (path ?? []).reverse().map(p => [Number(p.lat), Number(p.lng)] as [number, number]),
            stops: (stops ?? []) as LiveTrip['stops'],
            alerts,
        };
    }));
    return result as unknown as LiveTrip[];
});
