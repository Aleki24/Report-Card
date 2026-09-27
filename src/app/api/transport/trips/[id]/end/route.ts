import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadTripForOperator } from '@/lib/transport/server';

type Params = { id: string };
const bodySchema = z.object({ odometer: z.number().int().min(0).max(5_000_000).optional(), notes: z.string().trim().max(1000).optional() });

export const POST = route<Params>('trip end', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const trip = await loadTripForOperator(params.id, access);
    if (trip.status !== 'IN_PROGRESS') throw new HttpError(409, 'Only a running trip can be ended.');
    const { data, error } = await createSupabaseAdmin().from('trips')
        .update({ status: 'COMPLETED', ended_at: new Date().toISOString(), end_odometer: body.odometer ?? null, ...(body.notes ? { notes: body.notes } : {}) })
        .eq('id', trip.id).eq('status', 'IN_PROGRESS').select('id, status, ended_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, 'The trip was ended elsewhere.');
    await audit(access, 'update', 'trips', trip.id, { action: 'end' });
    return data;
});
