import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { STUDENT_JOIN } from '@/lib/ops/resource';
import { loadTripForOperator } from '@/lib/transport/server';

type Params = { id: string };

/** Learners on the trip's route, in stop order, with what has been recorded on this trip. */
export const GET = route<Params>('trip riders', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access, params }) => {
    const trip = await loadTripForOperator(params.id, access);
    if (!trip.route_id) return { riders: [], events: [] };
    const db = createSupabaseAdmin();
    const [{ data: riders, error }, { data: events, error: eventsError }] = await Promise.all([
        db.from('student_transport').select(`student_id, direction, stop:route_stops(name, sequence, pickup_time), ${STUDENT_JOIN}`).eq('route_id', trip.route_id),
        db.from('trip_boardings').select('student_id, event, recorded_at').eq('trip_id', trip.id),
    ]);
    if (error || eventsError) throw error ?? eventsError;
    return { riders: riders ?? [], events: events ?? [] };
});
