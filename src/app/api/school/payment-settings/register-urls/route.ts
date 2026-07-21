import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { registerC2BUrls, type MpesaEnvironment } from '@/lib/mpesa';
import { decryptSecret } from '@/lib/crypto';

/**
 * Tells Safaricom where to send Paybill (C2B) confirmations for this
 * school's shortcode. Requires the shortcode to already be provisioned for
 * API access by Safaricom — an offline step outside this app's control.
 */
export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only an admin can do this' }, { status: 403 });
        }
        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        const { data: settings } = await supabase
            .from('school_payment_settings')
            .select('environment, shortcode, consumer_key, consumer_secret')
            .eq('school_id', schoolId)
            .maybeSingle();

        if (!settings || !settings.shortcode || !settings.consumer_key || !settings.consumer_secret) {
            return NextResponse.json({ error: 'Save your M-Pesa credentials first' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            return NextResponse.json({ error: 'Server is missing NEXT_PUBLIC_APP_URL' }, { status: 500 });
        }

        const confirmationUrl = `${appUrl}/api/mpesa/c2b/confirmation/${schoolId}`;
        // No Validation URL implementation (see the confirmation route's
        // comment) — point it at the same confirmation endpoint since
        // Safaricom requires a value here even when unused.
        const validationUrl = confirmationUrl;

        const result = await registerC2BUrls(
            { environment: settings.environment as MpesaEnvironment, shortcode: settings.shortcode, consumerKey: settings.consumer_key, consumerSecret: decryptSecret(settings.consumer_secret) },
            confirmationUrl,
            validationUrl
        );

        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
