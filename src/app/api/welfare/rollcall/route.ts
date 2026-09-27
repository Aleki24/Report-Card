import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { ROLL_SESSIONS, ROLL_STATUSES, type RollStatus } from '@/lib/ops/resources/welfare';
import { assertDormAccess } from '@/lib/welfare/boarding-server';

export interface RollEntry { studentId: string; name: string; admissionNumber: string | null; bed: string | null; status: RollStatus | null; suggested: RollStatus | null }

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A dorm's roll for one session: who sleeps there, what was recorded, and a
 * suggestion for learners out on exeat or in sick bay (so they are not
 * marked absent by mistake).
 */
export const GET = route('rollcall load', { module: 'boarding', permission: ['boarding.rollcall', 'boarding.manage'] }, async ({ access, request }) => {
    const p = request.nextUrl.searchParams;
    const dormId = p.get('dorm_id') ?? '';
    const session = z.enum(ROLL_SESSIONS).safeParse(p.get('session'));
    const date = isoDate.safeParse(p.get('date'));
    if (!dormId || !session.success || !date.success) throw new HttpError(400, 'Choose a dorm, session and date.');
    await assertDormAccess(access, dormId);

    const db = createSupabaseAdmin();
    const dayStart = `${date.data}T00:00:00+03:00`;
    const dayEnd = `${date.data}T23:59:59+03:00`;
    const { data: beds, error } = await db.from('dorm_allocations')
        .select('student_id, bed_label, student:students(admission_number, user:users(first_name, last_name))')
        .eq('dorm_id', dormId).is('ended_on', null);
    if (error) throw error;
    const ids = (beds ?? []).map(b => b.student_id as string);

    const [{ data: call }, { data: out }, { data: sick }] = await Promise.all([
        db.from('roll_calls').select('id, notes, entries:roll_call_entries(student_id, status)').eq('dorm_id', dormId).eq('session', session.data).eq('taken_on', date.data).maybeSingle(),
        ids.length ? db.from('exeats').select('student_id').in('student_id', ids).in('status', ['APPROVED', 'OUT']).lte('leave_at', dayEnd).gte('return_by', dayStart) : Promise.resolve({ data: [] }),
        ids.length && access.hasModule('health') ? db.from('clinic_visits').select('student_id').in('student_id', ids).eq('outcome', 'SICK_BAY').is('discharged_at', null) : Promise.resolve({ data: [] }),
    ]);
    const recorded = new Map(((call?.entries as { student_id: string; status: RollStatus }[] | undefined) ?? []).map(e => [e.student_id, e.status]));
    const onExeat = new Set((out ?? []).map(e => e.student_id as string));
    const inBay = new Set((sick ?? []).map(e => e.student_id as string));

    const entries: RollEntry[] = (beds ?? []).map(b => {
        const s = embedOne<{ admission_number: string | null; user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }>(b.student);
        const u = embedOne(s?.user ?? null);
        const id = b.student_id as string;
        return {
            studentId: id,
            name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim(),
            admissionNumber: s?.admission_number ?? null,
            bed: (b.bed_label as string | null) ?? null,
            status: recorded.get(id) ?? null,
            suggested: inBay.has(id) ? 'SICK_BAY' as const : onExeat.has(id) ? 'EXEAT' as const : null,
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { taken: !!call, notes: (call?.notes as string | null) ?? null, entries };
});

const saveSchema = z.object({
    dorm_id: z.string().uuid(),
    session: z.enum(ROLL_SESSIONS),
    date: isoDate,
    notes: z.string().trim().max(1000).optional(),
    entries: z.array(z.object({ student_id: z.string().min(1).max(100), status: z.enum(ROLL_STATUSES) })).max(500),
});

/** Records the roll (again, if corrected). Only learners allocated to the dorm count. */
export const PUT = route('rollcall save', { module: 'boarding', permission: ['boarding.rollcall', 'boarding.manage'] }, async ({ access, request }) => {
    const body = await parseBody(request, saveSchema);
    await assertDormAccess(access, body.dorm_id);
    const db = createSupabaseAdmin();
    const { data: beds, error } = await db.from('dorm_allocations').select('student_id').eq('dorm_id', body.dorm_id).is('ended_on', null);
    if (error) throw error;
    const allowed = new Set((beds ?? []).map(b => b.student_id as string));
    if (body.entries.some(e => !allowed.has(e.student_id))) throw new HttpError(400, 'Some learners are not allocated to this dorm.');

    const { data: call, error: callError } = await db.from('roll_calls').upsert({
        school_id: access.schoolId, dorm_id: body.dorm_id, session: body.session, taken_on: body.date,
        taken_by: access.userId, notes: body.notes ?? null,
    }, { onConflict: 'dorm_id,session,taken_on' }).select('id').single();
    if (callError || !call) throw callError ?? new Error('roll call upsert failed');
    const { error: delError } = await db.from('roll_call_entries').delete().eq('roll_call_id', call.id);
    if (delError) throw delError;
    if (body.entries.length > 0) {
        const { error: insError } = await db.from('roll_call_entries').insert(body.entries.map(e => ({ ...e, roll_call_id: call.id, school_id: access.schoolId })));
        if (insError) throw insError;
    }
    const absent = body.entries.filter(e => e.status === 'ABSENT').length;
    return { saved: body.entries.length, absent };
});
