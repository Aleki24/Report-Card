import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { sendBulkSMS } from '@/lib/africastalking';
import { rateLimit } from '@/lib/rate-limit';
import { money } from '@/lib/ops/format';

const bodySchema = z.object({
    term_id: z.string().uuid(),
    min_balance: z.number().min(0).default(1),
    grade_stream_id: z.string().uuid().optional(),
    dry_run: z.boolean().default(false),
});

interface FeeStudent { guardian_phone: string | null; current_grade_stream_id: string; user: { first_name: string }[] | { first_name: string } | null }
interface FeeRow { total_fee: number; paid_amount: number; student: FeeStudent[] | FeeStudent | null }

/** Texts guardians of learners owing at least `min_balance` for the term. */
export const POST = route('fee reminders', { module: 'fees', permission: 'fees.manage' }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const [{ data: school }, fees] = await Promise.all([
        db.from('schools').select('name').eq('id', access.schoolId).maybeSingle(),
        fetchAllRows<FeeRow>(() => db.from('student_fees')
            .select('total_fee, paid_amount, student:students!inner(guardian_phone, current_grade_stream_id, user:users(first_name))')
            .eq('school_id', access.schoolId).eq('term_id', body.term_id).order('id')),
    ]);
    if (fees.error) throw fees.error;

    const recipients = fees.rows
        .map(f => ({ student: embedOne(f.student), balance: Number(f.total_fee) - Number(f.paid_amount) }))
        .filter((r): r is { student: FeeStudent & { guardian_phone: string }; balance: number } =>
            r.balance >= Math.max(1, body.min_balance) && !!r.student?.guardian_phone
            && (!body.grade_stream_id || r.student.current_grade_stream_id === body.grade_stream_id))
        .map(({ student, balance }) => ({
            phone: student.guardian_phone,
            message: `${school?.name ?? 'School'}: ${embedOne(student.user)?.first_name ?? 'Your child'}'s fee balance is ${money(balance)}. Kindly clear it. Thank you.`,
        }));
    if (body.dry_run) return { recipients: recipients.length, sent: 0, failed: 0 };
    if (recipients.length === 0) return { recipients: 0, sent: 0, failed: 0 };
    if (!rateLimit(`fee-reminders:${access.schoolId}`, { maxRequests: 2, windowMs: 10 * 60_000 }).allowed) {
        throw new HttpError(429, 'Reminders were just sent. Wait a few minutes before sending again.');
    }
    const result = await sendBulkSMS(recipients);
    await audit(access, 'create', 'fee_reminders', body.term_id, { recipients: recipients.length, sent: result.sent });
    return { recipients: recipients.length, sent: result.sent, failed: result.failed };
});
