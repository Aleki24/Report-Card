import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

const CONTACT_INBOX = 'alexotieno293@gmail.com';

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`contact:${ip}`, { maxRequests: 5, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json({ error: 'Too many messages sent. Please wait a minute and try again.' }, { status: 429 });
        }

        const body = await request.json();
        const name = body.name?.trim();
        const email = body.email?.trim();
        const schoolName = body.schoolName?.trim();
        const message = body.message?.trim();

        if (!name || !email || !message) {
            return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
        }

        await sendEmail({
            to: CONTACT_INBOX,
            subject: `Skulbase contact form: ${name}${schoolName ? ` (${schoolName})` : ''}`,
            replyTo: email,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1a1a2e; font-size: 20px;">New contact form submission</h1>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                ${schoolName ? `<p><strong>School:</strong> ${schoolName}</p>` : ''}
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
              </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('contact form error:', err);
        return NextResponse.json({ error: 'Failed to send your message. Please try again or email us directly.' }, { status: 500 });
    }
}
