import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { parseStkCallback, type StkCallbackBody } from '@/lib/mpesa';

export const runtime = 'nodejs';

/**
 * Safaricom calls this directly — there is no Clerk session, and Daraja
 * callbacks aren't cryptographically signed, so the practical safeguard is
 * that CheckoutRequestID is an unguessable value Safaricom generated for a
 * specific STK Push we initiated (double-checked against schoolId here too).
 * For production hardening, also allowlist Safaricom's callback IP ranges
 * at the reverse proxy / WAF level.
 *
 * Always resolves 200 quickly — Safaricom retries aggressively on anything
 * else, so failures are logged and swallowed rather than surfaced to it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    try {
        const body = (await request.json()) as StkCallbackBody;
        const parsed = parseStkCallback(body);
        if (!parsed) {
            console.error('[mpesa callback] unrecognized payload', JSON.stringify(body));
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        const supabase = createSupabaseAdmin();
        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, status, school_id, amount')
            .eq('mpesa_checkout_request_id', parsed.checkoutRequestId)
            .maybeSingle();

        if (!payment || payment.school_id !== schoolId) {
            console.error('[mpesa callback] no matching pending payment', parsed.checkoutRequestId, schoolId);
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }
        if (payment.status !== 'PENDING') {
            // Already processed (Safaricom's retry) — no-op.
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        if (parsed.success) {
            await supabase
                .from('fee_payments')
                .update({
                    status: 'COMPLETED',
                    amount: parsed.amount ?? payment.amount,
                    mpesa_receipt_number: parsed.mpesaReceiptNumber || null,
                    phone_number: parsed.phoneNumber || undefined,
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);
        } else {
            await supabase
                .from('fee_payments')
                .update({
                    status: 'FAILED',
                    notes: parsed.resultDesc,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);
        }

        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err) {
        console.error('[mpesa callback] error processing callback for school', schoolId, err);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
}
