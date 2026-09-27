import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getStudentAttendance, getStudentDashboardSummary, getStudentReportCards } from '@/lib/student/queries';
import { loadLinkedChild } from '@/lib/parents/server';

type Params = { id: string };

/**
 * Everything a parent checks about one child: the learner dashboard summary
 * (results, report cards, notices), fees by term, recent attendance, the
 * school calendar for parents, and the bus when one is running.
 */
export const GET = route<Params>('parent child overview', { module: 'parent_portal' }, async ({ access, params }) => {
    const child = await loadLinkedChild(access, params.id);
    const db = createSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    const [summary, reports, attendance, fees, events, ride] = await Promise.all([
        access.hasModule('exams') ? getStudentDashboardSummary(child) : Promise.resolve(null),
        access.hasModule('report_cards') ? getStudentReportCards(child) : Promise.resolve([]),
        access.hasModule('attendance') ? getStudentAttendance(child, { from: since30, to: today }) : Promise.resolve([]),
        access.hasModule('fees')
            ? db.from('student_fees').select('id, total_fee, paid_amount, status, due_date, term:terms(name)').eq('student_id', child.studentId).order('created_at', { ascending: false }).limit(6).then(r => r.data ?? [])
            : Promise.resolve([]),
        access.hasModule('calendar')
            ? db.from('school_events').select('id, title, event_type, starts_on, ends_on').eq('school_id', access.schoolId).in('audience', ['ALL', 'PARENTS']).gte('starts_on', today).lte('starts_on', in60).order('starts_on').limit(10).then(r => r.data ?? [])
            : Promise.resolve([]),
        access.hasModule('transport')
            ? db.from('student_transport').select('route_id, route:transport_routes(name), stop:route_stops(name, pickup_time, dropoff_time)').eq('student_id', child.studentId).maybeSingle().then(r => r.data)
            : Promise.resolve(null),
    ]);

    let bus: { status: string; last_seen_at: string | null; vehicle: unknown; boarded: string | null } | null = null;
    if (ride?.route_id && access.hasModule('transport_tracking')) {
        const { data: trip } = await db.from('trips')
            .select('id, status, last_seen_at, vehicle:vehicles(registration)')
            .eq('route_id', ride.route_id).eq('status', 'IN_PROGRESS').limit(1).maybeSingle();
        if (trip) {
            const { data: events } = await db.from('trip_boardings').select('event, recorded_at').eq('trip_id', trip.id).eq('student_id', child.studentId).order('recorded_at', { ascending: false }).limit(1);
            bus = { status: trip.status as string, last_seen_at: trip.last_seen_at as string | null, vehicle: trip.vehicle, boarded: (events?.[0]?.event as string | undefined) ?? null };
        }
    }

    return { child: { id: child.studentId, name: child.fullName, admissionNumber: child.admissionNumber }, summary, reports, attendance, fees, events, ride, bus };
});
