import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { CREW_DOCUMENTS, OPERATING_HOURS, VEHICLE_DOCUMENTS, blocking, complianceOf } from '@/lib/transport/compliance';
import { loadTripForOperator } from '@/lib/transport/server';

type Params = { id: string };
const bodySchema = z.object({ odometer: z.number().int().min(0).max(5_000_000).optional() });

/**
 * Starts a trip, refusing when the vehicle is off the road, its or the
 * driver's NTSA documents have expired, or it is outside operating hours.
 */
export const POST = route<Params>('trip start', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const trip = await loadTripForOperator(params.id, access);
    if (trip.status !== 'SCHEDULED') throw new HttpError(409, `This trip is ${trip.status.toLowerCase().replace('_', ' ')}.`);

    const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false }));
    if (hour < OPERATING_HOURS.from || hour >= OPERATING_HOURS.to) throw new HttpError(409, 'School transport runs only between 5 a.m. and 10 p.m.');

    const db = createSupabaseAdmin();
    const [{ data: vehicle }, { data: driver }] = await Promise.all([
        db.from('vehicles').select('*').eq('id', trip.vehicle_id).maybeSingle(),
        trip.driver_id ? db.from('transport_crew').select('*').eq('id', trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!vehicle) throw new HttpError(400, 'The trip has no vehicle.');
    if (vehicle.status !== 'ACTIVE') throw new HttpError(409, `${vehicle.registration} is marked ${String(vehicle.status).toLowerCase()}.`);
    const problems = [
        ...blocking(complianceOf(VEHICLE_DOCUMENTS, vehicle)).map(i => `${vehicle.registration}: ${i.label}`),
        ...(driver ? blocking(complianceOf(CREW_DOCUMENTS, driver)).map(i => `${driver.full_name}: ${i.label}`) : []),
    ];
    if (problems.length > 0) throw new HttpError(409, `Expired: ${problems.join('; ')}. Renew before running this trip.`);

    const { data, error } = await db.from('trips')
        .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString(), start_odometer: body.odometer ?? null })
        .eq('id', trip.id).eq('status', 'SCHEDULED').select('id, status, started_at').maybeSingle();
    if (error) {
        if (error.code === '23505') throw new HttpError(409, 'This vehicle is already on another trip. End that one first.');
        throw error;
    }
    if (!data) throw new HttpError(409, 'The trip was started elsewhere.');
    await audit(access, 'update', 'trips', trip.id, { action: 'start' });
    return data;
});
