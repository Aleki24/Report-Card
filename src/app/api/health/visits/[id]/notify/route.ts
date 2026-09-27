import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGuardian, smsTime } from '@/lib/ops/notify';
import type { VisitOutcome } from '@/lib/ops/resources/welfare';

type Params = { id: string };

const OUTCOME_TEXT: Record<VisitOutcome, string> = {
    RETURNED_TO_CLASS: 'was seen and went back to class',
    SICK_BAY: 'is resting in the school sick bay',
    SENT_HOME: 'needs to go home; please arrange pick-up',
    REFERRED: 'has been referred to',
};

/**
 * Tells the guardian about a clinic visit. The message never carries the
 * diagnosis; it says where the learner is and who to call.
 */
export const POST = route<Params>('clinic notify', { module: 'health', permission: 'health.manage' }, async ({ access, params }) => {
    const db = createSupabaseAdmin();
    const { data: visit, error } = await db.from('clinic_visits').select('id, student_id, visited_at, outcome, referred_to').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!visit) throw new HttpError(404, 'Visit not found.');
    const { data: nurse } = await db.from('users').select('first_name, last_name, phone').eq('id', access.userId).maybeSingle();
    const outcome = visit.outcome as VisitOutcome;
    const where = outcome === 'REFERRED' ? `${OUTCOME_TEXT.REFERRED} ${visit.referred_to || 'hospital'}` : OUTCOME_TEXT[outcome];
    const contact = nurse?.phone ? ` Call ${nurse.first_name} on ${nurse.phone}.` : '';
    const sent = await notifyGuardian(visit.student_id as string, access.schoolId, c => `${c.schoolName}: ${c.firstName} visited the school clinic at ${smsTime(visit.visited_at as string)} and ${where}.${contact}`);
    if (!sent) throw new HttpError(400, 'No guardian phone on file, or the SMS could not be sent.');
    await db.from('clinic_visits').update({ parent_notified: true }).eq('id', visit.id);
    await audit(access, 'update', 'clinic_visits', visit.id as string, { parent_notified: true });
    return { notified: true };
});
