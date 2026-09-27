import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGuardian, smsTime } from '@/lib/ops/notify';
import { loadTripForOperator } from '@/lib/transport/server';

type Params = { id: string };
const bodySchema = z.object({ student_id: z.string().min(1).max(100), event: z.enum(['BOARDED', 'ALIGHTED', 'ABSENT']), notify: z.boolean().default(true) });

/** Records a learner boarding, getting off, or not turning up; the guardian gets an SMS. */
export const POST = route<Params>('trip boarding', { module: 'transport', permission: ['transport.drive', 'transport.manage'] }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const trip = await loadTripForOperator(params.id, access);
    if (trip.status !== 'IN_PROGRESS') throw new HttpError(409, 'Start the trip first.');
    const db = createSupabaseAdmin();
    const { data: rider } = await db.from('student_transport').select('id').eq('student_id', body.student_id).eq('route_id', trip.route_id ?? '').maybeSingle();
    if (!rider) throw new HttpError(400, 'That learner is not on this route.');
    const now = new Date().toISOString();
    const { error } = await db.from('trip_boardings').upsert(
        { school_id: access.schoolId, trip_id: trip.id, student_id: body.student_id, event: body.event, recorded_at: now, recorded_by: access.userId },
        { onConflict: 'trip_id,student_id,event' },
    );
    if (error) throw error;
    let notified = false;
    if (body.notify) {
        const verb = body.event === 'BOARDED' ? 'boarded the school bus' : body.event === 'ALIGHTED' ? 'was dropped off' : 'was not at the pick-up point';
        notified = await notifyGuardian(body.student_id, access.schoolId, c => `${c.schoolName}: ${c.firstName} ${verb} at ${smsTime(now)}.`);
    }
    return { recorded: true, notified };
});
