import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { CREW_DOCUMENTS, VEHICLE_DOCUMENTS, complianceOf, type ComplianceItem } from '@/lib/transport/compliance';

export interface ComplianceAlert extends ComplianceItem { subject: string; kind: 'vehicle' | 'crew' }

/** Expired, due and missing NTSA documents across the fleet and crew, worst first. */
export const GET = route('transport compliance', { module: 'transport', permission: 'transport.view' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const [{ data: vehicles, error }, { data: crew, error: crewError }] = await Promise.all([
        db.from('vehicles').select('*').eq('school_id', access.schoolId).neq('status', 'RETIRED'),
        db.from('transport_crew').select('*').eq('school_id', access.schoolId),
    ]);
    if (error || crewError) throw error ?? crewError;
    const alerts: ComplianceAlert[] = [
        ...(vehicles ?? []).flatMap(v => complianceOf(VEHICLE_DOCUMENTS, v).map(i => ({ ...i, subject: v.registration as string, kind: 'vehicle' as const }))),
        ...(crew ?? []).flatMap(c => complianceOf(CREW_DOCUMENTS, c).map(i => ({ ...i, subject: c.full_name as string, kind: 'crew' as const }))),
    ].filter(a => a.level !== 'ok');
    const rank = { expired: 0, due: 1, missing: 2, ok: 3 } as const;
    return alerts.sort((a, b) => rank[a.level] - rank[b.level] || (a.days ?? 9e9) - (b.days ?? 9e9));
});
