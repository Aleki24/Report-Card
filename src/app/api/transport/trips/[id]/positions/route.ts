import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTripForOperator } from '@/lib/transport/server';

type Params = { id: string };

const bodySchema = z.object({
    points: z.array(z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speed_kmh: z.number().min(0).max(300).nullable().optional(),
        heading: z.number().min(0).max(360).nullable().optional(),
        accuracy_m: z.number().min(0).max(100_000).nullable().optional(),
        recorded_at: z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Invalid time'),
    })).min(1).max(500),
});

/**
 * GPS fixes from the driver's phone, sent in batches (and re-sent after being
 * offline; duplicates are ignored). The newest fix is copied onto the trip for
 * the live map.
 */
export const POST = route<Params>('trip positions', { module: 'transport_tracking', permission: ['transport.drive', 'transport.manage'] }, async ({ access, params, request }) => {
    const { points } = await parseBody(request, bodySchema);
    const trip = await loadTripForOperator(params.id, access);
    if (trip.status !== 'IN_PROGRESS') throw new HttpError(409, 'The trip is not running.');
    const db = createSupabaseAdmin();
    const rows = points.map(p => ({ ...p, recorded_at: new Date(p.recorded_at).toISOString(), trip_id: trip.id, school_id: access.schoolId }));
    const { error } = await db.from('vehicle_positions').upsert(rows, { onConflict: 'trip_id,recorded_at', ignoreDuplicates: true });
    if (error) throw error;

    const latest = [...rows].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1)!;
    const fastest = Math.max(trip.max_speed_kmh ?? 0, ...rows.map(r => r.speed_kmh ?? 0));
    const { error: tripError } = await db.from('trips').update({
        last_lat: latest.lat, last_lng: latest.lng, last_speed_kmh: latest.speed_kmh ?? null, last_seen_at: latest.recorded_at, max_speed_kmh: fastest,
    }).eq('id', trip.id).or(`last_seen_at.is.null,last_seen_at.lt.${latest.recorded_at}`);
    if (tripError) throw tripError;
    return { stored: rows.length };
});
