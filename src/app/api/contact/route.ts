import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/html';
import { CONTACT_DETAILS, contactSchema } from '@/lib/contact';

const CONTACT_INBOX = CONTACT_DETAILS.email;

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`contact:${ip}`, { maxRequests: 5, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json({ error: 'Too many messages sent. Please wait a minute and try again.' }, { status: 429 });
        }

        const parsed = contactSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }, { status: 400 });
        }
        // Typed by an anonymous visitor and placed in an HTML email, so every
        // value is escaped below.
        const { name, email, schoolName, message } = parsed.data;

        await sendEmail({
            to: CONTACT_INBOX,
            subject: `Skulbase contact form: ${name}${schoolName ? ` (${schoolName})` : ''}`,
            replyTo: email,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1a1a2e; font-size: 20px;">New contact form submission</h1>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                ${schoolName ? `<p><strong>School:</strong> ${escapeHtml(schoolName)}</p>` : ''}
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('contact form error:', err);
        return NextResponse.json({ error: 'Failed to send your message. Please try again or email us directly.' }, { status: 500 });
    }
}
