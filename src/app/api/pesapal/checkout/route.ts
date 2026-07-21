import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { submitPesapalOrder, type PesapalEnvironment } from '@/lib/pesapal';

export const runtime = 'nodejs';

/** Initiates a Pesapal hosted-checkout order for a fee record; returns a redirect_url to send the payer to. */
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
        const { student_fee_id, amount, phone_number, email } = body;
        if (!student_fee_id) {
            return NextResponse.json({ error: 'student_fee_id is required' }, { status: 400 });
        }

        const { data: fee } = await supabase
            .from('student_fees')
            .select(`
                id, school_id, student_id, total_fee, paid_amount,
                students ( admission_number, users ( first_name, last_name, email ) )
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
            .select('active_provider, pesapal_environment, pesapal_consumer_key, pesapal_consumer_secret, pesapal_ipn_id')
            .eq('school_id', fee.school_id)
            .maybeSingle();

        if (!settings || settings.active_provider !== 'PESAPAL' || !settings.pesapal_consumer_key || !settings.pesapal_consumer_secret || !settings.pesapal_ipn_id) {
            return NextResponse.json({ error: 'Pesapal payments are not set up for this school yet. Ask an admin to configure it in Settings.' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            return NextResponse.json({ error: 'Server is missing NEXT_PUBLIC_APP_URL, needed for the Pesapal callback URL' }, { status: 500 });
        }

        const student = fee.students as any;
        const admissionNumber = student?.admission_number || 'FEES';

        // Reserve the ledger row before calling Pesapal so the IPN webhook
        // (which can arrive within seconds) always has something to match.
        const { data: payment, error: insertError } = await supabase
            .from('fee_payments')
            .insert({
                school_id: fee.school_id,
                student_fee_id: fee.id,
                amount: amountValue,
                method: 'PESAPAL',
                status: 'PENDING',
                phone_number: phone_number || null,
                recorded_by: userId,
            })
            .select('id')
            .single();
        if (insertError) throw insertError;

        try {
            const order = await submitPesapalOrder({
                creds: {
                    environment: settings.pesapal_environment as PesapalEnvironment,
                    consumerKey: settings.pesapal_consumer_key,
                    consumerSecret: settings.pesapal_consumer_secret,
                },
                ipnId: settings.pesapal_ipn_id,
                merchantReference: payment.id,
                amount: amountValue,
                description: `School Fees - ${admissionNumber}`,
                callbackUrl: `${appUrl}/pesapal/callback`,
                payerEmail: email || student?.users?.email || undefined,
                payerPhone: phone_number || undefined,
                payerFirstName: student?.users?.first_name || undefined,
                payerLastName: student?.users?.last_name || undefined,
            });

            await supabase
                .from('fee_payments')
                .update({
                    pesapal_order_tracking_id: order.order_tracking_id,
                    pesapal_merchant_reference: order.merchant_reference,
                })
                .eq('id', payment.id);

            return NextResponse.json({
                data: {
                    paymentId: payment.id,
                    orderTrackingId: order.order_tracking_id,
                    redirectUrl: order.redirect_url,
                },
            });
        } catch (orderError: unknown) {
            const message = orderError instanceof Error ? orderError.message : 'Pesapal checkout failed';
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
