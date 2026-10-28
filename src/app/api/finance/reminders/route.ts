import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { sendBulkSMS } from '@/lib/africastalking';
import { rateLimit } from '@/lib/rate-limit';
import { normalizeMpesaPhone } from '@/lib/phone';
import { formatKsh, type FeeReminderSummary } from '@/lib/fee-account';

const bodySchema = z.object({
    term_id: z.string().uuid(),
    min_balance: z.number().min(0).default(1),
    grade_stream_id: z.string().uuid().optional(),
    dry_run: z.boolean().default(false),
});

type One<T> = T | T[] | null;

interface LearnerFee {
    student_id: string;
    student: One<{ admission_number: string | null; guardian_phone: string | null; current_grade_stream_id: string | null; user: One<{ first_name: string | null }> }>;
}

/** Ids per `.in()` filter, so the request URL stays short. */
const CHUNK = 150;

async function inChunks<T>(ids: readonly string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await read(ids.slice(i, i + CHUNK));
        if (error) throw error;
        out.push(...(data ?? []));
    }
    return out;
}

/** Each learner's balance across every term they were billed for. */
async function balances(db: SupabaseClient, schoolId: string, studentIds: string[]): Promise<Map<string, number>> {
    const rows = await inChunks<{ student_id: string; total_fee: number | string; paid_amount: number | string }>(studentIds, chunk =>
        db.from('student_fees').select('student_id, total_fee, paid_amount').eq('school_id', schoolId).in('student_id', chunk));
    const owed = new Map<string, number>();
    for (const r of rows) owed.set(r.student_id, (owed.get(r.student_id) ?? 0) + Number(r.total_fee) - Number(r.paid_amount));
    return owed;
}

/** Every number that should hear about each learner: linked parents, then the contact on their record. */
async function phonesFor(db: SupabaseClient, schoolId: string, learners: Map<string, string | null>): Promise<Map<string, Set<string>>> {
    const links = await inChunks<{ student_id: string; parent: One<{ phone: string | null }> }>([...learners.keys()], chunk =>
        db.from('student_guardians').select('student_id, parent:users!student_guardians_parent_user_id_fkey ( phone )').eq('school_id', schoolId).in('student_id', chunk));
    const phones = new Map<string, Set<string>>();
    const add = (studentId: string, phone: string | null | undefined) => {
        const n = phone ? normalizeMpesaPhone(phone) : null;
        if (!n) return;
        phones.set(studentId, (phones.get(studentId) ?? new Set()).add(n));
    };
    for (const l of links) add(l.student_id, embedOne(l.parent)?.phone);
    for (const [id, recordPhone] of learners) add(id, recordPhone);
    return phones;
}

/**
 * Texts the parents of learners billed this term who owe at least
 * `min_balance` across all their terms (arrears included): every linked
 * parent and the contact on the learner's record, each number once per
 * learner, with how to pay when the school has a Paybill.
 */
export const POST = route('fee reminders', { module: 'fees', permission: 'fees.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [{ data: school }, { data: settings }, fees] = await Promise.all([
        db.from('schools').select('name').eq('id', access.schoolId).maybeSingle(),
        db.from('school_payment_settings').select('active_provider, shortcode').eq('school_id', access.schoolId).maybeSingle(),
        fetchAllRows<LearnerFee>(() => db.from('student_fees')
            .select('student_id, student:students!inner(admission_number, guardian_phone, current_grade_stream_id, user:users(first_name))')
            .eq('school_id', access.schoolId).eq('term_id', body.term_id).order('id')),
    ]);
    if (fees.error) throw fees.error;

    const learners = fees.rows
        .map(f => ({ id: f.student_id, student: embedOne(f.student) }))
        .filter(l => l.student && (!body.grade_stream_id || l.student.current_grade_stream_id === body.grade_stream_id));
    const ids = learners.map(l => l.id);
    const [owed, phones] = await Promise.all([
        balances(db, access.schoolId, ids),
        phonesFor(db, access.schoolId, new Map(learners.map(l => [l.id, l.student?.guardian_phone ?? null]))),
    ]);

    const paybill = settings?.active_provider === 'DARAJA' && settings.shortcode ? String(settings.shortcode) : null;
    const schoolName = school?.name ?? 'School';
    const recipients: { phone: string; message: string }[] = [];
    let learnersReached = 0;
    let learnersWithoutPhone = 0;
    for (const l of learners) {
        const balance = owed.get(l.id) ?? 0;
        if (balance < Math.max(1, body.min_balance)) continue;
        const numbers = phones.get(l.id);
        if (!numbers || numbers.size === 0) { learnersWithoutPhone++; continue; }
        learnersReached++;
        const firstName = embedOne(l.student?.user ?? null)?.first_name?.trim() || 'Your child';
        const adm = l.student?.admission_number?.trim();
        const pay = paybill && adm ? ` Pay via M-Pesa Paybill ${paybill}, account ${adm}.` : '';
        const message = `${schoolName}: ${firstName}'s fee balance is ${formatKsh(Math.round(balance))}.${pay} Thank you.`;
        for (const phone of numbers) recipients.push({ phone, message });
    }

    const summary = { learners: learnersReached, without_phone: learnersWithoutPhone, recipients: recipients.length };
    if (body.dry_run || recipients.length === 0) return { ...summary, sent: 0, failed: 0 } satisfies FeeReminderSummary;
    if (!rateLimit(`fee-reminders:${access.schoolId}`, { maxRequests: 2, windowMs: 10 * 60_000 }).allowed) {
        throw new HttpError(429, 'Reminders were just sent. Wait a few minutes before sending again.');
    }
    const result = await sendBulkSMS(recipients);
    await audit(access, 'create', 'fee_reminders', body.term_id, { ...summary, sent: result.sent });
    return { ...summary, sent: result.sent, failed: result.failed } satisfies FeeReminderSummary;
});
