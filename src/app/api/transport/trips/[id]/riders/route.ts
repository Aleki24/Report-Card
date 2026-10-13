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
    // A morning run carries the learners who ride mornings (or both ways),
    // not evening-only ones, who would be marked absent at a stop they never use.
    let ridersQuery = db.from('student_transport').select(`student_id, direction, stop:route_stops(name, sequence, pickup_time), ${STUDENT_JOIN}`).eq('route_id', trip.route_id);
    if (trip.direction === 'MORNING' || trip.direction === 'EVENING') ridersQuery = ridersQuery.in('direction', ['BOTH', trip.direction]);
    const [{ data: riders, error }, { data: events, error: eventsError }] = await Promise.all([
        ridersQuery,
        // Oldest first, so the latest event per learner is the one that sticks.
        db.from('trip_boardings').select('student_id, event, recorded_at').eq('trip_id', trip.id).order('recorded_at', { ascending: true }),
    ]);
    if (error || eventsError) throw error ?? eventsError;
    return { riders: riders ?? [], events: events ?? [] };
});
