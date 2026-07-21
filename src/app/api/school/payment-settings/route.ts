import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

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

// GET never returns consumer_secret/passkey — only whether they're set.
export async function GET() {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;

        const { data } = await supabase
            .from('school_payment_settings')
            .select('environment, shortcode, consumer_key, is_active, passkey, consumer_secret, updated_at')
            .eq('school_id', schoolId)
            .maybeSingle();

        return NextResponse.json({
            data: {
                environment: data?.environment ?? 'sandbox',
                shortcode: data?.shortcode ?? '',
                consumerKey: data?.consumer_key ?? '',
                isActive: data?.is_active ?? false,
                hasPasskey: !!data?.passkey,
                hasConsumerSecret: !!data?.consumer_secret,
                updatedAt: data?.updated_at ?? null,
                configured: !!(data?.shortcode && data?.passkey && data?.consumer_key && data?.consumer_secret),
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
        const { environment, shortcode, passkey, consumer_key, consumer_secret, is_active } = body;

        if (environment && !['sandbox', 'production'].includes(environment)) {
            return NextResponse.json({ error: 'environment must be sandbox or production' }, { status: 400 });
        }

        const update: Record<string, any> = { school_id: schoolId, updated_at: new Date().toISOString() };
        if (environment !== undefined) update.environment = environment;
        if (shortcode !== undefined) update.shortcode = shortcode || null;
        // Blank strings mean "leave unchanged" for secrets — the client never
        // gets to read these back, so it can't round-trip them intentionally
        // blank without this being a footgun for "I left the field empty."
        if (passkey) update.passkey = passkey;
        if (consumer_key) update.consumer_key = consumer_key;
        if (consumer_secret) update.consumer_secret = consumer_secret;
        if (is_active !== undefined) update.is_active = !!is_active;

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
