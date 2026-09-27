import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, type Access } from '@/lib/platform/access';
import { embedOne } from '@/lib/postgrest';

export interface TripRow {
    id: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    route_id: string | null;
    vehicle_id: string;
    driver_id: string | null;
    max_speed_kmh: number | null;
    driver: { user_id: string | null } | null;
}

/**
 * A trip the caller may operate: transport managers any trip; a driver only
 * trips assigned to the crew record linked to their login.
 */
export async function loadTripForOperator(id: string, access: Access): Promise<TripRow> {
    const { data, error } = await createSupabaseAdmin()
        .from('trips')
        .select('id, status, route_id, vehicle_id, driver_id, max_speed_kmh, driver:transport_crew(user_id)')
        .eq('id', id)
        .eq('school_id', access.schoolId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Trip not found.');
    const trip = { ...data, driver: embedOne<{ user_id: string | null }>(data.driver) } as TripRow;
    if (!access.can('transport.manage') && trip.driver?.user_id !== access.userId) {
        throw new HttpError(403, 'This trip is assigned to another driver.');
    }
    return trip;
}
