import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getPesapalTransactionStatus, mapPesapalStatus, type PesapalEnvironment } from '@/lib/pesapal';

export const runtime = 'nodejs';

/**
 * Pesapal calls this directly (registered as a GET-type IPN) whenever an
 * order's status changes. The notification itself carries no verified
 * status — just OrderTrackingId/OrderMerchantReference — so we always call
 * GetTransactionStatus ourselves to learn the real outcome rather than
 * trusting anything in the query string. No Clerk session here; matching
 * the M-Pesa STK Push/C2B webhooks, always ack cleanly so Pesapal doesn't
 * retry into a loop, and log rather than throw on anything unexpected.
 */
async function handleIpn(request: NextRequest, schoolId: string) {
    const { searchParams } = new URL(request.url);
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const orderMerchantReference = searchParams.get('OrderMerchantReference') || '';
    const orderNotificationType = searchParams.get('OrderNotificationType') || 'IPNCHANGE';

    const ack = (trackingId: string | null) => NextResponse.json({
        orderNotificationType,
        orderTrackingId: trackingId,
        orderMerchantReference,
        status: 200,
    });

    if (!orderTrackingId) {
        console.error('[pesapal ipn] missing OrderTrackingId for school', schoolId);
        return ack(null);
    }

    try {
        const supabase = createSupabaseAdmin();
        const { data: payment } = await supabase
            .from('fee_payments')
            .select('id, school_id, status')
            .eq('pesapal_order_tracking_id', orderTrackingId)
            .maybeSingle();

        if (!payment || payment.school_id !== schoolId) {
            console.error('[pesapal ipn] no matching payment', orderTrackingId, schoolId);
            return ack(orderTrackingId);
        }
        if (payment.status !== 'PENDING') {
            return ack(orderTrackingId); // already processed — no-op
        }

        const { data: settings } = await supabase
            .from('school_payment_settings')
            .select('pesapal_environment, pesapal_consumer_key, pesapal_consumer_secret')
            .eq('school_id', schoolId)
            .maybeSingle();

        if (!settings?.pesapal_consumer_key || !settings.pesapal_consumer_secret) {
            console.error('[pesapal ipn] missing credentials for school', schoolId);
            return ack(orderTrackingId);
        }

        const txn = await getPesapalTransactionStatus(
            { environment: settings.pesapal_environment as PesapalEnvironment, consumerKey: settings.pesapal_consumer_key, consumerSecret: settings.pesapal_consumer_secret },
            orderTrackingId
        );
        const mapped = mapPesapalStatus(txn.status_code);

        if (mapped === 'COMPLETED') {
            await supabase
                .from('fee_payments')
                .update({
                    status: 'COMPLETED',
                    amount: txn.amount,
                    pesapal_confirmation_code: txn.confirmation_code,
                    pesapal_payment_method: txn.payment_method,
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);
        } else if (mapped === 'FAILED') {
            await supabase
                .from('fee_payments')
                .update({
                    status: 'FAILED',
                    notes: txn.payment_status_description,
                    pesapal_payment_method: txn.payment_method,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);
        }
        // mapped === 'PENDING' (unrecognized status_code) — leave as-is, Pesapal will notify again on the next change

        return ack(orderTrackingId);
    } catch (err) {
        console.error('[pesapal ipn] error processing notification for school', schoolId, err);
        return ack(orderTrackingId);
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    return handleIpn(request, schoolId);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = await params;
    return handleIpn(request, schoolId);
}
