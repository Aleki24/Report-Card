import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGuardian } from '@/lib/ops/notify';
import { humanize } from '@/lib/ops/format';

type Params = { id: string };

/** Asks the guardian to get in touch about an incident, without details in the SMS. */
export const POST = route<Params>('discipline notify', { module: 'discipline', permission: 'discipline.manage' }, async ({ access, params }) => {
    const db = createSupabaseAdmin();
    const { data: incident, error } = await db.from('discipline_incidents').select('id, student_id, category, action_taken').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!incident) throw new HttpError(404, 'Incident not found.');
    const action = incident.action_taken && incident.action_taken !== 'NONE' ? ` Action: ${humanize(incident.action_taken as string).toLowerCase()}.` : '';
    const sent = await notifyGuardian(incident.student_id as string, access.schoolId, c => `${c.schoolName}: please contact the school about ${c.firstName} (${humanize(incident.category as string).toLowerCase()}).${action}`);
    if (!sent) throw new HttpError(400, 'No guardian phone on file, or the SMS could not be sent.');
    await db.from('discipline_incidents').update({ parent_notified: true }).eq('id', incident.id);
    await audit(access, 'update', 'discipline_incidents', incident.id as string, { parent_notified: true });
    return { notified: true };
});
