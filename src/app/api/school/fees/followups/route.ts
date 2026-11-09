import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, assertInSchool, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { schoolToday } from '@/lib/dates';
import { followUpBodySchema, type FeeFollowUp } from '@/lib/fee-followups';
import { loadFollowUps } from '@/lib/fee-followups-server';

/** GET ?student_id=: a learner's follow-ups on fees, newest first, each promise with how it went. */
export const GET = route('fee follow-ups', { module: 'fees', permission: 'fees.view' }, async ({ access, request }): Promise<FeeFollowUp[]> => {
    const studentId = new URL(request.url).searchParams.get('student_id');
    if (!studentId) throw new HttpError(400, 'Pick a learner.');
    await assertInSchool('students', [studentId], access.schoolId);
    return loadFollowUps(createSupabaseAdmin(), access.schoolId, studentId);
});

/**
 * POST: a note of a contact with the family (NOTE), or what they promised
 * to pay by when (PROMISE). Returns the learner's follow-ups.
 */
export const POST = route('fee follow-up', { module: 'fees', permission: 'fees.collect' }, async ({ access, request }): Promise<FeeFollowUp[]> => {
    const body = await parseBody(request, followUpBodySchema);
    await assertInSchool('students', [body.studentId], access.schoolId);
    if (body.kind === 'PROMISE' && body.dueDate < schoolToday()) throw new HttpError(400, 'A promise to pay is for today or a later date.');
    const db = createSupabaseAdmin();
    const { data, error } = await db.from('fee_followups').insert({
        school_id: access.schoolId,
        student_id: body.studentId,
        kind: body.kind,
        note: body.note,
        amount: body.kind === 'PROMISE' ? body.amount : null,
        due_date: body.kind === 'PROMISE' ? body.dueDate : null,
        created_by: access.userId,
    }).select('id').single();
    if (error) throw error;
    await audit(access, 'create', 'fee_followups', data.id as string, { student_id: body.studentId, kind: body.kind, ...(body.kind === 'PROMISE' ? { amount: body.amount, due_date: body.dueDate } : {}) });
    return loadFollowUps(db, access.schoolId, body.studentId);
});
