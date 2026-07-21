import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { registerPesapalIPN } from '@/lib/pesapal';

// Checks the Clerk session BEFORE touching Supabase — an anonymous request
// must get a clean 401, not a raw 500 from createSupabaseAdmin() throwing.
async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('id', userId)
        .maybeSingle();

    if (!userProfile || userProfile.role !== 'ADMIN') {
        return { error: NextResponse.json({ error: 'Only an admin can manage payment settings' }, { status: 403 }) };
    }
    if (!userProfile.school_id) {
        return { error: NextResponse.json({ error: 'No school' }, { status: 400 }) };
    }
    return { supabase, schoolId: userProfile.school_id as string };
}

// GET never returns consumer_secret/passkey/pesapal_consumer_secret — only whether they're set.
export async function GET() {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;

        const { data } = await supabase
            .from('school_payment_settings')
            .select('*')
            .eq('school_id', schoolId)
            .maybeSingle();

        return NextResponse.json({
            data: {
                activeProvider: data?.active_provider ?? 'NONE',
                // Daraja
                environment: data?.environment ?? 'sandbox',
                shortcode: data?.shortcode ?? '',
                consumerKey: data?.consumer_key ?? '',
                hasPasskey: !!data?.passkey,
                hasConsumerSecret: !!data?.consumer_secret,
                configured: !!(data?.shortcode && data?.passkey && data?.consumer_key && data?.consumer_secret),
                // Pesapal
                pesapalEnvironment: data?.pesapal_environment ?? 'sandbox',
                pesapalConsumerKey: data?.pesapal_consumer_key ?? '',
                hasPesapalConsumerSecret: !!data?.pesapal_consumer_secret,
                pesapalConfigured: !!(data?.pesapal_consumer_key && data?.pesapal_consumer_secret && data?.pesapal_ipn_id),
                updatedAt: data?.updated_at ?? null,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;

        const body = await request.json();
        const { environment, shortcode, passkey, consumer_key, consumer_secret, active_provider, pesapal_environment, pesapal_consumer_key, pesapal_consumer_secret } = body;

        if (environment && !['sandbox', 'production'].includes(environment)) {
            return NextResponse.json({ error: 'environment must be sandbox or production' }, { status: 400 });
        }
        if (pesapal_environment && !['sandbox', 'live'].includes(pesapal_environment)) {
            return NextResponse.json({ error: 'pesapal_environment must be sandbox or live' }, { status: 400 });
        }
        if (active_provider && !['NONE', 'DARAJA', 'PESAPAL'].includes(active_provider)) {
            return NextResponse.json({ error: 'active_provider must be NONE, DARAJA, or PESAPAL' }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('school_payment_settings')
            .select('*')
            .eq('school_id', schoolId)
            .maybeSingle();

        const update: Record<string, any> = { school_id: schoolId, updated_at: new Date().toISOString() };
        if (environment !== undefined) update.environment = environment;
        if (shortcode !== undefined) update.shortcode = shortcode || null;
        if (pesapal_environment !== undefined) update.pesapal_environment = pesapal_environment;
        if (pesapal_consumer_key !== undefined) update.pesapal_consumer_key = pesapal_consumer_key || null;
        if (active_provider !== undefined) update.active_provider = active_provider;
        // Blank strings mean "leave unchanged" for secrets — the client never
        // gets to read these back, so it can't round-trip them intentionally
        // blank without this being a footgun for "I left the field empty."
        if (passkey) update.passkey = passkey;
        if (consumer_key) update.consumer_key = consumer_key;
        if (consumer_secret) update.consumer_secret = consumer_secret;
        if (pesapal_consumer_secret) update.pesapal_consumer_secret = pesapal_consumer_secret;

        const resolvedProvider = update.active_provider ?? existing?.active_provider ?? 'NONE';

        // Switching Pesapal on (or updating its credentials while active) means
        // Pesapal needs to know where to send payment notifications — register
        // the IPN URL now, before saving, so a bad credential surfaces
        // immediately instead of failing silently at checkout time later.
        if (resolvedProvider === 'PESAPAL') {
            const resolvedKey = update.pesapal_consumer_key ?? existing?.pesapal_consumer_key;
            const resolvedSecret = update.pesapal_consumer_secret ?? existing?.pesapal_consumer_secret;
            const resolvedEnv = update.pesapal_environment ?? existing?.pesapal_environment ?? 'sandbox';

            if (!resolvedKey || !resolvedSecret) {
                return NextResponse.json({ error: 'Enter your Pesapal consumer key and secret before enabling Pesapal' }, { status: 400 });
            }

            const appUrl = process.env.NEXT_PUBLIC_APP_URL;
            if (!appUrl) {
                return NextResponse.json({ error: 'Server is missing NEXT_PUBLIC_APP_URL, needed for the Pesapal IPN URL' }, { status: 500 });
            }

            try {
                const ipnId = await registerPesapalIPN(
                    { environment: resolvedEnv, consumerKey: resolvedKey, consumerSecret: resolvedSecret },
                    `${appUrl}/api/pesapal/ipn/${schoolId}`
                );
                update.pesapal_ipn_id = ipnId;
            } catch (ipnError: unknown) {
                const message = ipnError instanceof Error ? ipnError.message : 'Failed to register with Pesapal';
                return NextResponse.json({ error: `Pesapal rejected these credentials: ${message}` }, { status: 400 });
            }
        }

        const { error } = await supabase
            .from('school_payment_settings')
            .upsert(update, { onConflict: 'school_id' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
