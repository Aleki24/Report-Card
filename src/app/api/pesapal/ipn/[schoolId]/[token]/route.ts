import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getPesapalTransactionStatus, nextPaymentStatus, type PesapalEnvironment } from '@/lib/pesapal';
import { decryptSecret, verifyWebhookToken } from '@/lib/crypto';

export const runtime = 'nodejs';

/**
 * Pesapal calls this directly (registered as a GET-type IPN) whenever an
 * order's status changes. Pesapal doesn't sign its IPNs, so — like the M-Pesa
 * Daraja callbacks — the URL carries the school's unguessable webhook token:
 * a request without the right token for this schoolId is a forgery and is
 * rejected before anything is read or written. Even past that, the
 * notification body is never trusted: we always call GetTransactionStatus
 * ourselves to learn the real outcome. Always ack cleanly to Pesapal on the
 * legitimate path so it doesn't retry into a loop — except when we failed to
 * process a real notification (Pesapal unreachable, the update refused):
 * answering status 500 then makes Pesapal send it again, instead of leaving a
 * paid order PENDING for good.
 */
async function handleIpn(request: NextRequest, schoolId: string, token: string) {
    const supabase = createSupabaseAdmin();

    const { data: school } = await supabase
        .from('school_payment_settings')
        .select('webhook_token, pesapal_environment, pesapal_consumer_key, pesapal_consumer_secret')
        .eq('school_id', schoolId)
        .maybeSingle();

    if (!verifyWebhookToken(token, school?.webhook_token)) {
        console.error('[pesapal ipn] webhook token mismatch for school', schoolId);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const orderMerchantReference = searchParams.get('OrderMerchantReference') || '';
    const orderNotificationType = searchParams.get('OrderNotificationType') || 'IPNCHANGE';

    const ack = (trackingId: string | null, processed = true) => NextResponse.json({
        orderNotificationType,
        orderTrackingId: trackingId,
        orderMerchantReference,
        status: processed ? 200 : 500,
    }, { status: processed ? 200 : 500 });

    if (!orderTrackingId) {
        console.error('[pesapal ipn] missing OrderTrackingId for school', schoolId);
        return ack(null);
    }

    try {
        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, school_id, status')
            .eq('pesapal_order_tracking_id', orderTrackingId)
            .maybeSingle();

        if (!payment || payment.school_id !== schoolId) {
            console.error('[pesapal ipn] no matching payment', orderTrackingId, schoolId);
            return ack(orderTrackingId);
        }
        // Settled rows can still move (a retried order succeeding, a
        // reversal); a payment voided by staff stays voided.
        if (payment.status === 'CANCELLED') return ack(orderTrackingId);

        if (!school?.pesapal_consumer_key || !school.pesapal_consumer_secret) {
            console.error('[pesapal ipn] missing credentials for school', schoolId);
            return ack(orderTrackingId);
        }

        const txn = await getPesapalTransactionStatus(
            { environment: school.pesapal_environment as PesapalEnvironment, consumerKey: school.pesapal_consumer_key, consumerSecret: decryptSecret(school.pesapal_consumer_secret) },
            orderTrackingId
        );
        const next = nextPaymentStatus(payment.status, txn.status_code);
        if (!next) return ack(orderTrackingId);

        const now = new Date().toISOString();
        const update = next === 'COMPLETED'
            ? { status: next, amount: txn.amount, pesapal_confirmation_code: txn.confirmation_code, pesapal_payment_method: txn.payment_method, paid_at: now, updated_at: now }
            : { status: next, notes: next === 'CANCELLED' ? `Reversed by Pesapal: ${txn.payment_status_description ?? ''}`.trim() : txn.payment_status_description, pesapal_payment_method: txn.payment_method, updated_at: now };
        const { error: updateError } = await supabase
            .from('fee_payments')
            .update(update)
            .eq('id', payment.id)
            // Only from the status read above: a concurrent delivery or a
            // staff void in between must not be overwritten.
            .eq('status', payment.status);
        if (updateError) {
            console.error('[pesapal ipn] update failed', orderTrackingId, updateError);
            return ack(orderTrackingId, false);
        }

        return ack(orderTrackingId);
    } catch (err) {
        console.error('[pesapal ipn] error processing notification for school', schoolId, err);
        return ack(orderTrackingId, false);
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ schoolId: string; token: string }> }) {
    const { schoolId, token } = await params;
    return handleIpn(request, schoolId, token);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string; token: string }> }) {
    const { schoolId, token } = await params;
    return handleIpn(request, schoolId, token);
}
