import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { STUDENT_JOIN } from '@/lib/ops/resource';

/** Complaints seen this often in 48 hours raise an outbreak alert. */
const OUTBREAK_THRESHOLD = 8;

/**
 * Who is unwell right now, without clinical detail: learners in sick bay and
 * those sent home or referred today. Any staff with `health.view` (class
 * teachers, matron) sees this; the nurse also gets complaint trends.
 */
export const GET = route('health status', { module: 'health', permission: 'health.view' }, async ({ access }) => {
    const db = createSupabaseAdmin();
    const startOfDay = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) + 'T00:00:00+03:00').toISOString();
    const [bay, today] = await Promise.all([
        db.from('clinic_visits').select(`id, visited_at, outcome, ${STUDENT_JOIN}`).eq('school_id', access.schoolId).eq('outcome', 'SICK_BAY').is('discharged_at', null).order('visited_at'),
        db.from('clinic_visits').select(`id, visited_at, outcome, ${STUDENT_JOIN}`).eq('school_id', access.schoolId).in('outcome', ['SENT_HOME', 'REFERRED']).gte('visited_at', startOfDay).order('visited_at'),
    ]);
    if (bay.error || today.error) throw bay.error ?? today.error;

    let trends: { complaint: string; visits: number; alert: boolean }[] = [];
    if (access.can('health.clinical')) {
        const since = new Date(Date.now() - 48 * 3600_000).toISOString();
        const { data, error } = await db.from('clinic_visits').select('complaint').eq('school_id', access.schoolId).gte('visited_at', since).limit(2000);
        if (error) throw error;
        const counts = new Map<string, number>();
        for (const v of data ?? []) {
            const key = String(v.complaint).toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
            if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        trends = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([complaint, visits]) => ({ complaint, visits, alert: visits >= OUTBREAK_THRESHOLD }));
    }
    return { sickBay: bay.data ?? [], wentHome: today.data ?? [], trends };
});
