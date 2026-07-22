import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { initiateStkPush, type MpesaEnvironment } from '@/lib/mpesa';
import { decryptSecret, generateWebhookToken } from '@/lib/crypto';

export const runtime = 'nodejs';

/** Initiates an M-Pesa STK Push ("Pay with M-Pesa") prompt for a fee record. */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { student_fee_id, phone_number, amount } = body;
        if (!student_fee_id || !phone_number) {
            return NextResponse.json({ error: 'student_fee_id and phone_number are required' }, { status: 400 });
        }

        const { data: fee } = await supabase
            .from('student_fees')
            .select(`
                id, school_id, student_id, total_fee, paid_amount, term_id,
                students ( admission_number, users ( first_name, last_name ) )
            `)
            .eq('id', student_fee_id)
            .maybeSingle();

        if (!fee || fee.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (userProfile.role === 'STUDENT' && fee.student_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const balance = Number(fee.total_fee) - Number(fee.paid_amount);
        const amountValue = amount != null ? Number(amount) : balance;
        if (isNaN(amountValue) || amountValue <= 0) {
            return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
        }

        const { data: settings } = await supabase
            .from('school_payment_settings')
            .select('environment, shortcode, passkey, consumer_key, consumer_secret, active_provider, webhook_token')
            .eq('school_id', fee.school_id)
            .maybeSingle();

        if (!settings || settings.active_provider !== 'DARAJA' || !settings.shortcode || !settings.passkey || !settings.consumer_key || !settings.consumer_secret) {
            return NextResponse.json({ error: 'M-Pesa payments are not set up for this school yet. Ask an admin to configure it in Settings.' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            return NextResponse.json({ error: 'Server is missing NEXT_PUBLIC_APP_URL, needed for the M-Pesa callback URL' }, { status: 500 });
        }

        // The callback URL carries a per-school secret token (Daraja callbacks
        // aren't signed) — generate it on first use for settings saved before
        // the token column existed.
        let webhookToken = settings.webhook_token as string | null;
        if (!webhookToken) {
            webhookToken = generateWebhookToken();
            const { error: tokenError } = await supabase
                .from('school_payment_settings')
                .update({ webhook_token: webhookToken, updated_at: new Date().toISOString() })
                .eq('school_id', fee.school_id);
            if (tokenError) throw tokenError;
        }

        const student = fee.students as any;
        const admissionNumber = student?.admission_number || 'FEES';

        // Reserve the ledger row before calling Safaricom so a callback that
        // arrives moments later always has something to match against.
        const { data: payment, error: insertError } = await supabase
            .from('fee_payments')
            .insert({
                school_id: fee.school_id,
                student_fee_id: fee.id,
                amount: amountValue,
                method: 'MPESA',
                status: 'PENDING',
                phone_number: phone_number,
                recorded_by: userId,
            })
            .select('id')
            .single();
        if (insertError) throw insertError;

        try {
            const stkResponse = await initiateStkPush({
                creds: {
                    environment: settings.environment as MpesaEnvironment,
                    shortcode: settings.shortcode,
                    passkey: decryptSecret(settings.passkey),
                    consumerKey: settings.consumer_key,
                    consumerSecret: decryptSecret(settings.consumer_secret),
                },
                phoneNumber: phone_number,
                amount: amountValue,
                accountReference: admissionNumber,
                transactionDesc: 'School Fees',
                callbackUrl: `${appUrl}/api/mpesa/stkpush/callback/${fee.school_id}/${webhookToken}`,
            });

            await supabase
                .from('fee_payments')
                .update({
                    mpesa_checkout_request_id: stkResponse.CheckoutRequestID,
                    mpesa_merchant_request_id: stkResponse.MerchantRequestID,
                })
                .eq('id', payment.id);

            return NextResponse.json({
                data: {
                    paymentId: payment.id,
                    checkoutRequestId: stkResponse.CheckoutRequestID,
                    customerMessage: stkResponse.CustomerMessage,
                },
            });
        } catch (stkError: unknown) {
            const message = stkError instanceof Error ? stkError.message : 'STK Push failed';
            await supabase
                .from('fee_payments')
                .update({ status: 'FAILED', notes: message })
                .eq('id', payment.id);
            return NextResponse.json({ error: message }, { status: 502 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
