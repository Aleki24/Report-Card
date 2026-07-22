import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { findActiveTermId } from '@/lib/term-calendar';
import { verifyWebhookToken } from '@/lib/crypto';
import type { C2BConfirmationBody } from '@/lib/mpesa';

export const runtime = 'nodejs';

/**
 * Safaricom calls this whenever someone pays the school's Paybill directly
 * from their M-Pesa menu (not via our STK Push button) — the confirmation
 * fires AFTER the money has already moved, so this always accepts it; the
 * only question is which student it belongs to.
 *
 * Daraja doesn't sign these, so the per-school webhook token in the URL is
 * what separates Safaricom (which got the token inside the URL we
 * registered) from a forger who only knows the school's UUID — without it,
 * anyone could insert a COMPLETED payment against any admission number.
 * Forged requests (bad token) get a plain 403 before anything is written.
 *
 * We only auto-match to the CURRENT term's fee record (never guess across
 * terms) by BillRefNumber == admission number. Anything that doesn't match
 * — a typo'd account number, a student with no bill yet this term — lands
 * as an unmatched payment for staff to assign from the Fees dashboard,
 * rather than silently being dropped or mis-applied.
 *
 * The (optional) C2B Validation URL is intentionally not implemented —
 * Safaricom only invokes it when a shortcode has explicitly opted in via
 * support, so most integrations (including this one) rely on
 * Confirmation-only, which Safaricom defaults to auto-accepting.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string; token: string }> }) {
    const { schoolId, token } = await params;
    try {
        const supabase = createSupabaseAdmin();

        const { data: settings } = await supabase
            .from('school_payment_settings')
            .select('webhook_token')
            .eq('school_id', schoolId)
            .maybeSingle();

        if (!verifyWebhookToken(token, settings?.webhook_token)) {
            console.error('[mpesa c2b confirmation] webhook token mismatch for school', schoolId);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = (await request.json()) as C2BConfirmationBody;

        const amount = Number(body.TransAmount);
        const rawRef = (body.BillRefNumber || '').trim();
        const payerName = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(' ') || null;

        if (!rawRef || isNaN(amount) || amount <= 0) {
            await supabase.from('fee_payments').insert({
                school_id: schoolId,
                amount: isNaN(amount) ? 0 : amount,
                method: 'MPESA',
                status: 'COMPLETED',
                mpesa_receipt_number: body.TransID,
                phone_number: body.MSISDN,
                payer_name: payerName,
                unmatched_account_reference: rawRef || '(none provided)',
                notes: 'C2B payment with missing/invalid account reference or amount',
            });
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        const { data: student } = await supabase
            .from('students')
            .select('id, users!inner(school_id)')
            .ilike('admission_number', rawRef)
            .eq('users.school_id', schoolId)
            .maybeSingle();

        let matchedFeeId: string | null = null;
        if (student) {
            const { data: terms } = await supabase.from('terms').select('id, name, start_date, end_date, is_current').eq('school_id', schoolId);
            const activeTermId = terms && terms.length > 0 ? findActiveTermId(terms) : null;
            if (activeTermId) {
                const { data: fee } = await supabase
                    .from('student_fees')
                    .select('id')
                    .eq('student_id', student.id)
                    .eq('term_id', activeTermId)
                    .maybeSingle();
                matchedFeeId = fee?.id ?? null;
            }
        }

        await supabase.from('fee_payments').insert({
            school_id: schoolId,
            student_fee_id: matchedFeeId,
            amount,
            method: 'MPESA',
            status: 'COMPLETED',
            mpesa_receipt_number: body.TransID,
            phone_number: body.MSISDN,
            payer_name: payerName,
            unmatched_account_reference: matchedFeeId ? null : rawRef,
            notes: matchedFeeId ? null : (student ? 'No fee record for the current term — assign manually' : 'No student matched this account number'),
        });

        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (err) {
        console.error('[mpesa c2b confirmation] error for school', schoolId, err);
        // Still acknowledge — the transaction already happened on Safaricom's
        // side regardless of whether we recorded it cleanly; surface the
        // failure via logs/monitoring rather than leaving Safaricom retrying.
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
}
