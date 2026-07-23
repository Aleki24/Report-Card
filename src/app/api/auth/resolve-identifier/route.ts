import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/auth/resolve-identifier
 *
 * Turns a login identifier into the email Clerk can authenticate.
 *
 * Skulbase issues teachers and students a generated *username* (e.g.
 * `alexsathyasaischoolkisaju12`) rather than an email. Whether username works
 * as a sign-in identifier depends on the Clerk instance configuration — when
 * it isn't enabled, `signIn.create({ identifier: <username> })` fails with
 * `form_identifier_invalid`. To keep username login working regardless of that
 * setting, the login form resolves a non-email identifier to the account's
 * email here first, then signs in with the email (always an enabled
 * identifier).
 *
 * Only ever returns the email for the matched account — no other fields — and
 * is rate-limited to blunt username/email enumeration.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`resolve-identifier:${ip}`, { maxRequests: 20, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429 });
        }

        const { identifier } = await request.json();
        const value = typeof identifier === 'string' ? identifier.trim() : '';
        if (!value) {
            return NextResponse.json({ error: 'Identifier is required.' }, { status: 400 });
        }

        // Emails are already valid Clerk identifiers — nothing to resolve.
        if (value.includes('@')) {
            return NextResponse.json({ email: value });
        }

        const supabaseAdmin = createSupabaseAdmin();
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('email, is_active')
            .ilike('username', value)
            .maybeSingle();

        // Don't disclose whether the username exists — the login form falls
        // back to attempting the raw identifier, and Clerk returns the
        // appropriate "not found" message.
        if (!user?.email) {
            return NextResponse.json({ email: null });
        }

        return NextResponse.json({ email: user.email });
    } catch {
        // Never block login on a resolver hiccup — the caller falls back to the
        // raw identifier.
        return NextResponse.json({ email: null });
    }
}
