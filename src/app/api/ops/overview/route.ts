import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { Permission } from '@/lib/platform/permissions';
import type { OverviewTile, TileTone } from '@/lib/ops/overview';
import { CREW_DOCUMENTS, SPEED_LIMIT_KMH, VEHICLE_DOCUMENTS, blocking, complianceOf } from '@/lib/transport/compliance';
import { money } from '@/lib/ops/format';

type Loader = () => Promise<OverviewTile[]>;

interface CountFilter {
    eq?: Record<string, string>;
    isNull?: string[];
    lte?: Record<string, string>;
    gte?: Record<string, string>;
    lt?: Record<string, string>;
}

/** Rows of a school's table matching `f`; 0 if the query fails (a tile must never break the dashboard). */
async function countRows(table: string, schoolId: string, f: CountFilter): Promise<number> {
    let q = createSupabaseAdmin().from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
    Object.entries(f.eq ?? {}).forEach(([k, v]) => { q = q.eq(k, v); });
    (f.isNull ?? []).forEach(k => { q = q.is(k, null); });
    Object.entries(f.lte ?? {}).forEach(([k, v]) => { q = q.lte(k, v); });
    Object.entries(f.gte ?? {}).forEach(([k, v]) => { q = q.gte(k, v); });
    Object.entries(f.lt ?? {}).forEach(([k, v]) => { q = q.lt(k, v); });
    const { count } = await q;
    return count ?? 0;
}

const tone = (n: number, when: 'any-bad' | 'any-warn'): TileTone => (n === 0 ? 'good' : when === 'any-bad' ? 'bad' : 'warn');

/**
 * The principal's cockpit: a live figure from each module the school runs
 * and the viewer may see. Tiles for modules that are off, or outside the
 * viewer's duties, are never computed.
 */
export const GET = route('ops overview', {}, async ({ access }) => {
    const s = access.schoolId;
    const db = createSupabaseAdmin();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const startOfDay = new Date(`${today}T00:00:00+03:00`).toISOString();

    const loaders: [Permission, Loader][] = [
        ['fees.view', async () => {
            const { data } = await db.from('fee_payments').select('amount').eq('school_id', s).eq('status', 'COMPLETED').gte('paid_at', startOfDay);
            const total = (data ?? []).reduce((n, p) => n + Number(p.amount), 0);
            return [{ key: 'fees-today', label: 'Fees collected today', value: money(total), hint: `${data?.length ?? 0} payments`, href: '/dashboard/fees', tone: 'default' }];
        }],
        ['expenses.approve', async () => {
            const n = await countRows('expenses', s, { eq: { status: 'PENDING' } });
            return [{ key: 'expenses', label: 'Expenses to approve', value: n, href: '/dashboard/expenses?tab=all', tone: tone(n, 'any-warn') }];
        }],
        ['health.view', async () => {
            const n = await countRows('clinic_visits', s, { eq: { outcome: 'SICK_BAY' }, isNull: ['discharged_at'] });
            return [{ key: 'sickbay', label: 'In sick bay', value: n, href: '/dashboard/health', tone: n > 5 ? 'warn' : 'default' }];
        }],
        ['boarding.view', async () => {
            const [out, pending] = await Promise.all([
                countRows('exeats', s, { eq: { status: 'OUT' } }),
                countRows('exeats', s, { eq: { status: 'PENDING' } }),
            ]);
            return [{ key: 'exeats', label: 'Learners out on exeat', value: out, hint: pending ? `${pending} awaiting approval` : undefined, href: '/dashboard/boarding?tab=exeats', tone: pending ? 'warn' : 'default' }];
        }],
        ['transport.view', async () => {
            const [{ data: live }, { data: vehicles }, { data: crew }] = await Promise.all([
                db.from('trips').select('last_speed_kmh').eq('school_id', s).eq('status', 'IN_PROGRESS'),
                db.from('vehicles').select('*').eq('school_id', s).eq('status', 'ACTIVE'),
                db.from('transport_crew').select('*').eq('school_id', s),
            ]);
            const speeding = (live ?? []).filter(t => Number(t.last_speed_kmh ?? 0) > SPEED_LIMIT_KMH).length;
            const expired = (vehicles ?? []).filter(v => blocking(complianceOf(VEHICLE_DOCUMENTS, v)).length).length
                + (crew ?? []).filter(c => blocking(complianceOf(CREW_DOCUMENTS, c)).length).length;
            return [
                { key: 'buses', label: 'Buses on the road', value: live?.length ?? 0, hint: speeding ? `${speeding} speeding` : undefined, href: '/dashboard/transport?tab=live', tone: speeding ? 'bad' : 'default' },
                { key: 'compliance', label: 'Expired NTSA documents', value: expired, href: '/dashboard/transport?tab=compliance', tone: tone(expired, 'any-bad') },
            ];
        }],
        ['exam_papers.moderate', async () => {
            const n = await countRows('exam_papers', s, { eq: { status: 'SUBMITTED' } });
            return [{ key: 'papers', label: 'Papers to moderate', value: n, href: '/dashboard/exam-papers?tab=moderation', tone: tone(n, 'any-warn') }];
        }],
        ['hr.manage', async () => {
            const [pending, away] = await Promise.all([
                countRows('leave_requests', s, { eq: { status: 'PENDING' } }),
                countRows('leave_requests', s, { eq: { status: 'APPROVED' }, lte: { starts_on: today }, gte: { ends_on: today } }),
            ]);
            return [{ key: 'leave', label: 'Staff on leave today', value: away, hint: pending ? `${pending} requests to decide` : undefined, href: '/dashboard/leave', tone: pending ? 'warn' : 'default' }];
        }],
        ['inventory.manage', async () => {
            const n = await countRows('store_requisitions', s, { eq: { status: 'PENDING' } });
            return [{ key: 'requisitions', label: 'Store requisitions', value: n, href: '/dashboard/inventory?tab=requisitions', tone: tone(n, 'any-warn') }];
        }],
        ['library.manage', async () => {
            const n = await countRows('library_loans', s, { isNull: ['returned_on'], lt: { due_on: today } });
            return [{ key: 'overdue', label: 'Overdue library books', value: n, href: '/dashboard/library?tab=loans', tone: tone(n, 'any-warn') }];
        }],
        ['discipline.manage', async () => {
            const n = await countRows('discipline_incidents', s, { eq: { status: 'OPEN' } });
            return [{ key: 'discipline', label: 'Open discipline cases', value: n, href: '/dashboard/discipline', tone: tone(n, 'any-warn') }];
        }],
        ['calendar.view', async () => {
            const { data } = await db.from('school_events').select('title, starts_on').eq('school_id', s).gte('starts_on', today).order('starts_on').limit(1).maybeSingle();
            return data ? [{ key: 'next-event', label: 'Next on the calendar', value: data.title as string, hint: data.starts_on as string, href: '/dashboard/calendar', tone: 'default' }] : [];
        }],
    ];

    const results = await Promise.allSettled(loaders.filter(([p]) => access.can(p)).map(([, load]) => load()));
    return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
});
