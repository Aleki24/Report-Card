import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { isPlaceholderEmail } from '@/lib/placeholder-email';
import { createSignInTicket } from '@/lib/sign-in-ticket';

const bodySchema = z.object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(256),
});

const INVALID = { error: 'Incorrect username or password.' } as const;

/**
 * POST /api/auth/password-ticket
 *
 * Signs in an account that has nowhere to receive a verification code.
 *
 * Clerk's Client Trust answers a password sign-in from a new device by
 * emailing a code. Teachers and students invited without an email only have a
 * placeholder `.local` address, so that code never arrives and they could
 * never sign in on a new phone or browser — only admins, who have real
 * inboxes, got through. For those accounts alone, the server checks the
 * password itself and hands back a one-time sign-in ticket.
 *
 * Accounts with a real email or a phone number are refused: they can
 * receive the code, so they keep that protection, and the client falls back
 * to sending it. Every refusal looks the same, so this can't be used to learn
 * which accounts exist or have an inbox — and the password is only checked
 * for inbox-less accounts, so it is no extra password oracle for the rest.
 */
export async function POST(request: NextRequest) {
    try {
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
        }
        const { identifier, password } = parsed.data;

        // Unauthenticated password check: throttle per IP and per account.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const byIp = rateLimit(`password-ticket:ip:${ip}`, { maxRequests: 10, windowMs: 60_000 });
        const byAccount = rateLimit(`password-ticket:id:${identifier.toLowerCase()}`, { maxRequests: 5, windowMs: 60_000 });
        if (!byIp.allowed || !byAccount.allowed) {
            return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
        }

        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const { data: matches } = await clerk.users.getUserList(
            identifier.includes('@') ? { emailAddress: [identifier] } : { username: [identifier] }
        );
        const user = matches.length === 1 ? matches[0] : undefined;
        if (!user) return NextResponse.json(INVALID, { status: 401 });

        const canReceiveCode =
            user.phoneNumbers.length > 0 ||
            user.emailAddresses.some((e) => !isPlaceholderEmail(e.emailAddress));
        if (canReceiveCode) return NextResponse.json(INVALID, { status: 401 });

        // verifyPassword throws on a wrong password rather than returning false.
        const verified = await clerk.users
            .verifyPassword({ userId: user.id, password })
            .then((r) => r.verified)
            .catch(() => false);
        if (!verified) return NextResponse.json(INVALID, { status: 401 });

        return NextResponse.json({ ticket: await createSignInTicket(clerk, user.id) });
    } catch (err: unknown) {
        console.error('[password-ticket] failed:', err);
        return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 });
    }
}
